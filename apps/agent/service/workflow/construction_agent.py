"""
建筑施工文档生成 ReAct Agent
基于 LangGraph 实现多节点状态机工作流
"""
import os
import datetime
import sys
import re
import operator
from typing import TypedDict, Annotated, List
from dotenv import load_dotenv
from langchain_community.chat_models import ChatTongyi
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import StateGraph, END, START
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langchain_community.tools import DuckDuckGoSearchRun
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg_pool import ConnectionPool

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# 导入自定义工具和日志
from service.tools.construction_tools import retrieve_case, retrieve_standard
from service.utils.prompt_builder import PromptBuilder
from service.utils.token_counter import get_token_counter, count_tokens, truncate_text, calculate_available_tokens
from service.utils.citation_prompt import get_citation_prompt
from utils.logger import get_logger

# =============================================================================
# 1. 环境配置与初始化
# =============================================================================

load_dotenv()
logger = get_logger('construction_agent')

# Token 限制配置（使用 TokenCounter 进行精确计算）
# 获取当前模型的 token 限制
token_counter = get_token_counter()
MAX_TOTAL_TOKENS = token_counter.get_token_limit()
MAX_TOOL_MESSAGES = int(os.getenv('MAX_TOOL_MESSAGES', '30'))  # 上下文中最多保留的 ToolMessage 数量

# 为了向后兼容，保留字符数估算（仅用于日志显示）
MAX_TOTAL_CHARS = MAX_TOTAL_TOKENS // 2  # 约 15000 字符（保守估计）

# Researcher 循环控制配置
MAX_RESEARCH_LOOPS = int(os.getenv('MAX_RESEARCH_LOOPS', '3'))  # Researcher 最大循环次数（硬性上限）
MIN_CONTENT_THRESHOLD = int(os.getenv('MIN_CONTENT_THRESHOLD', '1000'))  # 检索内容最小阈值（字符数）

# Auditor 循环控制配置
MAX_AUDIT_LOOPS = int(os.getenv('MAX_AUDIT_LOOPS', '1'))  # Auditor 最大循环次数（硬性上限）
MAX_AUDITOR_TOOL_CALLS = int(os.getenv('MAX_AUDITOR_TOOL_CALLS', '5'))  # Auditor 工具调用最大次数（防止无限循环）

logger.info("Initializing Construction Agent...")

# 初始化 PostgreSQL Checkpointer
def get_checkpointer():
    """
    获取 PostgreSQL Checkpointer 实例
    用于持久化 LangGraph 对话状态

    注意：当前版本的 langgraph-checkpoint-postgres (3.0.3) 的 aget_tuple 方法
    未实现异步支持，会导致 astream_events 调用失败。
    临时禁用 checkpointer，使用内存模式。
    """
    # 临时禁用 PostgreSQL checkpointer，避免 aget_tuple NotImplementedError
    logger.warning("PostgreSQL Checkpointer temporarily disabled due to async compatibility issues")
    logger.warning("Memory persistence is disabled - conversations will not be saved")
    return None

    # 以下代码在 LangGraph 版本升级后可以重新启用
    # postgres_url = os.getenv('POSTGRES_URL')
    # if not postgres_url:
    #     logger.warning("POSTGRES_URL not set, memory persistence disabled")
    #     return None

    # try:
    #     # 创建连接池
    #     connection_pool = ConnectionPool(
    #         conninfo=postgres_url,
    #         max_size=20,
    #         kwargs={
    #             "autocommit": True,
    #             "prepare_threshold": 0,
    #         }
    #     )

    #     # 创建 PostgresSaver
    #     checkpointer = PostgresSaver(connection_pool)

    #     # 初始化数据库表（如果不存在）
    #     checkpointer.setup()

    #     logger.info("PostgreSQL Checkpointer initialized successfully")
    #     return checkpointer
    # except Exception as e:
    #     logger.error(f"Failed to initialize PostgreSQL Checkpointer: {e}")
    #     logger.warning("Falling back to in-memory checkpointer (no persistence)")
    #     return None

# 初始化 LLM (使用 Dashscope/Tongyi)
llm = ChatTongyi(
    model="qwen-max",
    temperature=0.1,
)

# =============================================================================
# 2. 状态定义 (State)
# =============================================================================

class AgentState(TypedDict):
    """
    LangGraph 的全局状态定义
    """
    messages: Annotated[List[BaseMessage], add_messages]  # 聊天记录，支持追加
    user_id: str
    project_id: str  # 项目 ID
    intent: str      # 路由意图: 'generate_doc' 或 'general_chat'
    template: str    # 文档模版
    project_info: str  # 项目信息

    # 文档生成子图专用状态
    retrieved_context: str  # 检索到的上下文
    draft_content: str      # 生成的草稿
    audit_feedback: str     # 校验反馈意见
    research_loop_count: int  # 记录 Researcher 循环次数
    audit_loop_count: int     # 记录 Auditor 循环次数
    auditor_tool_call_count: int  # 记录 Auditor 工具调用次数（防止无限循环）
    enable_audit: bool        # 是否启用 Auditor 校验（默认 False）
    enable_citation: bool     # 是否启用引用标记（默认 True）

    # Prompt 路由专用状态
    profession_tag_id: int       # 专业标签 ID（用于 Prompt 路由）
    business_type_tag_id: int   # 业态标签 ID
    chapter_name: str           # 当前章节名称


