# apps/agent/service/utils/prompt_builder.py
"""
统一的 Prompt 组装中间层。
construction_agent.py 和 batch_construction_agent.py 共享此模块。
"""
import logging
from langchain_core.messages import SystemMessage

from service.utils.prompt_manager import PromptManager
from service.utils.profession_config import get_architecture_tag_id, resolve_chapter_prompt_key

logger = logging.getLogger(__name__)

# _PROMPT_DEBUG_DIR = os.path.join(
#     os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
#     "logs", "prompts"
# )


# def _write_prompt_debug(filename: str, content: str):
#     os.makedirs(_PROMPT_DEBUG_DIR, exist_ok=True)
#     path = os.path.join(_PROMPT_DEBUG_DIR, filename)
#     with open(path, "w", encoding="utf-8") as f:
#         f.write(content)
#     logger.info(f"[PromptBuilder] Prompt debug written to: {path}")


class PromptBuilder:
    """
    封装所有节点的 Langfuse prompt 获取与 compile 逻辑。

    使用方式：
        builder = PromptBuilder(profession_tag_id=1, chapter_name="墙体")
        system_msg = builder.build_researcher(project_info, loop_count, max_loops, loop_guidance)
        full_prompt = builder.build_generate(context, question, template, project_info)
        auditor_content = builder.build_auditor(loop_count, max_loops, loop_guidance)
    """

    def __init__(self, profession_tag_id: int = 0, chapter_name: str = ""):
        self.pm = PromptManager()
        self.profession_tag_id = profession_tag_id
        self.chapter_name = chapter_name

    # ------------------------------------------------------------------
    # 公开方法
    # ------------------------------------------------------------------

    def build_researcher(
        self,
        project_info: str,
        loop_count: int,
        max_loops: int,
        loop_guidance: str,
    ) -> SystemMessage:
        """
        组装 Researcher 节点的 SystemMessage。

        Returns:
            SystemMessage: 包含编译后提示词的系统消息，可直接放入 messages 列表。
        """
        prompt = self.pm.get_prompt_for_profession(
            "langchain_researcher",
            profession_tag_id=self.profession_tag_id,
        )
        if prompt is None:
            logger.error("[PromptBuilder] 'langchain_researcher' prompt not found, returning empty SystemMessage")
            return SystemMessage(content="")

        content = prompt.compile(
            project_info=project_info,
            loop_count=loop_count,
            max_loops=max_loops,
            loop_guidance=loop_guidance,
        )
        return SystemMessage(content=content)

    def build_generate(
        self,
        context: str,
        question: str,
        template: str,
        project_info: str,
    ) -> str:
        """
        组装 Generate 节点的完整提示词字符串。

        - generator-enhance 的内容作为 question 的前缀（保持现有语义）
        - 建筑专业时自动拼接 chapter_supplement（0-general + chapter_{章节名}）
        - chapter_supplement 作为独立变量传入主 prompt，由模板控制渲染

        Returns:
            str: 编译后的完整提示词字符串，可直接传入 HumanMessage。
        """
        # 1. generator-enhance 前缀
        enhance_prompt = self.pm.get_prompt_for_profession(
            "generator-enhance",
            profession_tag_id=self.profession_tag_id,
        )
        enhanced_prefix = enhance_prompt.compile() if enhance_prompt else ""
        enhanced_question = enhanced_prefix + f"原始请求：{question}"

        # 2. 建筑专业章节补充指令
        chapter_supplement = (
            self._build_architecture_supplement()
            if self._is_architecture()
            else ""
        )

        # 3. 主 prompt
        main_prompt = self.pm.get_prompt_for_profession(
            "construction_agent_system",
            profession_tag_id=self.profession_tag_id,
        )
        if main_prompt is None:
            logger.error("[PromptBuilder] 'construction_agent_system' prompt not found")
            return ""

        result = main_prompt.compile(
            context=context,
            question=enhanced_question,
            template=template,
            project_info=project_info,
            chapter_supplement=chapter_supplement,
        )
        logger.info(
            f"[PromptBuilder] generate: chapter='{self.chapter_name}', supplement={len(chapter_supplement)}c, prompt={len(result)}c"
        )
        # _write_prompt_debug(f"generate_prompt_{self.chapter_name or 'unknown'}.txt", result)
        return result

    def build_auditor(
        self,
        loop_count: int,
        max_loops: int,
        loop_guidance: str,
    ) -> str:
        """
        组装 Auditor 节点的提示词字符串。

        Returns:
            str: 编译后的 auditor 提示词（含 audit_dimensions），供构建 SystemMessage 使用。
        """
        auditor_prompt = self.pm.get_prompt_for_profession(
            "langchain_auditor",
            profession_tag_id=self.profession_tag_id,
        )
        if auditor_prompt is None:
            logger.error("[PromptBuilder] 'langchain_auditor' prompt not found")
            return ""

        base = auditor_prompt.compile(
            loop_count=loop_count,
            max_loops=max_loops,
            loop_guidance=loop_guidance,
        )

        enhance_prompt = self.pm.get_prompt_for_profession(
            "auditor-enhance",
            profession_tag_id=self.profession_tag_id,
        )
        audit_dimensions = enhance_prompt.compile() if enhance_prompt else ""

        return base + ("\n\n" + audit_dimensions if audit_dimensions else "")

    # ------------------------------------------------------------------
    # 内部方法
    # ------------------------------------------------------------------

    def _is_architecture(self) -> bool:
        return self.profession_tag_id == get_architecture_tag_id()

    def _build_architecture_supplement(self) -> str:
        """
        拼接建筑专业补充指令：通用文字风格（chapter-general）+ 章节专属指令（chapter-{key}）。

        章节专属 prompt 通过关键词模糊匹配确定：
        - "墙体工程" → chapter-墙体
        - "屋面防水" → chapter-屋面
        - 无匹配 → 只拼 chapter-general

        降级策略：
        - chapter-general 不存在 → 记录 warning，跳过
        - 章节无匹配关键词 → 记录 info，只拼 chapter-general
        - chapter-{key} 不存在 → 记录 info，只拼 chapter-general
        """
        parts = []

        general = self.pm.get_prompt("chapter-general")
        if general:
            general_content = general.compile()
            parts.append(general_content)
            logger.debug(
                f"[PromptBuilder] chapter-general ({len(general_content)} chars)"
            )
        else:
            logger.warning("[PromptBuilder] 'chapter-general' prompt not found for architecture profession")

        if self.chapter_name:
            prompt_key = resolve_chapter_prompt_key(self.chapter_name)
            if prompt_key:
                chapter_prompt_name = f"chapter-{prompt_key}"
                chapter = self.pm.get_prompt(chapter_prompt_name)
                if chapter:
                    chapter_content = chapter.compile()
                    parts.append("##### 分隔")
                    parts.append(chapter_content)
                    logger.info(f"[PromptBuilder] loaded '{chapter_prompt_name}' for '{self.chapter_name}'")
                else:
                    logger.info(
                        f"[PromptBuilder] No prompt found for '{chapter_prompt_name}', "
                        f"using chapter-general only"
                    )
            else:
                logger.info(
                    f"[PromptBuilder] No keyword match for chapter '{self.chapter_name}', "
                    f"using chapter-general only"
                )

        result = "\n\n".join(parts)
        return result
