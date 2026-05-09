"""
建筑施工文档生成 Workflow API
基于 LangGraph ReAct Agent，提供 SSE 流式接口
"""
import os
import sys
import re
import json
import traceback
from time import time
from typing import Optional, List
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_core.messages import HumanMessage, AIMessage
from dotenv import load_dotenv
import logging

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 导入 Agent 工作流
from service.workflow.construction_agent import (
    app as agent_app,
)
from service.workflow.batch_construction_agent import generate_chapter_batch
from service.tools.construction_tools import set_request_kb_ids, clear_request_kb_ids, get_reference_pool
from service.tools.kb_resolver import resolve as resolve_kb
from service.memory.memory_service import save_memory, recall_memories
# from service.db.database import get_kb_id_by_project_id

# Langfuse integration
try:
    from langfuse.langchain import CallbackHandler
    LANGFUSE_AVAILABLE = True
except ImportError:
    try:
        from langfuse.callback import CallbackHandler
        LANGFUSE_AVAILABLE = True
    except ImportError:
        # Create dummy handler if LangFuse is not available
        class CallbackHandler:
            def __init__(self):
                pass
        LANGFUSE_AVAILABLE = False
        
from service.utils.langfuse_callback import create_enhanced_langfuse_handler, get_langfuse_metadata

load_dotenv()