# =============================================================================
# 3. 辅助函数 (Helper Functions)
# =============================================================================

def extract_previous_chapters(messages: List[BaseMessage]) -> List[dict]:
    """
    从对话历史中提取已生成的章节
    用于章节关联和去重

    Args:
        messages: 对话历史消息列表

    Returns:
        章节列表，每个章节包含 name, summary, full_content
    """
    chapters = []
    for msg in messages:
        if isinstance(msg, AIMessage) and msg.content:
            # 检查是否包含章节标题（以 ## 开头）
            if "## " in msg.content or "# " in msg.content:
                # 提取章节标题
                lines = msg.content.split('\n')
                chapter_name = ""
                for line in lines:
                    if line.strip().startswith("## ") or line.strip().startswith("# "):
                        chapter_name = line.strip().lstrip("#").strip()
                        break

                if chapter_name:
                    # 提取摘要（前200字）
                    chapter_summary = msg.content[:200].replace('\n', ' ')
                    chapters.append({
                        "name": chapter_name,
                        "summary": chapter_summary,
                        "full_content": msg.content
                    })

    return chapters


def find_related_chapters(current_chapter: str, previous_chapters: List[dict]) -> List[dict]:
    """
    找到与当前章节相关的历史章节
    基于关键词匹配

    Args:
        current_chapter: 当前章节名称
        previous_chapters: 历史章节列表

    Returns:
        相关章节列表
    """
    # 定义章节关联规则（可根据实际需求扩展）
    keywords_map = {
        "防水": ["墙体", "屋面", "地下室", "基础", "外墙"],
        "电气": ["照明", "配电", "弱电", "消防"],
        "暖通": ["空调", "通风", "采暖", "防排烟"],
        "给排水": ["给水", "排水", "消防", "卫生"],
        "装饰": ["墙面", "地面", "吊顶", "门窗"],
        "结构": ["基础", "墙体", "楼板", "梁柱"],
    }

    related = []
    current_lower = current_chapter.lower()

    # 查找关联关键词
    for keyword, related_keywords in keywords_map.items():
        if keyword in current_lower:
            # 在历史章节中查找包含相关关键词的章节
            for chapter in previous_chapters:
                chapter_name_lower = chapter["name"].lower()
                if any(rk in chapter_name_lower for rk in related_keywords):
                    if chapter not in related:
                        related.append(chapter)

    return related


def format_related_chapters(related_chapters: List[dict]) -> str:
    """
    格式化相关章节信息，用于添加到生成上下文中

    Args:
        related_chapters: 相关章节列表

    Returns:
        格式化后的章节摘要文本
    """
    if not related_chapters:
        return "无相关章节"

    formatted = []
    for i, chapter in enumerate(related_chapters, 1):
        formatted.append(f"{i}. **{chapter['name']}**")
        formatted.append(f"   摘要: {chapter['summary'][:150]}...")
        formatted.append("")

    return "\n".join(formatted)


def evaluate_retrieval_quality(state: AgentState) -> dict:
    """
    评估检索结果质量，判断是否应该停止循环

    Returns:
        dict: {
            "should_stop": bool,  # 是否应该停止
            "reason": str         # 停止原因
        }
    """
    messages = state["messages"]
    loop_count = state.get("research_loop_count", 0)

    # 统计 ToolMessage
    tool_messages = [m for m in messages if isinstance(m, ToolMessage)]

    if not tool_messages:
        return {"should_stop": False, "reason": ""}

    # 检查最近的检索结果（最近4条工具消息）
    recent_tools = tool_messages[-4:] if len(tool_messages) >= 4 else tool_messages

    # 1. 检查是否有足够的内容
    total_content_length = sum(len(m.content) for m in recent_tools)
    if total_content_length > MIN_CONTENT_THRESHOLD * 2:  # 如果内容充足
        return {
            "should_stop": True,
            "reason": f"检索内容占用了（{total_content_length} 字符），提前退出"
        }

    # 2. 检查连续空结果（"未检索到"）
    empty_results = sum(1 for m in recent_tools if "未检索到" in m.content)
    if empty_results >= 3 and loop_count >= 2:
        return {
            "should_stop": True,
            "reason": f"连续 {empty_results} 次检索失败，提前退出"
        }

    # 3. 检查是否所有检索都返回空结果
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

