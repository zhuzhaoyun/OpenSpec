"""
建筑施工文档生成工具集
基于 RAGFlow 知识库检索
"""
import os
import sys
import json
import hashlib
from contextvars import ContextVar
from langchain_core.tools import tool
from ragflow_sdk import RAGFlow
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from utils.logger import get_logger

load_dotenv()
logger = get_logger('construction_tools')

# RAGFlow 配置信息
RAGFLOW_BASE_URL = os.getenv("RAGFLOW_BASE_URL", "")
RAGFLOW_API_KEY = os.getenv("RAGFLOW_API_KEY")

# 知识库 ID 配置
# 注意：这里使用固定的知识库 ID，也可以通过 project_id 动态查询
try:
    STAND_KB_IDS = json.loads(os.getenv("DEFAULT_STAND_KB_IDS", "[]"))  # 行业规范库 (可选配置)
except Exception:
    raise ValueError("未找到知识库配置: DEFAULT_STAND_KB_IDS 解析失败")
try:
    CASE_KB_IDS = json.loads(os.getenv("DEFAULT_CASE_KB_IDS", "[]"))   # 企业案例库 (可选配置)
except Exception:
    raise ValueError("未找到知识库配置: DEFAULT_CASE_KB_IDS 解析失败")

# =============================================================================
# 请求级知识库 ID（通过 contextvars 实现，线程/协程安全）
# 在 API 入口根据标签解析出 KB IDs 后设置，检索工具优先使用 context 中的值
# =============================================================================
_request_case_kb_ids: ContextVar[list] = ContextVar('case_kb_ids', default=None)
_request_stand_kb_ids: ContextVar[list] = ContextVar('stand_kb_ids', default=None)

# 请求级引用池：存储检索 chunks 和文档聚合数据，用于前端引用展示
# 结构: {"chunks": {hash_id: chunk_data, ...}, "doc_aggs": {doc_name: {doc_name, count}, ...}}
_request_reference_pool: ContextVar[dict] = ContextVar('reference_pool', default=None)


def hash_str2int(s: str, mod: int = 500) -> int:
    """将字符串哈希为 [0, mod) 范围内的整数，用于生成短引用 ID"""
    return int(hashlib.sha256(s.encode()).hexdigest(), 16) % mod


def set_request_kb_ids(case_ids: list = None, standard_ids: list = None):
    """设置当前请求的知识库 ID（请求级，不影响全局）"""
    if case_ids is not None:
        _request_case_kb_ids.set(case_ids)
        logger.info(f"[ContextVar] 设置请求级案例库: {case_ids}")
    if standard_ids is not None:
        _request_stand_kb_ids.set(standard_ids)
        logger.info(f"[ContextVar] 设置请求级规范库: {standard_ids}")
    # 初始化引用池（chunks + doc_aggs）
    _request_reference_pool.set({"chunks": {}, "doc_aggs": {}})


def clear_request_kb_ids():
    """清除当前请求的知识库 ID 和引用池（在请求结束时调用）"""
    _request_case_kb_ids.set(None)
    _request_stand_kb_ids.set(None)
    _request_reference_pool.set(None)
    logger.debug("[ContextVar] 已清除请求级知识库和引用池")


def get_reference_pool() -> dict:
    """获取当前请求的引用池数据"""
    return _request_reference_pool.get() or {}


