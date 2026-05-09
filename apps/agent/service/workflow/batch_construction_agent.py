"""
批量建筑施工文档生成 Agent
基于 LangGraph 实现，不需要流式输出和执行过程显示
"""
import os
import sys
from typing import List
try:
    from typing import TypedDict, Annotated
except ImportError:
    from typing_extensions import TypedDict, Annotated
from dotenv import load_dotenv
from langchain_community.chat_models import ChatTongyi
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage, ToolMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# 导入自定义工具和日志
from service.tools.construction_tools import retrieve_case, retrieve_standard
from service.utils.prompt_builder import PromptBuilder
from service.utils.token_counter import get_token_counter, count_tokens, truncate_text, calculate_available_tokens
from utils.logger import get_logger

# =============================================================================
# 1. 环境配置与初始化
# =============================================================================

load_dotenv()
logger = get_logger('batch_construction_agent')

# Token 限制配置（使用 TokenCounter 进行精确计算）
token_counter = get_token_counter()
MAX_TOTAL_TOKENS = token_counter.get_token_limit()
MAX_TOOL_MESSAGES = int(os.getenv('MAX_TOOL_MESSAGES', '30'))

# 为了向后兼容，保留字符数估算（仅用于日志显示）
MAX_TOTAL_CHARS = MAX_TOTAL_TOKENS // 2

# Researcher 循环控制配置
MAX_RESEARCH_LOOPS = int(os.getenv('MAX_RESEARCH_LOOPS', '3'))
MIN_CONTENT_THRESHOLD = int(os.getenv('MIN_CONTENT_THRESHOLD', '1000'))

logger.info("Initializing Batch Construction Agent...")

# 初始化 LLM (不使用 streaming)
llm = ChatTongyi(
    model="qwen-max",
    temperature=0.1,
    streaming=False,
)

# =============================================================================
# 2. 状态定义 (State)
# =============================================================================

class BatchAgentState(TypedDict):
    """批量生成的全局状态定义"""
    messages: Annotated[List[BaseMessage], add_messages]
    user_id: str
    project_id: str
    template: str
    project_info: str
    retrieved_context: str
    draft_content: str
    research_loop_count: int

    # Prompt 路由专用状态
    profession_tag_id: int       # 专业标签 ID（用于 Prompt 路由）
    business_type_tag_id: int   # 业态标签 ID
    chapter_name: str           # 当前章节名称


# =============================================================================
# 3. 辅助函数 (Helper Functions)
# =============================================================================

def evaluate_retrieval_quality(state: BatchAgentState) -> dict:
    """评估检索结果质量，判断是否应该停止循环"""
    messages = state["messages"]
    loop_count = state.get("research_loop_count", 0)

    tool_messages = [m for m in messages if isinstance(m, ToolMessage)]

    if not tool_messages:
        return {"should_stop": False, "reason": ""}

    recent_tools = tool_messages[-4:] if len(tool_messages) >= 4 else tool_messages

    # 检查是否有足够的内容
    total_content_length = sum(len(m.content) for m in recent_tools)
    if total_content_length > MIN_CONTENT_THRESHOLD * 2:
        return {
            "should_stop": True,
            "reason": f"检索内容充足（{total_content_length} 字符），提前退出"
        }

    # 检查连续空结果
    empty_results = sum(1 for m in recent_tools if "未检索到" in m.content)
    if empty_results >= 3 and loop_count >= 2:
        return {
            "should_stop": True,
            "reason": f"连续 {empty_results} 次检索失败，提前退出"
        }

    if len(recent_tools) >= 2:
        all_empty = all("未检索到" in m.content for m in recent_tools[-2:])
        if all_empty and loop_count >= 1:
            return {
                "should_stop": True,
                "reason": "最近两次检索均无结果，提前退出"
            }

    return {"should_stop": False, "reason": ""}


# =============================================================================
# 4. 节点定义 (Nodes)
# =============================================================================

# Researcher 节点（简化版，无流式输出）
researcher_tools = [retrieve_case, retrieve_standard]
researcher_llm = llm.bind_tools(researcher_tools)