def router_node(state: AgentState):
    """
    路由节点：判断用户意图，决定进入哪个分支。
    """
    messages = state["messages"]
    system_msg = SystemMessage(content="""你是一个意图分类器。
    如果用户想要生成、编写、创建施工文档或章节，请返回 'generate_doc'。
    其他情况（闲聊、查天气、单独查规范、查询信息）请返回 'general_chat'。
    只返回这两个字符串之一，不要有其他内容。""")

    # 使用最近的几条消息进行判断
    response = llm.invoke([system_msg] + messages[-3:])

    intent = response.content.strip().replace("'", "").replace('"', "")
    if "generate_doc" in intent:
        intent = "generate_doc"
    else:
        intent = "general_chat"

    logger.info(f"[Router] Intent classified: {intent}")
    return {"intent": intent}

# --- General Agent Branch ---
general_tools = [DuckDuckGoSearchRun(), retrieve_case, retrieve_standard]
general_llm = llm.bind_tools(general_tools)

def general_agent_node(state: AgentState, config: RunnableConfig):
    """
    通用助手节点：处理闲聊或普通查询。
    采用两步执行策略以支持流式思考和工具调用。
    """
    messages = state["messages"]

    # --- 阶段 1: 思考 (Streaming) ---
    logger.debug("[General Agent] Starting thinking phase (streaming)")
    streaming_llm = ChatTongyi(model="qwen-max", temperature=0.1, streaming=True)

    system_msg = SystemMessage(content="""You are a helpful assistant.
    **Thinking Phase**:
    Please analyze the current situation and decide what to do (e.g., search for information, or answer directly).
    Output your Inner Monologue / Reasoning Trace.
    **DO NOT** output the final answer to the user here. Just the plan.
    """)

    # 临时构建消息历史用于思考
    thinking_messages = [system_msg] + [m for m in messages if not isinstance(m, SystemMessage)]

    # Add 'thinking_trace' tag to config for frontend visualization
    step1_config = config.copy() if config else {}
    step1_config.setdefault("tags", []).append("thinking_trace")

    thought_response = streaming_llm.invoke(thinking_messages, step1_config)

    # --- 阶段 2: 行动 (Non-Streaming) ---
    logger.debug("[General Agent] Starting action phase (non-streaming)")

    # 构造给带工具 LLM 的消息
    instruction = HumanMessage(content="""Based on the above thinking process, please execute the next step:
    1. If you need to ask the user for clarification (e.g., missing city for weather), output the question directly.
    2. If you need to use a tool, generate the tool call.
    3. If you have the answer, output it directly.
    DO NOT repeat the thinking process. Just output the response or tool call.""")

    messages_for_tool = messages + [thought_response, instruction]

    # IMPORTANT: pass config so LangGraph astream_events can observe this call
    response = general_llm.invoke(messages_for_tool, config)

    return {"messages": [thought_response, response]}

# --- DocGen Pipeline Branch ---

# 1. Researcher (信息收集)
researcher_tools = [retrieve_case, retrieve_standard]
researcher_llm = llm.bind_tools(researcher_tools)

def researcher_node(state: AgentState, config: RunnableConfig):
    """
    Researcher 节点：负责并行检索案例和规范。
    采用两步执行策略：
    1. 思考 (Streaming): 生成 Reasoning Trace，流式输出给前端。
    2. 行动 (Non-Streaming): 生成 Tool Calls，避免 ChatTongyi 流式工具调用 Bug。

    循环控制：
    - 最多循环 MAX_RESEARCH_LOOPS 次
    - 根据循环次数动态调整 Prompt 引导
    - 检测到连续空结果时提前退出
    """
    project_info = state.get("project_info", "无具体项目信息")
    loop_count = state.get("research_loop_count", 0)

    # 记录当前循环次数
    logger.info(f"[Researcher] Loop iteration: {loop_count + 1}/{MAX_RESEARCH_LOOPS}")

    # 根据循环次数生成动态引导语
    if loop_count == 0:
        loop_guidance = "这是第一次检索，请全面收集相关的案例和规范资料。"
    elif loop_count < MAX_RESEARCH_LOOPS - 1:
        loop_guidance = f"这是第{loop_count + 1}次检索，请补充缺失的关键信息。如果已有足够资料（即使不完美），请回复'资料收集完毕'。"
    else:
        loop_guidance = "⚠️ **重要提醒**：这是最后一次检索机会。请评估现有资料是否基本满足要求。如果已有相关内容，请务必回复'资料收集完毕'，避免过度追求完美而反复检索。"

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
    # 确保 SystemMessage 存在且是最新的
    if not isinstance(messages[0], SystemMessage) or "Researcher" not in str(messages[0].content):
        messages = [system_msg] + messages

    # --- 阶段 1: 思考 (Streaming) ---
    logger.debug("[Researcher] Starting thinking phase (streaming)")
    streaming_llm = ChatTongyi(model="qwen-max", temperature=0.1, streaming=True)

    # Add 'thinking_trace' tag
    step1_config = config.copy() if config else {}
    step1_config.setdefault("tags", []).append("thinking_trace")

    thought_response = streaming_llm.invoke(messages, step1_config)

    # --- 阶段 2: 行动 (Non-Streaming) ---
    logger.debug("[Researcher] Starting tool calling phase (non-streaming)")

    messages_for_tool = messages + [thought_response, HumanMessage(
        content="Based on your reasoning, if you need more information, generate the specific Tool Calls. If you have sufficient information, reply with '资料收集完毕'."
    )]

    # IMPORTANT: pass config so LangGraph astream_events can observe this call
    try:
        tool_response = researcher_llm.invoke(messages_for_tool, config)
    except Exception as e:
        logger.error(f"[Researcher] API call failed: {type(e).__name__}: {str(e)}")
        # 如果 API 调用失败，返回一个错误消息
        tool_response = AIMessage(content="资料收集完毕")
        logger.warning("[Researcher] Falling back to completion due to API error")

    # 更新循环计数器
    return {
        "messages": [thought_response, tool_response],
        "research_loop_count": loop_count + 1
    }

