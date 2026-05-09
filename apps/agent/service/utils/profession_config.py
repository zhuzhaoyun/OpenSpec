# apps/agent/service/utils/profession_config.py
import json
import os

_config = None


def _load() -> dict:
    global _config
    if _config is None:
        path = os.path.join(
            os.path.dirname(__file__),
            "../../config/profession_labels.json"
        )
        with open(path, encoding="utf-8") as f:
            _config = json.load(f)
    return _config


def get_label_map() -> dict:
    """返回 {profession_tag_id(int): label(str)} 映射"""
    return {int(k): v for k, v in _load()["labels"].items()}


def get_architecture_tag_id() -> int:
    """返回建筑专业的 tag_id"""
    return int(_load().get("architecture_tag_id", 1))


def resolve_chapter_prompt_key(chapter_name: str) -> str:
    """
    根据章节名称模糊匹配，返回对应的 prompt key。

    匹配规则：遍历 chapter_keywords，找到第一个关键词被章节名包含的条目。
    例如：
        "墙体工程" → "墙体"  (chapter-墙体)
        "屋面防水" → "屋面"  (chapter-屋面，取第一个命中)
        "未知章节" → ""      (无匹配，返回空串)

    Args:
        chapter_name: 实际章节标题，如"4.墙体工程"

    Returns:
        匹配到的 prompt key（对应 chapter-{key}），无匹配返回空串
    """
    keywords_map: dict = _load().get("chapter_keywords", {})
    for key, keywords in keywords_map.items():
        if any(kw in chapter_name for kw in keywords):
            return key
    return ""