def researcher_node(state: BatchAgentState):
    """
    Researcher 节点：负责检索案例和规范。
    简化版：直接执行，不进行流式输出。
    """
    project_info = state.get("project_info", "无具体项目信息")
    loop_count = state.get("research_loop_count", 0)

    logger.info(f"[Batch Researcher] Loop iteration: {loop_count + 1}/{MAX_RESEARCH_LOOPS}")

    # 根据循环次数生成动态引导语
    if loop_count == 0:
        loop_guidance = "这是第一次检索，请全面收集相关的案例和规范资料。"
    elif loop_count < MAX_RESEARCH_LOOPS - 1:
        loop_guidance = f"这是第{loop_count + 1}次检索，请补充缺失的关键信息。如果已有足够资料，请回复'资料收集完毕'。"
    else:
        loop_guidance = "⚠️ 这是最后一次检索机会。请务必回复'资料收集完毕'。"

    profession_tag_id = state.get("profession_tag_id", 0)
    chapter_name = state.get("chapter_name", "")
    builder = PromptBuilder(profession_tag_id=profession_tag_id, chapter_name=chapter_name)
    system_msg = builder.build_researcher(
        project_info=project_info,
        loop_count=loop_count + 1,
        max_loops=MAX_RESEARCH_LOOPS,
        loop_guidance=loop_guidance,
    )

    messages = state["messages"]
    if not isinstance(messages[0], SystemMessage) or "Researcher" not in str(messages[0].content):
        messages = [system_msg] + messages

    try:
        response = researcher_llm.invoke(messages)
    except Exception as e:
        logger.error(f"[Batch Researcher] API call failed: {type(e).__name__}: {str(e)}")
        response = AIMessage(content="资料收集完毕")

    return {
        "messages": [response],
        "research_loop_count": loop_count + 1
    }