# 2. Generate (生成)
def generate_node(state: AgentState, config: RunnableConfig):
    """
    Generate Node: 核心生成节点。
    直接根据上下文和模版生成文档，不再通过 LLM 调用工具。
    增强版：支持章节关联和去重
    """
    logger.info("[Generate] Starting document generation...")
    messages = state["messages"]

    # 1. 提取已生成的章节（用于关联和去重）
    previous_chapters = extract_previous_chapters(messages)
    logger.info(f"[Generate] Found {len(previous_chapters)} previous chapters in history")

    # 2. 分析当前章节与历史章节的关联
    current_message = messages[0].content if messages else ""
    related_chapters = find_related_chapters(current_message, previous_chapters)
    logger.info(f"[Generate] Found {len(related_chapters)} related chapters")

    # 3. 提取上下文 (Context)
    context_pieces = []
    tool_message_count = 0

    # 从后往前遍历，优先保留最新的检索结果
    for msg in reversed(messages):
        if isinstance(msg, ToolMessage):
            context_pieces.insert(0, msg.content)
            tool_message_count += 1
            if tool_message_count >= MAX_TOOL_MESSAGES:
                break

    context = "\n\n".join(context_pieces) if context_pieces else "无检索内容，请根据通用知识生成。"

    # 4. 如果有相关章节，添加到上下文中
    if related_chapters:
        related_context = format_related_chapters(related_chapters)
        context = f"""## 已生成的相关章节摘要
        {related_context}

        ## 检索到的参考资料
        {context}"""
        logger.info(f"[Generate] Added {len(related_chapters)} related chapters to context")

    # 5. 提取其他参数
    question = messages[0].content
    template = state.get("template", "")
    project_info = state.get("project_info", "")

    # 6. 如果有历史章节，在问题中强调去重和关联
    if previous_chapters:
        chapter_names = [c['name'] for c in previous_chapters]
        dedup_instruction = f"""
        **重要提示（章节去重和关联）**：
        1. 本文档已生成以下章节：{', '.join(chapter_names[:5])}{'等' if len(chapter_names) > 5 else ''}
        2. 请避免与已生成章节重复，确保内容的独特性和互补性
        3. 如需引用其他章节内容，请明确标注引用关系（如"详见XX章节"）
        4. 确保内容逻辑一致性（如防水章节需结合墙体工程、屋面工程等相关内容）
        5. 数量声明必须与表格数据完全匹配，避免前后矛盾
        """
        question += dedup_instruction
        logger.info("[Generate] Added deduplication and correlation instructions")

    # 检测模板中是否有占位符（XX、XXX等），并进行预处理
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

    # 7. 检查是否有审核意见 (Feedback) - 优化检测逻辑，支持结构化反馈解析
    last_msg = messages[-1]
    if isinstance(last_msg, AIMessage):
        content_lower = last_msg.content.lower()
        feedback_content = last_msg.content

        # 检测多种反馈关键词
        feedback_keywords = ["revise", "修改", "调整", "必须修改", "建议优化", "不符合", "问题", "状态：revise"]
        has_feedback = any(kw in content_lower for kw in feedback_keywords)
        is_pass = "pass" in content_lower or "状态：pass" in feedback_content

        if has_feedback and not is_pass:
            logger.info(f"[Generate] Detected audit feedback, revising document")

            # 解析结构化反馈，提取关键修改项
            revision_instruction = "\n\n【重要：请根据以下审核意见修改文档】\n"

            # 提取"必须修改项"部分
            if "## 必须修改项" in feedback_content or "必须修改项" in feedback_content:
                revision_instruction += "⚠️ **必须修改的问题**：\n"

            # 特别强调逻辑一致性问题（泛化版本，适用于所有章节类型）
            if "逻辑一致性" in feedback_content or ("数量" in feedback_content and "表格" in feedback_content):
                revision_instruction += """
                ⚠️ **逻辑一致性修正要求**：
                - 文档开头的声明（数量、类型、范围）必须与后续详细内容/表格数据完全一致
                - 如果声明"无"或"0"，则必须删除对应的详细描述或选型表格
                - 如果声明具体数量（如"X台/X个/X处"），则表格中必须恰好有相应数量的行
                - 不能出现前后文自相矛盾的表述
                - 数量声明必须与表格数据完全匹配，不能有冗余表格或遗漏项
                """

            # 特别强调符号规范问题
            if "゜" in feedback_content or "符号" in feedback_content:
                revision_instruction += """
                ⚠️ **符号规范修正要求**：
                - 角度符号必须使用中文"°"，不能使用日文"゜"
                """

            revision_instruction += f"\n完整审核意见：\n{feedback_content}"
            question += revision_instruction

    # 8. 智能长度控制：使用 TokenCounter 进行精确计算
    # 使用 TokenCounter 计算各部分的 token 数
    question_tokens = count_tokens(question)
    template_tokens = count_tokens(template)
    project_info_tokens = count_tokens(project_info)
    
    # 估算 Prompt 模板本身的开销（系统提示词等）
    PROMPT_TEMPLATE_OVERHEAD = 1000  # 预留给 Prompt 模板的 token 空间
    RESPONSE_RESERVE = 2000  # 预留给模型响应的 token 空间

    # 计算剩余可用 token 数
    available_tokens = calculate_available_tokens(
        question=question,
        template=template, 
        project_info=project_info,
        prompt_overhead=PROMPT_TEMPLATE_OVERHEAD,
        response_reserve=RESPONSE_RESERVE
    )

    logger.info(
        f"[Generate] Token allocation: question={question_tokens}, "
        f"template={template_tokens}, project_info={project_info_tokens}, "
        f"available_for_context={available_tokens} tokens"
    )

    # 9. 根据可用 token 数截断 context
    context_tokens = count_tokens(context)
    
    if available_tokens < 1000:
        logger.warning(
            f"[Generate] Very limited tokens for context ({available_tokens} tokens). "
            f"Reducing other parameters."
        )
        # 如果空间不足，优先保证 context，适当截断其他参数
        if project_info_tokens > 500:
            project_info = truncate_text(project_info, 500, preserve_end=False)
            project_info_tokens = count_tokens(project_info)
            # 重新计算可用空间
            available_tokens = calculate_available_tokens(
                question=question,
                template=template,
                project_info=project_info,
                prompt_overhead=PROMPT_TEMPLATE_OVERHEAD,
                response_reserve=RESPONSE_RESERVE
            )

    # 确保 available_tokens 至少为正数
    available_tokens = max(1000, available_tokens)

    if context_tokens > available_tokens:
        logger.warning(
            f"[Generate] Context too long ({context_tokens} tokens), "
            f"truncating to {available_tokens} tokens"
        )
        # 保留最新的内容（从后面截取）
        context = truncate_text(context, available_tokens, preserve_end=True)

    # 10. 调用生成逻辑
    try:
        full_prompt = builder.build_generate(
            context=context,
            question=question,
            template=template,
            project_info=project_info,
        )

        # 追加引用规则提示词（仅在 enable_citation 开启时）
        enable_citation = state.get("enable_citation", True)
        if enable_citation:
            full_prompt += get_citation_prompt()

        # 最终安全检查：如果仍然超长，进行二次截断
        full_prompt_tokens = count_tokens(full_prompt)
        if full_prompt_tokens > MAX_TOTAL_TOKENS - RESPONSE_RESERVE:
            logger.warning(
                f"[Generate] Full prompt still too long ({full_prompt_tokens} tokens) "
                f"after first truncation. Applying aggressive truncation."
            )

            # 计算需要删减的 token 数
            max_allowed_tokens = MAX_TOTAL_TOKENS - RESPONSE_RESERVE
            excess_tokens = full_prompt_tokens - max_allowed_tokens

            # 更激进地截断 context（保留最后的内容，因为通常最新的检索结果最相关）
            min_context_tokens = 1000  # 至少保留 1000 tokens 的 context
            current_context_tokens = count_tokens(context)
            new_context_tokens = max(min_context_tokens, current_context_tokens - excess_tokens - 200)

            logger.warning(
                f"[Generate] Reducing context from {current_context_tokens} to {new_context_tokens} tokens"
            )

            context = truncate_text(context, new_context_tokens, preserve_end=True)

            # 重新编译
            full_prompt = builder.build_generate(
                context=context,
                question=question,
                template=template,
                project_info=project_info,
            )

            final_tokens = count_tokens(full_prompt)
            logger.info(f"[Generate] Final prompt length: {final_tokens} tokens ({len(full_prompt)} chars)")

    except Exception as e:
        logger.error(f"[Generate] Failed to compile prompt: {e}", exc_info=True)
        return {"messages": [AIMessage(content=f"生成出错: {str(e)}")]}

    streaming_llm = ChatTongyi(model="qwen-max", temperature=0.1, streaming=True)

    # print("="*80)
    # print(full_prompt)
    # print("="*80)

    try:
        # 使用 invoke 并传递 config，让 astream_events 捕获流式输出
        response = streaming_llm.invoke([HumanMessage(content=full_prompt)], config)
    except ValueError as e:
        if "Range of input length" in str(e):
            error_msg = (
                f"输入内容过长，已超过模型限制。\n"
                f"当前长度: {len(full_prompt)} 字符\n"
                f"建议: 减少检索次数或简化问题描述"
            )
            logger.error(f"[Generate] Input length exceeded: {error_msg}")
            return {"messages": [AIMessage(content=error_msg)]}
        else:
            logger.error(f"[Generate] LLM invocation failed: {e}", exc_info=True)
            raise
    except Exception as e:
        logger.error(f"[Generate] Unexpected error during generation: {e}", exc_info=True)
        raise

    # 后处理：将残留的各种占位符替换为[待填写]
    final_content = response.content

    # 使用正则表达式替换各种占位符模式
    # 替换 XX、XXX、XXXX 等
    final_content = re.sub(r'X{2,}', '[待填写]', final_content)
    # 替换 __、___、____ 等
    final_content = re.sub(r'_{2,}', '[待填写]', final_content)
    # 替换 [需填写具体数值] 为更简洁的形式
    final_content = final_content.replace('[需填写具体数值]', '[待填写]')

    if final_content != response.content:
        logger.info("[Generate] Post-processed: replaced residual placeholders with [待填写]")
        response.content = final_content

    logger.info("[Generate] Document generation completed successfully")
    return {
        "messages": [response],
        "draft_content": final_content
    }