# Configure logging
log_level_name = os.getenv('APP_LOG_LEVEL', 'INFO').upper()
log_level = getattr(logging, log_level_name, logging.INFO)
logging.basicConfig(level=log_level, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

workflow_router = APIRouter(prefix="/agent/workflow")

logger.debug(f"Workflow API module loaded: {__name__}")

def get_langfuse_handler(user_id: str, session_id: str, metadata: dict = None):
    """
    创建增强的 Langfuse CallbackHandler
    用于追踪 LLM 调用、工具使用和成本，包含准确的 token 计算

    Args:
        user_id: 用户 ID
        session_id: Session ID（通常是 document_id）
        metadata: 额外的元数据

    Returns:
        增强的 Langfuse CallbackHandler 实例和配置信息的元组
    """
    if not LANGFUSE_AVAILABLE:
        logger.warning("LangFuse not available, using dummy handler")
        return CallbackHandler(), {}
    
    try:
        # 尝试创建增强的 LangFuse 处理器
        enhanced_handler = create_enhanced_langfuse_handler(user_id, session_id, metadata)
        
        # 获取 LangChain 兼容的 metadata
        langfuse_metadata = get_langfuse_metadata(user_id, session_id, metadata)
        
        logger.info(f"Created enhanced LangFuse handler for user {user_id}, session {session_id}")
        return enhanced_handler, langfuse_metadata
        
    except Exception as e:
        logger.warning(f"Failed to create enhanced LangFuse handler: {e}, using basic handler with original session fix")
        
        # Fallback to the original session fix implementation
        # This ensures session functionality is preserved even if enhanced features fail
        handler = CallbackHandler()

        # ✅ 使用原有的 session 修复逻辑（保持与 LANGFUSE_SESSION_COMPLETE_FIX.md 一致）
        handler._langfuse_user_id = user_id
        handler._langfuse_session_id = session_id
        handler._langfuse_metadata = metadata or {}
        handler._langfuse_tags = ["construction_agent", "document_generation"]

        # metadata 仍然保留用于 LangChain config
        langfuse_metadata = {
            "langfuse_user_id": user_id,           # 特殊键：会被解析为 user_id
            "langfuse_session_id": session_id,     # 特殊键：会被解析为 session_id
            "langfuse_tags": ["construction_agent", "document_generation"],  # 特殊键：会被解析为 tags
            # 其他自定义 metadata
            "user_id": user_id,                    # 保留用于显示
            "session_id": session_id,              # 保留用于显示
            **(metadata or {})
        }

        logger.info(f"Using basic LangFuse handler with session fix for user {user_id}, session {session_id}")
        return handler, langfuse_metadata

# =============================================================================
# 请求模型定义
# =============================================================================

class WorkflowChatRequest(BaseModel):
    """流式对话请求"""
    message: str
    project_id: Optional[str] = None
    template: Optional[str] = None
    project_info: Optional[str] = None
    user_id: Optional[str] = "default_user"
    enable_audit: Optional[bool] = False  # 是否启用 Auditor 校验
    enable_citation: Optional[bool] = True  # 是否启用引用标记（注入引用 prompt 并返回 reference 事件）

    # 新增字段：支持记忆功能
    document_id: Optional[str] = None  # 文档 ID（用作 thread_id）
    chapter_name: Optional[str] = None  # 当前生成的章节名称
    resume_session: Optional[bool] = True  # 是否恢复历史 Session（默认 True）

    
    # 补充要求（用于记忆保存）
    additional_requirements: Optional[str] = None  # 用户输入的补充要求，直接保存为记忆

    # 记忆区间控制
    memory_window: Optional[int] = None  # 保留最近 N 轮对话（None=全部，0=不保留）
    memory_chapters: Optional[List[str]] = None  # 指定保留的章节名称列表

    # 标签字段：用于动态知识库选择
    profession_tag_id: Optional[int] = None  # 专业标签 ID
    business_type_tag_id: Optional[int] = None  # 业态标签 ID

# =============================================================================
# SSE 辅助函数
# =============================================================================

def generate_thread_id(user_id: str, document_id: str) -> str:
    """
    生成 LangGraph thread_id
    规则：直接使用 document_id 作为 thread_id，确保同一文档的所有章节共享 Session

    Args:
        user_id: 用户 ID
        document_id: 文档 ID

    Returns:
        thread_id: 直接返回 document_id，方便在 Langfuse 中定位
    """
    if not document_id:
        # 如果没有 document_id，使用 user_id 创建临时 session
        return f"user_{user_id}_temp"
    return document_id



def _sse(event_type: str, payload: dict) -> str:
    """生成 SSE 格式的事件"""
    return f"event: {event_type}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _extract_user_facing_thought(raw: str) -> str:
    """提取用户友好的思考摘要

    Policy/UX goals:
    - 不暴露原始思考链
    - 提供简短、客观的摘要（类似 Copilot timeline 详情）

    Implementation:
    - 保留 Markdown 标题 (##/###) 和少量列表项
    - 丢弃冗长的段落
    """
    if not raw:
        return ""

    lines = [ln.rstrip() for ln in raw.splitlines()]
    kept: list[str] = []
    bullet_budget = 6

    for ln in lines:
        s = ln.strip()
        if not s:
            continue

        # 保留 Markdown 标题
        if s.startswith("## ") or s.startswith("### "):
            kept.append(s)
            continue

        # 保留列表项
        if bullet_budget > 0 and (s.startswith("- ") or s.startswith("* ") or s.startswith("• ")):
            kept.append(s)
            bullet_budget -= 1

    # 限制总长度
    return "\n".join(kept[:30])


def _format_error_message(error: Exception) -> dict:
    """格式化错误消息为结构化数据"""
    return {
        "type": type(error).__name__,
        "message": str(error),
        "suggestion": _get_error_suggestion(error)
    }


def _get_error_suggestion(error: Exception) -> str:
    """根据错误类型提供用户友好的建议"""
    error_str = str(error)

    if "Range of input length" in error_str:
        return "输入内容过长。系统已自动优化上下文管理，请重试。"
    elif "API" in error_str or "api" in error_str.lower():
        return "API 调用失败，请检查网络连接或 API 密钥配置"
    elif "timeout" in error_str.lower():
        return "请求超时，请稍后重试"
    elif "not found" in error_str.lower():
        return "未找到相关资源"
    else:
        return "系统遇到错误，请稍后重试"


def _summarize_tool_result(tool_name: str, tool_output: str) -> str:
    """生成用户友好的工具结果摘要"""
    if not tool_output or not isinstance(tool_output, str):
        return "执行完成"

    MAX_SUMMARY_LENGTH = 150

    if tool_name == "retrieve_case":
        lines = tool_output.strip().split('\n')
        num_cases = max(1, len([l for l in lines if l.strip()]) // 3)
        return f"找到 {num_cases} 个相关案例"

    elif tool_name == "retrieve_standard":
        lines = tool_output.strip().split('\n')
        num_standards = max(1, len([l for l in lines if l.strip()]) // 3)
        return f"找到 {num_standards} 条相关规范"

    elif tool_name == "web_search":
        return "搜索完成"

    # 默认：返回输出的前 N 个字符
    summary = tool_output[:MAX_SUMMARY_LENGTH]
    if len(tool_output) > MAX_SUMMARY_LENGTH:
        summary += "..."

    return summary


def _parse_auditor_result(content: str) -> dict:
    """解析 Auditor 节点的输出，提取校验结果"""
    content_lower = content.lower()

    # 检查是否通过
    if "pass" in content_lower and "revise" not in content_lower:
        return {
            "type": "pass",
            "message": "校验通过，文档符合规范要求",
            "suggestions": None
        }

    # 检查是否需要修改
    if "revise" in content_lower:
        suggestions = []

        if "revise:" in content_lower:
            revise_index = content_lower.index("revise:")
            feedback = content[revise_index + 7:].strip()

            lines = feedback.split('\n')
            for line in lines:
                line = line.strip()
                if line.startswith(('-', '*', '•')) or (len(line) > 2 and line[0].isdigit() and line[1] in '.、'):
                    suggestion = line.lstrip('-*•0123456789.、 ')
                    if suggestion:
                        suggestions.append(suggestion)

            if not suggestions:
                suggestions = [feedback[:200] + ("..." if len(feedback) > 200 else "")]

        return {
            "type": "revise",
            "message": "需要修改文档",
            "suggestions": suggestions if suggestions else None
        }

    # 默认：信息不明确
    return {
        "type": "info",
        "message": "校验完成",
        "suggestions": None
    }


def _save_requirement_memory(user_id: str, additional_requirements: str = None, chapter_name: str = None):
    """将用户的补充要求直接保存为记忆"""
    if not additional_requirements or not user_id or user_id == "default_user":
        return
    content = additional_requirements.strip()
    if content:
        save_memory(
            user_id=user_id,
            content=content,
            chapter_name=chapter_name,
            source_type="requirement",
        )


def _inject_recalled_memories(
    user_id: str, project_info: str, chapter_name: str = None,
    chapter_names: list = None, days_limit: int = None,
) -> tuple[str, list]:
    """召回相关记忆并注入到 project_info 中，同时返回召回的记忆列表"""
    if not user_id or user_id == "default_user":
        return project_info, []

    # 用章节名称作为查询文本召回记忆
    query = chapter_name or "建筑设计"
    memories = recall_memories(
        user_id, query, limit=5,
        chapter_names=chapter_names, days_limit=days_limit,
    )
    if not memories:
        return project_info, []

    memory_lines = [f"- {m['content']}" for m in memories]
    memory_block = "\n【历史偏好记忆】:\n" + "\n".join(memory_lines)
    logger.info(f"[Memory] Injected {len(memories)} memories for user {user_id}, chapter={chapter_name}")
    return project_info + memory_block, memories


def import_time():
    """获取当前时间戳（毫秒）"""
    return int(time() * 1000)

# =============================================================================
# SSE 事件流生成器
# =============================================================================

async def event_generator(inputs, config=None):
    """
    将 LangGraph 事件转换为前端协议流 (SSE)
    优化版本：更好的进度跟踪和错误处理

    Args:
        inputs: LangGraph 输入参数
        config: LangGraph 配置（包含 thread_id、callbacks、metadata、tags 等）
    """
    streamed_run_ids = set()

    # Timeline step mapping (human-friendly, action-oriented)
    timeline_titles = {
        "router": "理解用户问题",
        "researcher": "收集参考资料",
        "generate": "生成文档草稿",
        "auditor": "校验并优化内容",
        "general_agent": "生成答复",
    }

    # Tool name mapping (technical name → user-friendly name)
    tool_display_names = {
        "retrieve_case": "检索案例库",
        "retrieve_standard": "检索规范库",
        "web_search": "网络搜索",
    }

    # Track tool execution times
    tool_start_times = {}

    # Track step execution times
    step_start_times = {}

    # 获取审核开关状态
    enable_audit = inputs.get("enable_audit", False)
    # 获取引用标记开关状态
    enable_citation = inputs.get("enable_citation", True)

    # 从 construction_agent 导入 MAX_AUDIT_LOOPS
    from service.workflow.construction_agent import MAX_AUDIT_LOOPS

    # 只流式输出这些节点的用户可见内容
    # 如果启用了审核，generate 不流式输出（等待最终结果）
    # 如果未启用审核，generate 流式输出
    user_visible_nodes = {"general_agent"}  # general_agent 始终流式输出

    # 跟踪 generate 节点是否已发送过 token（用于 on_chain_end 补救）
    generate_tokens_emitted = False

    # 跟踪 auditor 节点的执行次数
    auditor_execution_count = 0

    # 跟踪当前活动的 timeline step
    active_step_by_node: dict[str, str] = {}
    thought_by_step_id: dict[str, str] = {}

    # 性能优化：避免重复发送相同的状态
    last_step_status: dict[str, str] = {}

    # 跟踪最近活跃的 step_id（用于关联工具调用）
    current_active_step_id: str = None

    # 累积 generate 节点输出的完整内容（用于引用检测）
    accumulated_generate_content: str = ""

    # Keep-alive configuration
    last_ping_time = import_time()
    PING_INTERVAL = 15000  # 15 seconds

    try:
        # 发送会话开始事件
        yield _sse("session_start", {"timestamp": import_time()})

        # 使用传入的完整 config（包含 callbacks、metadata、tags、configurable 等）
        if config is None:
            config = {}

        # 使用 astream_events 获取细粒度事件
        async for event in agent_app.astream_events(inputs, config=config, version="v2"):
            current_time = import_time()
            if current_time - last_ping_time > PING_INTERVAL:
                yield ": keep-alive\n\n"
                last_ping_time = current_time

            kind = event["event"]
            name = event["name"]
            data = event["data"]
            run_id = event["run_id"]

            # 调试日志：记录所有事件
            if name in timeline_titles:
                logger.info(f"[Event] {kind} - {name} - run_id={run_id}")

            # --- 场景 1: LLM 流式输出 (Streaming Tokens) ---
            if kind == "on_chat_model_stream":
                chunk = data.get("chunk")
                if chunk and chunk.content:
                    # 获取当前节点名称
                    metadata = event.get("metadata", {})
                    node_name = metadata.get("langgraph_node", "")
                    logger.debug(f"[on_chat_model_stream] node={node_name}, content_length={len(chunk.content)}")

                    # 检查是否为思考过程
                    tags = event.get("tags", [])
                    is_thought = "thinking_trace" in tags

                    # 收集思考内容
                    if is_thought:
                        step_id = active_step_by_node.get(node_name)
                        if step_id:
                            thought_by_step_id[step_id] = thought_by_step_id.get(step_id, "") + chunk.content
                        # 对于 generate 节点：思考内容就是文档内容，不跳过，继续执行下方的 token 发送逻辑
                        # 对于其他节点：跳过 token 发送，只收集思考内容
                        if node_name != "generate":
                            continue

                    # 动态判断 generate 节点是否应该流式输出
                    should_stream_generate = False
                    if node_name == "generate":
                        # 策略：
                        # 1. 未开启审核：流式输出 generate
                        # 2. 开启审核但已达到最大循环次数：流式输出 generate（最后一次）
                        # 3. 开启审核且未达到最大循环次数：不流式输出 generate（等待审核后输出）
                        if not enable_audit:
                            should_stream_generate = True
                        elif auditor_execution_count >= MAX_AUDIT_LOOPS:
                            # 已经执行了最大次数的 auditor，这次 generate 是最后一次，应该流式输出
                            should_stream_generate = True
                            logger.info(f"[workflow_api] Streaming final generate after {auditor_execution_count} auditor loops")
                        else:
                            should_stream_generate = False
                            logger.debug(f"[workflow_api] Not streaming generate (auditor count: {auditor_execution_count}/{MAX_AUDIT_LOOPS})")

                    # 只流式输出用户可见节点的内容
                    if node_name in user_visible_nodes or should_stream_generate:
                        streamed_run_ids.add(run_id)  # 只有在实际发送后才标记为已流式
                        if node_name == "generate":
                            generate_tokens_emitted = True
                            accumulated_generate_content += chunk.content
                        logger.debug(f"[on_chat_model_stream] Sending token for {node_name}")
                        yield _sse(
                            "token",
                            {
                                "content": chunk.content,
                                "node": node_name,
                                "timestamp": import_time()
                            },
                        )

            # --- 场景 2: 非流式 LLM 输出补救 (Non-Streaming Output) ---
            elif kind == "on_chat_model_end":
                logger.info(f"[on_chat_model_end] run_id={run_id}, streamed={run_id in streamed_run_ids}")
                if run_id not in streamed_run_ids:
                    output = data.get("output")
                    if output and hasattr(output, "content") and output.content:
                        metadata = event.get("metadata", {})
                        node_name = metadata.get("langgraph_node", "")
                        logger.debug(f"[on_chat_model_end] node_name={node_name}, content_length={len(output.content)}")

                        if node_name == "router":
                            continue

                        tags = event.get("tags", [])
                        is_thought = "thinking_trace" in tags

                        if is_thought:
                            step_id = active_step_by_node.get(node_name)
                            if step_id:
                                thought_by_step_id[step_id] = thought_by_step_id.get(step_id, "") + output.content
                            # 对于 generate 节点：思考内容就是文档内容，不跳过
                            if node_name != "generate":
                                continue

                        # 对于 generate 节点，总是在结束时输出内容（补救机制）
                        # 因为 generate 节点使用同步 invoke，不会产生 on_chat_model_stream 事件
                        if node_name == "generate":
                            generate_tokens_emitted = True
                            accumulated_generate_content += output.content
                            logger.debug(f"[on_chat_model_end] Sending token for generate node, content_length={len(output.content)}")
                            yield _sse("token", {
                                "content": output.content,
                                "node": node_name,
                                "timestamp": import_time()
                            })
                        elif node_name in user_visible_nodes:
                            yield _sse("token", {
                                "content": output.content,
                                "node": node_name,
                                "timestamp": import_time()
                            })

            # --- 场景 3: Timeline 步骤开始 ---
            elif kind == "on_chain_start" and name in timeline_titles:
                active_step_by_node[name] = run_id
                current_active_step_id = run_id

                # 跟踪 auditor 节点的执行次数
                if name == "auditor":
                    auditor_execution_count += 1
                    logger.debug(f"[workflow_api] Auditor execution count: {auditor_execution_count}/{MAX_AUDIT_LOOPS}")

                # 每次 generate 节点重新开始时，重置 token 发送标记
                if name == "generate":
                    generate_tokens_emitted = False

                step_start_times[run_id] = import_time()
                
                step_payload = {
                    "id": run_id,
                    "title": timeline_titles[name],
                    "status": "in_progress",
                    "node": name,
                    "timestamp": step_start_times[run_id]
                }
                last_step_status[run_id] = "in_progress"
                yield _sse("timeline_step", step_payload)

            # --- 场景 4: Timeline 步骤完成 ---
            elif kind == "on_chain_end" and name in timeline_titles:
                if last_step_status.get(run_id) == "completed":
                    continue

                thought = _extract_user_facing_thought(thought_by_step_id.get(run_id, ""))

                # 补救机制：generate 节点结束时，如果没有发送过任何 token，
                # 说明所有内容都在思考链中，需要将原始思考内容作为 token 发送
                if name == "generate" and not generate_tokens_emitted:
                    raw_thought = thought_by_step_id.get(run_id, "")
                    if raw_thought:
                        logger.info(f"[on_chain_end] Generate node fallback: emitting raw thought as token, length={len(raw_thought)}")
                        yield _sse("token", {
                            "content": raw_thought,
                            "node": "generate",
                            "timestamp": import_time()
                        })
                        accumulated_generate_content += raw_thought
                        generate_tokens_emitted = True
                
                # 计算耗时
                start_time = step_start_times.get(run_id)
                duration = None
                if start_time:
                    duration = import_time() - start_time
                    del step_start_times[run_id]

                payload = {
                    "id": run_id,
                    "status": "completed",
                    "node": name,
                    "timestamp": import_time(),
                    "duration": duration
                }
                if thought:
                    payload["thought"] = thought

                last_step_status[run_id] = "completed"
                yield _sse("timeline_step", payload)

                # 特殊处理：Auditor 节点完成时，提取并发送校验结果
                if name == "auditor":
                    output = data.get("output")
                    if output:
                        auditor_content = ""
                        if isinstance(output, dict) and "messages" in output:
                            messages = output["messages"]
                            for msg in reversed(messages):
                                if hasattr(msg, "content") and msg.content:
                                    auditor_content = msg.content
                                    break

                        if auditor_content:
                            result = _parse_auditor_result(auditor_content)
                            result_payload = {
                                "step_id": run_id,
                                "type": result["type"],
                                "message": result["message"],
                                "timestamp": import_time()
                            }
                            if result["suggestions"]:
                                result_payload["suggestions"] = result["suggestions"]

                            yield _sse("step_result", result_payload)

            # --- 场景 5: 工具调用开始 ---
            elif kind == "on_tool_start":
                tool_name = name
                step_id = current_active_step_id
                if not step_id:
                    continue

                tool_input = data.get("input", {})
                tool_start_times[run_id] = import_time()

                tool_payload = {
                    "step_id": step_id,
                    "tool_id": run_id,
                    "name": tool_name,
                    "display_name": tool_display_names.get(tool_name, tool_name),
                    "args": tool_input,
                    "status": "running",
                    "timestamp": tool_start_times[run_id]
                }
                yield _sse("tool_call", tool_payload)

            # --- 场景 6: 工具调用结束 ---
            elif kind == "on_tool_end":
                tool_name = name
                step_id = current_active_step_id
                if not step_id:
                    continue

                output_data = data.get("output", "")
                if hasattr(output_data, "content"):
                    tool_output = output_data.content
                elif isinstance(output_data, str):
                    tool_output = output_data
                else:
                    tool_output = str(output_data)

                start_time = tool_start_times.get(run_id)
                duration = None
                if start_time:
                    duration = import_time() - start_time
                    del tool_start_times[run_id]

                result_summary = _summarize_tool_result(tool_name, tool_output)

                tool_payload = {
                    "step_id": step_id,
                    "tool_id": run_id,
                    "name": tool_name,
                    "status": "completed",
                    "result": result_summary,
                    "duration": duration,
                    "timestamp": import_time()
                }
                yield _sse("tool_call", tool_payload)

            # --- 场景 7: 错误处理 ---
            elif kind == "on_chain_error":
                error_info = data.get("error", "Unknown error")
                step_id = active_step_by_node.get(name)
                if step_id and last_step_status.get(step_id) != "failed":
                    last_step_status[step_id] = "failed"
                    yield _sse("timeline_step", {
                        "id": step_id,
                        "status": "failed",
                        "error": str(error_info),
                        "timestamp": import_time()
                    })

    except StopAsyncIteration:
        # 异步迭代器正常结束，不需要报错
        logger.info("Async event stream completed normally (StopAsyncIteration)")
    except Exception as e:
        # 检查是否是 LangGraph 内部的 StopAsyncIteration 异常
        error_str = str(e)
        if "StopAsyncIteration" in error_str or "anext" in error_str:
            logger.warning(f"Async event stream interrupted: {error_str}")
            # 这是一个已知的 LangGraph 异步流中断问题，不需要向前端报错
        else:
            # 打印错误堆栈到控制台
            traceback.print_exc()
            # 发送结构化错误事件
            error_data = _format_error_message(e)
            yield _sse("error", error_data)

    # 引用检测：如果启用引用标记且生成内容中包含 [ID:xxx]，发送引用元数据事件
    if enable_citation and accumulated_generate_content and re.search(r"\[ID:[ 0-9]+\]", accumulated_generate_content):
        ref_pool = get_reference_pool()
        if ref_pool and ref_pool.get("chunks"):
            # 转换为前端期望的格式
            chunk_reference = list(ref_pool["chunks"].values())
            # doc_aggs 按 count 降序排列（最相关的文档排在前面）
            doc_aggs = sorted(
                ref_pool.get("doc_aggs", {}).values(),
                key=lambda x: x.get("count", 0),
                reverse=True
            )
            logger.info(f"[Citation] Detected citations in output, sending {len(chunk_reference)} chunks, {len(doc_aggs)} docs")
            yield _sse("reference", {
                "chunk_reference": chunk_reference,
                "doc_aggs": doc_aggs,
            })
        else:
            logger.warning("[Citation] Citations detected in output but reference pool is empty")

    # 发送结束事件
    yield _sse("done", {"timestamp": import_time()})

# =============================================================================
# API 端点
# =============================================================================

class WorkflowBatchRequest(BaseModel):
    """批量生成请求"""
    message: str
    project_id: Optional[str] = None
    template: Optional[str] = None
    project_info: Optional[str] = None
    user_id: Optional[str] = "default_user"

    # 新增字段：支持 Langfuse session 追踪
    document_id: Optional[str] = None  # 文档 ID（用作 thread_id/session_id）
    chapter_name: Optional[str] = None  # 当前生成的章节名称

    # 补充要求（用于记忆保存）
    additional_requirements: Optional[str] = None  # 用户输入的补充要求，直接保存为记忆

    # 标签字段：用于动态知识库选择
    profession_tag_id: Optional[int] = None  # 专业标签 ID
    business_type_tag_id: Optional[int] = None  # 业态标签 ID


@workflow_router.post("/chat/batch")
async def workflow_chat_batch(request: WorkflowBatchRequest, http_request: Request):
    """
    批量生成接口（非流式）
    不显示执行过程，直接返回生成结果
    """
    # 优先使用 JWT 中的 user_id（与 memory list API 一致），否则回退到请求体中的 user_id
    jwt_user_id = getattr(http_request.state, "user_id", None)
    memory_user_id = str(jwt_user_id) if jwt_user_id else request.user_id
    logger.info(f"[workflow_chat_batch] 请求收到: message={request.message[:50]}..., user_id={request.user_id}, jwt_user_id={jwt_user_id}, document_id={request.document_id}, project_id={request.project_id}")

    if not request.message:
        return {"success": False, "error": "Message is required"}

    # 根据标签解析知识库 ID 并设置到请求级 context
    kb_config = resolve_kb(request.profession_tag_id, request.business_type_tag_id)
    logger.info(f"[workflow_chat_batch] KB 解析结果: source={kb_config['source']}, case={kb_config['case_kb_ids']}, standard={kb_config['standard_kb_ids']}")
    set_request_kb_ids(kb_config["case_kb_ids"], kb_config["standard_kb_ids"])

    try:
        # 生成 thread_id（优先使用 document_id，确保同一文档的所有章节共享 Session）
        thread_id = generate_thread_id(request.user_id, request.document_id or request.project_id)
        logger.info(f"[workflow_chat_batch] Using thread_id for session: {thread_id}")

        # 创建 Langfuse handler（即使是批量接口也需要 tracing）
        langfuse_handler, langfuse_metadata = get_langfuse_handler(
            user_id=request.user_id,
            session_id=thread_id,
            metadata={
                "document_id": request.document_id or request.project_id,
                "chapter_name": request.chapter_name,
                "project_id": request.project_id,
                "batch_mode": True,
                "kb_source": kb_config["source"],
            }
        )

        # 记忆召回：将相关记忆注入到 project_info 中
        enriched_project_info = request.project_info or ""
        recalled_memories = []
        try:
            enriched_project_info, recalled_memories = _inject_recalled_memories(
                user_id=memory_user_id,
                project_info=enriched_project_info,
                chapter_name=request.chapter_name,
            )
        except Exception as e:
            logger.warning(f"Memory recall failed (non-fatal): {e}")

        # 调用批量生成，传入 langfuse_handler、metadata 和 thread_id
        result = await generate_chapter_batch(
            message=request.message,
            template=request.template or "",
            project_info=enriched_project_info,
            project_id=request.project_id or "",
            user_id=request.user_id,
            langfuse_handler=langfuse_handler,
            langfuse_metadata=langfuse_metadata,
            thread_id=thread_id,  # 传递 thread_id 以支持 Langfuse session
            # Prompt 路由所需的标签
            profession_tag_id=request.profession_tag_id or 0,
            business_type_tag_id=request.business_type_tag_id or 0,
            chapter_name=request.chapter_name or "",
        )

        # 刷新 Langfuse 数据
        try:
            from langfuse import Langfuse
            langfuse_client = Langfuse()
            langfuse_client.flush()
        except Exception as e:
            logger.warning(f"Failed to flush Langfuse data: {e}")

        # 记忆写入：保存用户的补充要求
        try:
            _save_requirement_memory(
                user_id=memory_user_id,
                additional_requirements=request.additional_requirements,
                chapter_name=request.chapter_name,
            )
        except Exception as e:
            logger.warning(f"Memory save failed (non-fatal): {e}")

        # 附加召回的记忆到结果中
        if isinstance(result, dict):
            result["recalled_memories"] = recalled_memories

        return result
    finally:
        clear_request_kb_ids()


@workflow_router.post("/chat/stream")
async def workflow_chat_stream(request: WorkflowChatRequest, http_request: Request):
    """
    流式对话接口 - 支持记忆功能
    """
    # 优先使用 JWT 中的 user_id（与 memory list API 一致），否则回退到请求体中的 user_id
    jwt_user_id = getattr(http_request.state, "user_id", None)
    memory_user_id = str(jwt_user_id) if jwt_user_id else request.user_id
    logger.info(f"[workflow_chat_stream] 请求收到: message={request.message[:50]}..., user_id={request.user_id}, jwt_user_id={jwt_user_id}, document_id={request.document_id}")

    if not request.message:
        return {"error": "Message is required"}

    # 1. 生成 thread_id（基于 document_id）
    thread_id = generate_thread_id(request.user_id, request.document_id or request.project_id)
    logger.info(f"[workflow_chat_stream] Using thread_id: {thread_id}, resume_session: {request.resume_session}")

    # 2. 创建 Langfuse CallbackHandler
    langfuse_handler, langfuse_metadata = get_langfuse_handler(
        user_id=request.user_id,
        session_id=thread_id,
        metadata={
            "document_id": request.document_id or request.project_id,
            "chapter_name": request.chapter_name,
            "enable_audit": request.enable_audit,
            "resume_session": request.resume_session,
        }
    )

    # 3. 配置 LangGraph（包含 thread_id、callbacks 和 metadata）
    config = {
        "configurable": {
            "thread_id": thread_id,
        },
        "callbacks": [langfuse_handler],
        "metadata": langfuse_metadata,
        "tags": ["construction_agent", "document_generation"]
    }

    # 4. 记忆过滤参数：memory_window 重定义为天数限制，memory_chapters 为章节过滤
    days_limit = request.memory_window  # 重定义：天数限制（而非对话轮数）
    chapter_filter = request.memory_chapters

    # 准备输入参数
    # 章节模板：后续需从模板中获取 template_id + chapter_name
    template = request.template or ""

    # 项目信息： 从请求中获取，或使用默认值
    project_info = request.project_info or ""

    # 记忆召回：将相关记忆注入到 project_info 中，并获取召回列表
    recalled_memories = []
    try:
        project_info, recalled_memories = _inject_recalled_memories(
            user_id=memory_user_id,
            project_info=project_info,
            chapter_name=request.chapter_name,
            chapter_names=chapter_filter,
            days_limit=days_limit,
        )
    except Exception as e:
        logger.warning(f"Memory recall failed (non-fatal): {e}")

    # 根据标签解析知识库 ID 并设置到请求级 context
    kb_config = resolve_kb(request.profession_tag_id, request.business_type_tag_id)
    logger.info(f"[workflow_chat_stream] KB 解析结果: source={kb_config['source']}, case={kb_config['case_kb_ids']}, standard={kb_config['standard_kb_ids']}")
    set_request_kb_ids(kb_config["case_kb_ids"], kb_config["standard_kb_ids"])

    inputs = {
        "messages": [HumanMessage(content=request.message)],
        "template": template,
        "project_info": project_info,
        "project_id": request.project_id or "",
        "user_id": request.user_id,
        "intent": "",
        "retrieved_context": "",
        "draft_content": "",
        "audit_feedback": "",
        "research_loop_count": 0,
        "audit_loop_count": 0,
        "auditor_tool_call_count": 0,  # 防止 Auditor 工具调用无限循环
        "enable_audit": request.enable_audit,
        "enable_citation": request.enable_citation,
        # Prompt 路由所需的标签
        "profession_tag_id": request.profession_tag_id or 0,
        "business_type_tag_id": request.business_type_tag_id or 0,
        "chapter_name": request.chapter_name or "",
    }

    logger.info("[workflow_chat_stream] 开始流式响应")

    async def stream_with_memory():
        """包装 event_generator，在流开始前发送记忆召回事件，结束后保存记忆并清理请求级知识库"""
        try:
            # 发送召回的记忆事件
            if recalled_memories:
                yield _sse("memory_recalled", {"memories": recalled_memories})

            # 主事件流
            async for chunk in event_generator(inputs, config):
                yield chunk

            # 流结束后保存记忆
            try:
                _save_requirement_memory(
                    user_id=memory_user_id,
                    additional_requirements=request.additional_requirements,
                    chapter_name=request.chapter_name,
                )
            except Exception as e:
                logger.warning(f"Memory save failed in stream (non-fatal): {e}")
        finally:
            clear_request_kb_ids()

    return StreamingResponse(
        stream_with_memory(),
        media_type="text/event-stream",
        headers={
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            # HTTP/2 兼容性：禁用 gzip 压缩，避免缓冲
            'Content-Encoding': 'identity',
            # 防止代理/CDN 缓存
            'Pragma': 'no-cache',
            'Expires': '0',
        }
    )
