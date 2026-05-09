"""
知识库解析服务 (MVP 版本)
根据标签 ID 解析对应的知识库 ID，支持降级到默认知识库。

使用 Python dict 配置映射关系（Plan A），
后续可升级为数据库表存储（Plan B）。
"""
import os
import json
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# =============================================================================
# 默认知识库 ID（从环境变量读取，作为降级回退）
# =============================================================================
try:
    DEFAULT_CASE_KB_IDS = json.loads(os.getenv("DEFAULT_CASE_KB_IDS", "[]"))
except Exception:
    DEFAULT_CASE_KB_IDS = []

try:
    DEFAULT_STAND_KB_IDS = json.loads(os.getenv("DEFAULT_STAND_KB_IDS", "[]"))
except Exception:
    DEFAULT_STAND_KB_IDS = []


# =============================================================================
# 标签 → 知识库映射配置 (Plan A: Python dict)
#
# 格式:
#   tag_id: {
#       "case": ["ragflow_kb_id_1", ...],
#       "standard": ["ragflow_kb_id_1", ...],
#   }
#
# 使用时请根据实际的 RAGFlow 知识库 ID 填入。
# 没有映射的标签不需要添加条目，会自动降级到默认知识库。
# =============================================================================
TAG_KB_MAPPING = {
    # === 专业标签 (profession) ===
    # 1: {  # 建筑
        #"case": ["d831552b123b11f1b6210242c0a83002"],
        # "standard": ["ragflow_kb_arch_std_01"],
    #},
    #2: {  # 结构
        #"case": ["f20db9a9123b11f1954e0242c0a83002"],
        # "standard": ["ragflow_kb_struct_std_01"],
    #},
    # 3: {  # 给排水
    #     "case": [],
    #     "standard": [],
    # },
    # 4: {  # 电气
    #     "case": [],
    #     "standard": [],
    # },
    # 5: {  # 暖通
    #     "case": [],
    #     "standard": [],
    # },

    # === 业态标签 (business_type) ===
    #9: {  # 学校
        #"case": ["3d0a5d45123c11f1a9b00242c0a83002"],
        # "standard": ["ragflow_kb_school_std_01"],
    #},
    # 10: {  # 医院
    #     "case": [],
    #     "standard": [],
    # },
}


def resolve(
    profession_tag_id: int = None,
    business_type_tag_id: int = None,
) -> dict:
    """
    根据标签 ID 解析出知识库 ID 列表。

    降级策略:
    1. 有映射就用映射（即使只有一个标签有映射）
    2. 全无映射就用默认
    3. 各维度独立解析后合并去重

    Args:
        profession_tag_id: 专业标签 ID（单选）
        business_type_tag_id: 业态标签 ID（单选）

    Returns:
        {
            "case_kb_ids": [...],
            "standard_kb_ids": [...],
            "source": "tags" | "default"
        }
    """
    tag_ids = [tid for tid in [profession_tag_id, business_type_tag_id] if tid]

    if not tag_ids:
        logger.info("[KBResolver] 未提供标签，使用默认知识库")
        return {
            "case_kb_ids": DEFAULT_CASE_KB_IDS,
            "standard_kb_ids": DEFAULT_STAND_KB_IDS,
            "source": "default",
        }

    # 收集各标签对应的 KB IDs
    case_ids = []
    standard_ids = []
    found_any = False

    for tid in tag_ids:
        mapping = TAG_KB_MAPPING.get(tid)
        if mapping:
            found_any = True
            case_ids.extend(mapping.get("case", []))
            standard_ids.extend(mapping.get("standard", []))
            logger.info(f"[KBResolver] 标签 {tid} 映射: case={mapping.get('case', [])}, standard={mapping.get('standard', [])}")
        else:
            logger.info(f"[KBResolver] 标签 {tid} 无映射记录")

    if not found_any:
        logger.info("[KBResolver] 所有标签均无映射，降级到默认知识库")
        return {
            "case_kb_ids": DEFAULT_CASE_KB_IDS,
            "standard_kb_ids": DEFAULT_STAND_KB_IDS,
            "source": "default",
        }

    # 去重（保持顺序）
    case_ids = list(dict.fromkeys(case_ids))
    standard_ids = list(dict.fromkeys(standard_ids))

    # 单维度回退：如果某一类型为空，使用默认
    if not case_ids:
        case_ids = DEFAULT_CASE_KB_IDS
        logger.info("[KBResolver] 案例库映射为空，降级到默认案例库")
    if not standard_ids:
        standard_ids = DEFAULT_STAND_KB_IDS
        logger.info("[KBResolver] 规范库映射为空，降级到默认规范库")

    logger.info(f"[KBResolver] 最终结果: case={case_ids}, standard={standard_ids}")
    return {
        "case_kb_ids": case_ids,
        "standard_kb_ids": standard_ids,
        "source": "tags",
    }