# 3. Auditor (校验)
# 增加案例库检索，支持交叉验证
auditor_tools = [retrieve_standard, retrieve_case]
auditor_llm = llm.bind_tools(auditor_tools)


def filter_messages_for_auditor(messages: List[BaseMessage]) -> List[BaseMessage]:
    """
    过滤消息列表，移除带有未响应 tool_calls 的 AIMessage。
    确保每个带 tool_calls 的 AIMessage 后面都有对应的 ToolMessage。
    """
    filtered = []
    i = 0
    while i < len(messages):
        msg = messages[i]
        if isinstance(msg, AIMessage) and hasattr(msg, 'tool_calls') and msg.tool_calls:
            # 查找后续的 ToolMessage
            j = i + 1
            found_tool_msgs = []
            while j < len(messages) and isinstance(messages[j], ToolMessage):
                found_tool_msgs.append(messages[j])
                j += 1

            # 如果有对应的 ToolMessage，保留这组消息
            if found_tool_msgs:
                filtered.append(msg)
                filtered.extend(found_tool_msgs)
                i = j
            else:
                # 没有对应的 ToolMessage，跳过这个 AIMessage
                i += 1
        else:
            filtered.append(msg)
            i += 1

    return filtered


def auditor_node(state: AgentState, config: RunnableConfig):
    """
    Auditor 节点：负责校验文档合规性。
    采用两步执行策略。

    优化重点（支持 MAX_AUDIT_LOOPS=1 的单轮完整校验）：
    - 增加结构化校验维度
    - 强化逻辑一致性检查（数量与表格匹配）
    - 要求结构化输出反馈
    """
    loop_count = state.get("audit_loop_count", 0)

    # 记录当前循环次数
    logger.info(f"[Auditor] Loop iteration: {loop_count + 1}/{MAX_AUDIT_LOOPS}")

    # 根据循环次数生成动态引导语（针对单轮校验优化）
    if MAX_AUDIT_LOOPS == 1:
        # 单轮校验模式：要求一次性完成所有校验
        loop_guidance = """⚠️ **单轮校验模式**：这是唯一一次校验机会，请务必完成以下所有检查：
        1. 逻辑一致性：文档开头声明的数量是否与表格数据完全匹配
        2. 参数合理性：数值是否在规范允许范围内
        3. 规范符合性：是否正确引用国家标准
        4. 内容完整性：必要章节和表格数据是否完整
        5. 格式规范性：符号、单位是否正确

        请按结构化格式输出校验结果。"""
    elif loop_count == 0:
        loop_guidance = "这是第一次校验，请全面审查文档的合规性和完整性。"
    elif loop_count < MAX_AUDIT_LOOPS - 1:
        loop_guidance = f"这是第{loop_count + 1}次校验，请检查之前提出的问题是否已解决。如果主要问题已修正，可以回复'pass'。"
    else:
        loop_guidance = "⚠️ **重要提醒**：这是最后一次校验机会。请评估当前文档质量，如果基本符合要求，请务必回复'pass'。"

    # 使用 PromptBuilder 组装 Auditor 提示词
    profession_tag_id = state.get("profession_tag_id", 0)
    chapter_name = state.get("chapter_name", "")
    builder = PromptBuilder(profession_tag_id=profession_tag_id, chapter_name=chapter_name)
    auditor_content = builder.build_auditor(
        loop_count=loop_count + 1,
        max_loops=MAX_AUDIT_LOOPS,
        loop_guidance=loop_guidance,
    )

    system_msg = SystemMessage(content=auditor_content)

    # 过滤消息，移除带有未响应 tool_calls 的 AIMessage
    messages = filter_messages_for_auditor(state["messages"])
    logger.debug(f"[Auditor] Filtered messages: {len(state['messages'])} -> {len(messages)}")

    if not messages or not isinstance(messages[0], SystemMessage) or "Auditor" not in str(messages[0].content):
        messages = [system_msg] + messages

    # --- 阶段 1: 思考 (Streaming) ---
    logger.debug("[Auditor] Starting thinking phase (streaming)")
    streaming_llm = ChatTongyi(model="qwen-max", temperature=0.1, streaming=True)

    step1_config = config.copy() if config else {}
    step1_config.setdefault("tags", []).append("thinking_trace")

    thought_response = streaming_llm.invoke(messages, step1_config)

    # --- 阶段 2: 行动 (Non-Streaming) ---
    logger.debug("[Auditor] Starting tool calling phase (non-streaming)")

    # 增强行动指令，强调结构化输出
    action_instruction = """Based on your analysis, please:
1. If you need to verify specific standards, use the retrieve_standard or retrieve_case tools.
2. If no further checks are needed, provide the final feedback in the structured format:
   - If all checks pass: output "## 校验结果\n- 状态：pass"
   - If revisions needed: output the structured feedback with "## 校验结果\n- 状态：revise" and list all issues.

IMPORTANT: Check logical consistency first - ensure declared quantities match table data exactly."""

    messages_for_tool = messages + [thought_response, HumanMessage(content=action_instruction)]

    tool_response = auditor_llm.invoke(messages_for_tool, config)

    # 更新循环计数器
    return {
        "messages": [thought_response, tool_response],
        "audit_loop_count": loop_count + 1
    }