def generate_node(state: BatchAgentState):
    """
    Generate 节点：核心生成节点。
    简化版：直接生成文档，不进行流式输出。
    """
    logger.info("[Batch Generate] Starting document generation...")
    messages = state["messages"]

    # 提取上下文
    context_pieces = []
    tool_message_count = 0

    for msg in reversed(messages):
        if isinstance(msg, ToolMessage):
            context_pieces.insert(0, msg.content)
            tool_message_count += 1
            if tool_message_count >= MAX_TOOL_MESSAGES:
                break

    context = "\n\n".join(context_pieces) if context_pieces else "无检索内容，请根据通用知识生成。"

    question = messages[0].content
    template = state.get("template", "")
    project_info = state.get("project_info", "")

    # 检测模板中是否有占位符（XX、XXX等），并进行预处理
    import re
    # 匹配各种占位符模式：XX、XXX、XXXX、____等
    placeholder_pattern = r'X{2,}|_{2,}'
    has_placeholder = bool(re.search(placeholder_pattern, template)) if template else False

    # 初始化 PromptBuilder（供后续 generate 调用）
    profession_tag_id = state.get("profession_tag_id", 0)
    chapter_name = state.get("chapter_name", "")
    builder = PromptBuilder(profession_tag_id=profession_tag_id, chapter_name=chapter_name)

    if has_placeholder:
        # 预处理模板，将所有占位符统一替换
        template = re.sub(r'X{2,}', '[需填写具体数值]', template)
        template = re.sub(r'_{2,}', '[需填写具体数值]', template)

    # 智能长度控制：使用 TokenCounter 进行精确计算
    question_tokens = count_tokens(question)
    template_tokens = count_tokens(template)
    project_info_tokens = count_tokens(project_info)
    
    PROMPT_TEMPLATE_OVERHEAD = 1000
    RESPONSE_RESERVE = 2000

    available_tokens = calculate_available_tokens(
        question=question,
        template=template,
        project_info=project_info,
        prompt_overhead=PROMPT_TEMPLATE_OVERHEAD,
        response_reserve=RESPONSE_RESERVE
    )

    logger.info(
        f"[Batch Generate] Token allocation: question={question_tokens}, "
        f"template={template_tokens}, project_info={project_info_tokens}, "
        f"available_for_context={available_tokens} tokens"
    )

    if available_tokens < 1000:
        if project_info_tokens > 500:
            project_info = truncate_text(project_info, 500, preserve_end=False)
            project_info_tokens = count_tokens(project_info)
            available_tokens = calculate_available_tokens(
                question=question,
                template=template,
                project_info=project_info,
                prompt_overhead=PROMPT_TEMPLATE_OVERHEAD,
                response_reserve=RESPONSE_RESERVE
            )

    available_tokens = max(1000, available_tokens)

    context_tokens = count_tokens(context)
    if context_tokens > available_tokens:
        logger.warning(f"[Batch Generate] Context too long ({context_tokens} tokens), truncating to {available_tokens} tokens")
        context = truncate_text(context, available_tokens, preserve_end=True)

    try:
        full_prompt = builder.build_generate(
            context=context,
            question=question,
            template=template,
            project_info=project_info,
        )

        full_prompt_tokens = count_tokens(full_prompt)
        if full_prompt_tokens > MAX_TOTAL_TOKENS - RESPONSE_RESERVE:
            logger.warning(f"[Batch Generate] Full prompt too long ({full_prompt_tokens} tokens), applying aggressive truncation.")
            max_allowed_tokens = MAX_TOTAL_TOKENS - RESPONSE_RESERVE
            excess_tokens = full_prompt_tokens - max_allowed_tokens
            min_context_tokens = 1000
            current_context_tokens = count_tokens(context)
            new_context_tokens = max(min_context_tokens, current_context_tokens - excess_tokens - 200)
            context = truncate_text(context, new_context_tokens, preserve_end=True)
            full_prompt = builder.build_generate(
                context=context,
                question=question,
                template=template,
                project_info=project_info,
            )
            final_tokens = count_tokens(full_prompt)
            logger.info(f"[Batch Generate] Final prompt length: {final_tokens} tokens")

    except Exception as e:
        logger.error(f"[Batch Generate] Failed to compile prompt: {e}", exc_info=True)
        return {"messages": [AIMessage(content=f"生成出错: {str(e)}")]}

    try:
        response = llm.invoke([HumanMessage(content=full_prompt)])
    except ValueError as e:
        if "Range of input length" in str(e):
            current_tokens = count_tokens(full_prompt)
            error_msg = f"输入内容过长，已超过模型限制。当前长度: {current_tokens} tokens ({len(full_prompt)} 字符)"
            logger.error(f"[Batch Generate] Input length exceeded: {error_msg}")
            return {"messages": [AIMessage(content=error_msg)]}
        else:
            raise
    except Exception as e:
        logger.error(f"[Batch Generate] Unexpected error: {e}", exc_info=True)
        raise

    # 后处理：将残留的各种占位符替换为[待填写]
    final_content = response.content

    # 使用正则表达式替换各种占位符模式
    import re
    # 替换 XX、XXX、XXXX 等
    final_content = re.sub(r'X{2,}', '[待填写]', final_content)
    # 替换 __、___、____ 等
    final_content = re.sub(r'_{2,}', '[待填写]', final_content)
    # 替换 [需填写具体数值] 为更简洁的形式
    final_content = final_content.replace('[需填写具体数值]', '[待填写]')

    if final_content != response.content:
        logger.info("[Batch Generate] Post-processed: replaced residual placeholders with [待填写]")

    # 更新response的content
    response.content = final_content

    logger.info("[Batch Generate] Document generation completed successfully")
    return {
        "messages": [response],
        "draft_content": final_content
    }


# =============================================================================
# 5. 条件逻辑 (Conditional Logic)
# =============================================================================

def researcher_condition(state: BatchAgentState):
    """Researcher 循环控制逻辑"""
    last_msg = state["messages"][-1]
    loop_count = state.get("research_loop_count", 0)

    # 硬性限制
    if loop_count >= MAX_RESEARCH_LOOPS:
        logger.warning(f"[Batch Researcher] Reached max loops ({MAX_RESEARCH_LOOPS}), forcing exit")
        return "generate"

    # 质量评估
    quality_check = evaluate_retrieval_quality(state)
    if quality_check["should_stop"]:
        logger.info(f"[Batch Researcher] Quality check triggered early exit: {quality_check['reason']}")
        return "generate"

    # LLM 判断
    if last_msg.tool_calls:
        return "researcher_tools"

    return "generate"