def _retrieve_from_kb(query: str, kb_ids: list, kb_name: str = "知识库") -> str:
    """
    通用检索函数（优化版，支持引用 ID 生成）

    Args:
        query: 检索关键词或问题
        kb_ids: 知识库 ID 列表
        kb_name: 知识库名称（用于日志）

    Returns:
        str: 检索到的内容拼接字符串，包含引用 ID、来源和相关度信息
    """
    if not kb_ids:
        return f"未配置{kb_name}，无法检索。"

    logger.info(f"[RAGFlow] Retrieving from {kb_name}: {query[:50]}...")
    try:
        rag_object = RAGFlow(api_key=RAGFLOW_API_KEY, base_url=RAGFLOW_BASE_URL)

        # 使用原始 API 调用以获取完整的 chunk 数据（SDK 会过滤掉未预定义的字段）
        data_json = {
            "page": 1,
            "page_size": 10,
            "similarity_threshold": 0.55,
            "vector_similarity_weight": 0.3,
            "top_k": 1024,
            "question": query,
            "dataset_ids": kb_ids,
        }
        res = rag_object.post("/retrieval", json=data_json)
        res_json = res.json()
        if res_json.get("code") != 0:
            raise Exception(res_json.get("message", "检索失败"))

        raw_chunks = res_json.get("data", {}).get("chunks", [])
        # 同时提取 RAGFlow 返回的 doc_aggs（如果有）
        raw_doc_aggs = res_json.get("data", {}).get("doc_aggs", [])

        if raw_chunks:
            context_list = []
            ref_pool = _request_reference_pool.get()
            if ref_pool is None:
                ref_pool = {"chunks": {}, "doc_aggs": {}}
                _request_reference_pool.set(ref_pool)

            # 构建 doc_id → doc_name 映射（从 RAGFlow 的 doc_aggs 获取）
            doc_id_name_map = {}
            for agg in raw_doc_aggs:
                if isinstance(agg, dict) and agg.get("doc_id") and agg.get("doc_name"):
                    doc_id_name_map[agg["doc_id"]] = agg["doc_name"]

            logger.debug(f"[RAGFlow] Raw chunk keys sample: {list(raw_chunks[0].keys()) if raw_chunks else []}")
            logger.debug(f"[RAGFlow] doc_id_name_map: {doc_id_name_map}")

            for chunk in raw_chunks:
                # 提取内容（原始 dict，无 SDK 过滤）
                content = chunk.get('content_with_weight') or chunk.get('content') or str(chunk)

                # 提取来源：优先 document_name / doc_name，其次通过 doc_id 查 doc_aggs 映射
                source = chunk.get('document_name') or chunk.get('doc_name') or \
                         chunk.get('documnet_keyword') or ''
                if not source and chunk.get('document_id'):
                    source = doc_id_name_map.get(chunk['document_id'], '')
                if not source and chunk.get('doc_id'):
                    source = doc_id_name_map.get(chunk['doc_id'], '')
                if not source:
                    source = '未知来源'

                score = chunk.get('similarity') or 0.0
                chunk_id = chunk.get('id') or ''
                image_id = chunk.get('image_id') or ''

                # 生成引用 hash ID
                hash_id = hash_str2int(chunk_id, 500) if chunk_id else len(ref_pool["chunks"])

                # 存入 chunks 引用池
                ref_pool["chunks"][hash_id] = {
                    "chunk_content": content,
                    "doc_name": source,
                    "similarity": float(score) if score else 0.0,
                    "image_id": image_id,
                    "index": hash_id,
                }

                # 聚合 doc_aggs（按文档名去重，累加命中 chunk 计数）
                if source not in ref_pool["doc_aggs"]:
                    ref_pool["doc_aggs"][source] = {
                        "doc_name": source,
                        "count": 0,
                    }
                ref_pool["doc_aggs"][source]["count"] += 1

                # 格式化输出（带引用 ID，供 LLM 引用）
                formatted = f"ID: {hash_id}\n├── 来源: {source}\n├── 相关度: {score:.2f}\n└── 内容:\n{content}"
                context_list.append(formatted)

            logger.debug(f"[RAGFlow] Retrieved {len(context_list)} chunks from {kb_name}, "
                         f"ref_pool: {len(ref_pool['chunks'])} chunks, {len(ref_pool['doc_aggs'])} docs")
            return "\n\n---\n\n".join(context_list)
        logger.warning(f"[RAGFlow] No relevant content found in {kb_name}")
        return f"未检索到相关{kb_name}内容。"
    except Exception as e:
        logger.error(f"[RAGFlow] Retrieval failed from {kb_name}: {e}", exc_info=True)
        return f"检索失败: {e}"


@tool
def retrieve_case(query: str) -> str:
    """
    从知识库检索建筑施工设计说明历史案例。

    Args:
        query: 检索关键词或问题

    Returns:
        str: 检索到的案例内容拼接字符串
    """
    kb_ids = _request_case_kb_ids.get() or CASE_KB_IDS
    return _retrieve_from_kb(query, kb_ids, "案例库")


@tool
def retrieve_standard(query: str) -> str:
    """
    从知识库检索建筑施工行业规范。

    Args:
        query: 检索关键词或问题

    Returns:
        str: 检索到的规范内容拼接字符串
    """
    kb_ids = _request_stand_kb_ids.get() or STAND_KB_IDS
    return _retrieve_from_kb(query, kb_ids, "规范库")


def retrieve_from_project_kb(query: str, project_id: str) -> str:
    """
    根据项目 ID 动态查询知识库并检索

    Args:
        query: 检索关键词或问题
        project_id: 项目 ID

    Returns:
        str: 检索到的内容拼接字符串
    """
    from service.db.database import get_kb_id_by_project_id

    kb_id = get_kb_id_by_project_id(project_id)
    if not kb_id:
        return f"项目 {project_id} 未关联知识库，无法检索。"

    return _retrieve_from_kb(query, [kb_id], f"项目知识库 ({kb_id})")