# =============================================================================
# 5. 条件逻辑 (Conditional Logic)
# =============================================================================

def router_condition(state: AgentState):
    return state["intent"]

def general_condition(state: AgentState):
    last_msg = state["messages"][-1]
    if last_msg.tool_calls:
        return "tools"
    return END

def researcher_condition(state: AgentState):
    """
    Researcher 循环控制逻辑

    终止条件（按优先级）：
    1. 达到最大循环次数 (MAX_RESEARCH_LOOPS)
    2. 检测到连续空结果（质量评估）
    3. LLM 判断资料充足（无 tool_calls）
    """
    last_msg = state["messages"][-1]
    loop_count = state.get("research_loop_count", 0)

    # 1. 硬性限制：检查是否达到最大循环次数
    if loop_count >= MAX_RESEARCH_LOOPS:
        logger.warning(
            f"[Researcher] Reached max loops ({MAX_RESEARCH_LOOPS}), "
            f"forcing exit to generate"
        )
        return "generate"

    # 2. 质量评估：检查是否应该提前退出
    quality_check = evaluate_retrieval_quality(state)
    if quality_check["should_stop"]:
        logger.info(
            f"[Researcher] Quality check triggered early exit: "
            f"{quality_check['reason']}"
        )
        return "generate"

    # 3. LLM 判断：检查是否有工具调用
    if last_msg.tool_calls:
        logger.debug(f"[Researcher] Tool calls detected, continuing to researcher_tools")
        return "researcher_tools"

    # 4. 正常退出：LLM 认为资料已充足
    logger.info(f"[Researcher] No tool calls, exiting to generate after {loop_count} loops")
    return "generate"