# =============================================================================
# 6. 图构建 (Graph Construction)
# =============================================================================

workflow = StateGraph(BatchAgentState)

# 添加节点
workflow.add_node("researcher", researcher_node)
workflow.add_node("researcher_tools", ToolNode(researcher_tools))
workflow.add_node("generate", generate_node)

# 设置入口点
workflow.set_entry_point("researcher")

# Researcher 循环
workflow.add_conditional_edges(
    "researcher",
    researcher_condition,
    {
        "researcher_tools": "researcher_tools",
        "generate": "generate"
    }
)
workflow.add_edge("researcher_tools", "researcher")

# Generate 完成后结束
workflow.add_edge("generate", END)

# 编译图
batch_app = workflow.compile()


# =============================================================================
# 7. 对外接口函数
# =============================================================================

async def generate_chapter_batch(
    message: str,
    template: str = "",
    project_info: str = "",
    project_id: str = "",
    user_id: str = "default_user",
    langfuse_handler = None,
    langfuse_metadata: dict = None,
    thread_id: str = None,
    profession_tag_id: int = 0,
    business_type_tag_id: int = 0,
    chapter_name: str = ""
) -> dict:
    """
    批量生成章节内容（非流式）

    Args:
        message: 用户输入的章节生成请求
        template: 章节模板
        project_info: 项目信息
        project_id: 项目ID
        user_id: 用户ID
        langfuse_handler: Langfuse callback handler for tracing
        langfuse_metadata: Metadata including user_id and session_id for Langfuse
        thread_id: Thread ID for session tracking (required for Langfuse session)
        profession_tag_id: 专业标签 ID（用于 Prompt 路由）
        business_type_tag_id: 业态标签 ID
        chapter_name: 当前章节名称

    Returns:
        dict: 包含生成结果的字典
            - success: bool
            - content: str (生成的内容)
            - error: str (错误信息，仅在失败时存在)
    """
    inputs = {
        "messages": [HumanMessage(content=message)],
        "template": template,
        "project_info": project_info,
        "project_id": project_id,
        "user_id": user_id,
        "retrieved_context": "",
        "draft_content": "",
        "research_loop_count": 0,
        # Prompt 路由字段
        "profession_tag_id": profession_tag_id,
        "business_type_tag_id": business_type_tag_id,
        "chapter_name": chapter_name,
    }

    # 准备 config，包含 langfuse_handler、metadata 和 thread_id
    config = {}

    # 设置 thread_id（用于 Langfuse session 关联）
    if thread_id:
        config["configurable"] = {"thread_id": thread_id}

    if langfuse_handler:
        config["callbacks"] = [langfuse_handler]
        if langfuse_metadata:
            config["metadata"] = langfuse_metadata
            config["tags"] = ["construction_agent", "document_generation", "batch"]

    try:
        logger.info(f"[Batch] Starting batch generation for message: {message[:50]}...")
        if thread_id:
            logger.info(f"[Batch] Using thread_id for session tracking: {thread_id}")

        # 使用 ainvoke 异步执行（非流式），传入 config
        result = await batch_app.ainvoke(inputs, config=config)

        # 提取最终生成的内容
        draft_content = result.get("draft_content", "")

        if not draft_content:
            # 如果 draft_content 为空，尝试从最后一条消息中获取
            messages = result.get("messages", [])
            for msg in reversed(messages):
                if isinstance(msg, AIMessage) and msg.content:
                    draft_content = msg.content
                    break

        logger.info(f"[Batch] Generation completed, content length: {len(draft_content)}")

        return {
            "success": True,
            "content": draft_content
        }

    except Exception as e:
        logger.error(f"[Batch] Generation failed: {type(e).__name__}: {str(e)}", exc_info=True)
        return {
            "success": False,
            "content": "",
            "error": str(e)
        }