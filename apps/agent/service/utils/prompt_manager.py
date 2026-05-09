import os
import threading
from langfuse import Langfuse
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def _get_tag_label_mapping() -> dict:
    """从外置 JSON 配置加载专业标签 → Langfuse label 映射"""
    try:
        from service.utils.profession_config import get_label_map
        return get_label_map()
    except Exception as e:
        logger.warning(f"Failed to load profession_labels.json, using empty mapping: {e}")
        return {}


class PromptManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(PromptManager, cls).__new__(cls)
                    cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        try:
            self.langfuse = Langfuse()
            logger.info("Langfuse client initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize Langfuse client: {e}")
            self.langfuse = None
        
        self.default_label = os.getenv("PROMPT_LABEL", "latest")

    def get_prompt(self, prompt_name: str, label: str = None):
        """
        Get prompt from Langfuse.
        
        Args:
            prompt_name (str): The name of the prompt in Langfuse.
            label (str, optional): The label version of the prompt. Defaults to env PROMPT_LABEL or "latest".
            
        Returns:
            Prompt object from Langfuse or None if client is not initialized or error occurs.
        """
        if not self.langfuse:
            logger.warning("Langfuse client is not initialized. Returning None for prompt.")
            return None

        target_label = label or self.default_label
        try:
            return self.langfuse.get_prompt(prompt_name, label=target_label)
        except Exception as e:
            logger.error(f"Failed to fetch prompt '{prompt_name}' with label '{target_label}': {e}")
            raise e

    def get_prompt_for_profession(
        self,
        prompt_name: str,
        profession_tag_id: int = None,
        fallback_label: str = None
    ):
        """
        根据专业标签获取对应的提示词，支持降级。

        解析顺序：
        1. 查 TAG_PROMPT_LABEL_MAPPING 字典
        2. 降级到 fallback_label（默认 "latest"）

        Args:
            prompt_name: Langfuse 中的 prompt 名称
            profession_tag_id: 专业标签 ID（可选）
            fallback_label: 降级使用的 label（默认为 self.default_label）

        Returns:
            Langfuse Prompt 对象
        """
        fallback = fallback_label or self.default_label
        target_label = fallback

        if profession_tag_id:
            dict_label = _get_tag_label_mapping().get(profession_tag_id)
            if dict_label:
                target_label = dict_label
                logger.info(
                    f"[PromptRouter] Got label from dict: profession_tag_id={profession_tag_id}, "
                    f"label='{target_label}'"
                )

        # 3. 获取 Prompt
        if not self.langfuse:
            logger.warning("Langfuse client is not initialized. Returning None for prompt.")
            return None

        try:
            prompt = self.langfuse.get_prompt(prompt_name, label=target_label)
            logger.info(
                f"[PromptRouter] Success: prompt='{prompt_name}', label='{target_label}'"
            )
            return prompt
        except Exception as e:
            # 4. 降级处理
            logger.warning(
                f"[PromptRouter] Failed to get prompt '{prompt_name}' with label '{target_label}': {e}. "
                f"Falling back to '{fallback}'"
            )
            try:
                return self.langfuse.get_prompt(prompt_name, label=fallback)
            except Exception as fallback_error:
                logger.error(f"[PromptRouter] Fallback also failed: {fallback_error}")
                return None