def auditor_condition(state: AgentState):
    """
    Auditor 循环控制逻辑

    终止条件（按优先级）：
    1. 达到最大循环次数 (MAX_AUDIT_LOOPS) → 返回 generate 输出最终结果（最高优先级！）
    2. 达到最大工具调用次数 (MAX_AUDITOR_TOOL_CALLS) → 强制结束
    3. LLM 判断通过校验（'pass'）→ 直接结束
    4. 有工具调用则继续（但受循环次数和工具调用次数限制）
    5. 默认返回 generate（修改后重新生成）
    """
    last_msg = state["messages"][-1]
    loop_count = state.get("audit_loop_count", 0)
    tool_call_count = state.get("auditor_tool_call_count", 0)

    # 1. 【最高优先级】检查是否达到最大循环次数
    # 必须放在工具调用检查之前，否则会陷入无限循环
    if loop_count >= MAX_AUDIT_LOOPS:
        logger.warning(
            f"[Auditor] Reached max loops ({MAX_AUDIT_LOOPS}), "
            f"routing to generate for final output (ignoring any tool calls)"
        )
        return "generate"

    # 2. 检查是否达到最大工具调用次数（双重保护）
    if tool_call_count >= MAX_AUDITOR_TOOL_CALLS:
        logger.warning(
            f"[Auditor] Reached max tool calls ({MAX_AUDITOR_TOOL_CALLS}), "
            f"forcing end to prevent infinite loop"
        )
        return "generate"

    # 3. 检查是否通过校验
    content = last_msg.content if hasattr(last_msg, 'content') and last_msg.content else ""
    if "pass" in content.lower():
        logger.info("[Auditor] Content passed validation, ending workflow")
        return END

    # 4. 检查是否有工具调用（仅在未达到最大次数时允许）
    if hasattr(last_msg, 'tool_calls') and last_msg.tool_calls:
        logger.debug(f"[Auditor] Tool calls detected (loop {loop_count}/{MAX_AUDIT_LOOPS}, tools {tool_call_count}/{MAX_AUDITOR_TOOL_CALLS}), continuing")
        return "auditor_tools"

    # 5. 需要修改，返回 generate 重新生成
    logger.info(f"[Auditor] Content needs revision (loop {loop_count}/{MAX_AUDIT_LOOPS}), routing to generate")
    return "generate"

def generate_condition(state: AgentState):
    """
    Generate 节点后的路由逻辑

    根据 enable_audit 标志和循环次数决定：
    - enable_audit = False: 直接结束
    - enable_audit = True 且未达到最大循环次数: 进入 auditor 审核
    - enable_audit = True 但已达到最大循环次数: 直接结束（不再校验）
    """
    enable_audit = state.get("enable_audit", False)
    audit_loop_count = state.get("audit_loop_count", 0)

    if not enable_audit:
        logger.info("[Generate] Audit disabled, ending workflow")
        return END

    # 检查是否已达到最大循环次数
    if audit_loop_count >= MAX_AUDIT_LOOPS:
        logger.warning(
            f"[Generate] Audit loop count ({audit_loop_count}) reached max ({MAX_AUDIT_LOOPS}), "
            f"skipping auditor and ending workflow"
        )
        return END

    logger.info(f"[Generate] Audit enabled (loop {audit_loop_count}/{MAX_AUDIT_LOOPS}), routing to auditor")
    return "auditor"

# =============================================================================
# 6. 图构建 (Graph Construction)
# =============================================================================

# 创建基础 ToolNode
_auditor_tool_node = ToolNode(auditor_tools)

def auditor_tools_node(state: AgentState):
    """
    自定义 Auditor 工具节点，包装 ToolNode 并递增工具调用计数器。
    用于防止工具调用无限循环。
    """
    # 递增工具调用计数器
    tool_call_count = state.get("auditor_tool_call_count", 0)
    new_count = tool_call_count + 1

    logger.debug(f"[Auditor Tools] Executing tools (call {new_count}/{MAX_AUDITOR_TOOL_CALLS})")

    # 执行原始 ToolNode
    result = _auditor_tool_node.invoke(state)

    # 返回结果并更新计数器
    if isinstance(result, dict):
        result["auditor_tool_call_count"] = new_count
    else:
        result = {"messages": result, "auditor_tool_call_count": new_count}

    return result

workflow = StateGraph(AgentState)

# --- 添加节点 ---
workflow.add_node("router", router_node)

# 通用分支节点
workflow.add_node("general_agent", general_agent_node)
workflow.add_node("general_tools", ToolNode(general_tools))

# 文档生成分支节点
workflow.add_node("researcher", researcher_node)
workflow.add_node("researcher_tools", ToolNode(researcher_tools))

workflow.add_node("generate", generate_node)

workflow.add_node("auditor", auditor_node)
workflow.add_node("auditor_tools", auditor_tools_node)  # 使用自定义节点，带工具调用计数

# --- 添加边 ---
workflow.set_entry_point("router")

# 路由分支
workflow.add_conditional_edges(
    "router",
    router_condition,
    {
        "general_chat": "general_agent",
        "generate_doc": "researcher"
    }
)

# 通用助手循环
workflow.add_conditional_edges(
    "general_agent",
    general_condition,
    {
        "tools": "general_tools",
        END: END
    }
)
workflow.add_edge("general_tools", "general_agent")

# 文档生成流水线

# 1. Researcher 循环
workflow.add_conditional_edges(
    "researcher",
    researcher_condition,
    {
        "researcher_tools": "researcher_tools",
        "generate": "generate"
    }
)
workflow.add_edge("researcher_tools", "researcher")

# 2. Generate 节点执行完后的条件路由
# - 如果 enable_audit = True: 进入 auditor
# - 如果 enable_audit = False: 直接结束
workflow.add_conditional_edges(
    "generate",
    generate_condition,
    {
        "auditor": "auditor",
        END: END
    }
)

# 3. Auditor 循环与回退
workflow.add_conditional_edges(
    "auditor",
    auditor_condition,
    {
        "auditor_tools": "auditor_tools",
        "generate": "generate",
        END: END
    }
)
workflow.add_edge("auditor_tools", "auditor")

# 编译图，添加 PostgreSQL Checkpointer
checkpointer = get_checkpointer()
if checkpointer:
    app = workflow.compile(checkpointer=checkpointer)
    logger.info("LangGraph compiled with PostgreSQL memory persistence")
else:
    app = workflow.compile()
    logger.warning("LangGraph compiled without memory persistence")
