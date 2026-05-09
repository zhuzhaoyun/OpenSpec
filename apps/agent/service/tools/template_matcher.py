"""
模板智能匹配服务

基于 RAGFlow Metadata 的模板章节检索和匹配
"""
import os
import re
from ragflow_sdk import RAGFlow
from typing import List, Optional, Dict, Any
import logging

from service.utils.chapter_extractor import ChapterExtractor

logger = logging.getLogger(__name__)

RAGFLOW_API_KEY = os.getenv("RAGFLOW_API_KEY")
RAGFLOW_BASE_URL = os.getenv("RAGFLOW_BASE_URL")
PERSONAL_TEMPLATE_KB_NAME = os.getenv("PERSONAL_TEMPLATE_KB_NAME", "personal-template")


class TemplateMatcherService:
    """模板匹配服务"""

    def __init__(self):
        self.rag = RAGFlow(api_key=RAGFLOW_API_KEY, base_url=RAGFLOW_BASE_URL)
        self._doc_meta_cache = {}  # 文档meta_fields缓存 {document_id: meta_fields}

    def search(
        self,
        user_id: str,
        chapter_title: str,
        profession_tag_id: Optional[int] = None,
        business_type_tag_id: Optional[int] = None,
        threshold: float = 0.5,
        limit: int = 10
    ) -> Dict[str, Any]:
        """
        基于 Metadata 权限过滤的模板章节检索

        Args:
            user_id: 用户ID
            chapter_title: 章节标题
            profession_tag_id: 专业标签ID（单选）
            business_type_tag_id: 业态标签ID（单选）
            threshold: 相似度阈值
            limit: 返回结果数量

        Returns:
            {
                'matched': {...},  # 最佳匹配
                'alternatives': [...]  # 备选项
            }
        """
        try:
            logger.info(f"[模板匹配] 检索: chapterTitle='{chapter_title}', threshold={threshold}")

            # 1. 获取模板知识库ID
            kb_ids = self._get_template_kb_ids()

            if not kb_ids:
                logger.error(f"未找到模板知识库 '{PERSONAL_TEMPLATE_KB_NAME}'")
                return {'matched': None, 'alternatives': []}

            # 2. 构建权限过滤条件（用于日志记录，实际使用后过滤）
            metadata_condition = self._build_permission_filter(user_id)
            logger.info(f"[模板匹配] 检索参数: kb_ids={kb_ids}, 权限过滤: {metadata_condition['logic']} 条件")

            # 3. 向量检索
            # 注意：RAGFlow SDK 0.24.0 的 metadata_condition 参数存在问题（返回空结果）
            # 因此采用后过滤策略：先检索更多 chunk，再在代码中进行权限和标签过滤
            retrieve_page_size = max(limit * 4, 20)  # 增加检索数量以补偿后过滤

            try:
                chunks = self.rag.retrieve(
                    question=chapter_title,
                    dataset_ids=kb_ids,
                    page=1,
                    page_size=retrieve_page_size,
                    similarity_threshold=threshold
                )
                logger.info(f"[模板匹配] RAGFlow 检索到 {len(chunks) if chunks else 0} 个 chunk（未过滤）")
            except TypeError as e:
                logger.error(f"检索失败 (SDK不支持metadata_condition): {e}")
                return {'matched': None, 'alternatives': []}
            except Exception as e:
                logger.error(f"检索失败: {e}", exc_info=True)
                return {'matched': None, 'alternatives': []}

            if not chunks:
                logger.info(f"[模板匹配] 未检索到结果")
                return {'matched': None, 'alternatives': []}

            # 4. 权限后过滤：根据 metadata 过滤 chunk
            filtered_chunks = []
            for chunk in chunks:
                doc_id = getattr(chunk, 'document_id', None)
                if not doc_id:
                    continue

                # 获取文档的 meta_fields
                doc_meta = self._get_document_meta_fields(doc_id)

                # 权限检查：isStandard="true" OR userId=user_id
                is_standard = doc_meta.get('isStandard', '') == 'true'
                is_owner = doc_meta.get('userId', '') == user_id

                if is_standard or is_owner:
                    filtered_chunks.append(chunk)

            logger.info(f"[模板匹配] 权限过滤后剩余 {len(filtered_chunks)} 个 chunk")

            if not filtered_chunks:
                logger.info(f"[模板匹配] 权限过滤后无结果")
                return {'matched': None, 'alternatives': []}

            chunks = filtered_chunks

            # 5. 处理所有返回的 chunk（RAGFlow 已按相似度排序）
            chunks_to_process = chunks[:limit * 2]  # 获取更多 chunk 以便合并

            # 6. 工具函数
            def safe_get(obj, key, default=''):
                """安全获取属性值，确保返回可序列化的基本类型"""
                try:
                    if isinstance(obj, dict):
                        val = obj.get(key, default)
                    else:
                        val = getattr(obj, key, default)
                    # 确保返回值是基本类型
                    if isinstance(val, (str, int, float, bool, type(None))):
                        return val
                    # 尝试转换为字符串
                    return str(val) if val else default
                except Exception:
                    return default

            # 7. 按文档分组并合并同一文档的 chunk 内容
            doc_chunks_map = {}  # {doc_id: {'chunks': [...], 'meta': {...}, 'max_similarity': float}}

            for chunk in chunks_to_process:
                doc_id = safe_get(chunk, 'document_id', '')
                if not doc_id:
                    continue

                if doc_id not in doc_chunks_map:
                    doc_meta = self._get_document_meta_fields(doc_id)
                    doc_chunks_map[doc_id] = {
                        'chunks': [],
                        'meta': doc_meta,
                        'max_similarity': 0.0,
                        'document_name': safe_get(chunk, 'document_name', '')
                    }

                similarity = float(safe_get(chunk, 'similarity', 0))
                doc_chunks_map[doc_id]['chunks'].append(chunk)
                doc_chunks_map[doc_id]['max_similarity'] = max(
                    doc_chunks_map[doc_id]['max_similarity'],
                    similarity
                )

            # 8. 标签后过滤：按 profession / business_type 字段独立匹配
            if (profession_tag_id or business_type_tag_id) and doc_chunks_map:
                filtered_map = {}
                for doc_id, doc_data in doc_chunks_map.items():
                    meta = doc_data['meta']
                    match = True
                    if profession_tag_id:
                        doc_profession = str(meta.get('profession', '')).strip()
                        if doc_profession and doc_profession != str(profession_tag_id):
                            match = False
                    if business_type_tag_id:
                        doc_biz = str(meta.get('business_type', '')).strip()
                        if doc_biz and doc_biz != str(business_type_tag_id):
                            match = False
                    if match:
                        filtered_map[doc_id] = doc_data
                # 仅当过滤后仍有结果时才替换，否则回退到全量结果
                if filtered_map:
                    logger.info(f"[标签过滤] profession={profession_tag_id}, business_type={business_type_tag_id}, "
                               f"过滤前 {len(doc_chunks_map)} 个文档, 过滤后 {len(filtered_map)} 个文档")
                    doc_chunks_map = filtered_map
                else:
                    logger.info(f"[标签过滤] profession={profession_tag_id}, business_type={business_type_tag_id}, "
                               f"无匹配文档, 回退到全量结果 ({len(doc_chunks_map)} 个文档)")

            # 9. 合并每个文档的 chunk 内容
            def build_merged_result(_doc_id, doc_data):
                """合并同一文档的多个 chunk，提取目标章节内容"""
                doc_meta = doc_data['meta']
                all_contents = []
                raw_contents = []  # 保留原始内容作为 fallback

                # 第一步：确定目标章节号（优先从包含标题文本的 chunk 中提取）
                target_main_chapter = None
                for chunk in doc_data['chunks']:
                    content = safe_get(chunk, 'content', '')
                    if content and chapter_title:
                        detected = ChapterExtractor._find_chapter_by_title_match(content, chapter_title)
                        if detected:
                            target_main_chapter = ChapterExtractor._get_main_chapter(detected)
                            break

                if not target_main_chapter:
                    first_chunk_content = safe_get(doc_data['chunks'][0], 'content', '') if doc_data['chunks'] else ''
                    if first_chunk_content:
                        first_chapter = ChapterExtractor._detect_first_chapter_in_content(first_chunk_content)
                        if first_chapter:
                            target_main_chapter = ChapterExtractor._get_main_chapter(first_chapter)

                # 第二步：过滤每个 chunk，只保留属于目标主章节的内容
                for chunk in doc_data['chunks']:
                    content = safe_get(chunk, 'content', '')
                    if not content:
                        continue

                    raw_contents.append(content)

                    filtered = ChapterExtractor.extract_chapter_content(
                        content=content,
                        target_chapter_title=chapter_title,
                        include_subchapters=True
                    )

                    if filtered:
                        filtered_first_chapter = ChapterExtractor._detect_first_chapter_in_content(filtered)
                        if filtered_first_chapter:
                            filtered_main = ChapterExtractor._get_main_chapter(filtered_first_chapter)
                            if target_main_chapter and filtered_main != target_main_chapter:
                                continue
                        all_contents.append(filtered)

                merged_content = self._merge_chunk_contents(all_contents)

                # Fallback: 章节提取后内容为空，直接使用原始 chunk 内容
                if not merged_content.strip() and raw_contents:
                    merged_content = self._merge_chunk_contents(raw_contents)
                    logger.info(f"[合并] 章节提取为空，回退到原始内容: {len(doc_data['chunks'])}个chunk → {len(merged_content)}字符")
                else:
                    logger.info(f"[合并] 章节{target_main_chapter}: {len(doc_data['chunks'])}个chunk → {len(all_contents)}个 → {len(merged_content)}字符")

                return {
                    'templateId': int(doc_meta.get('templateId', 0)) if doc_meta.get('templateId') else 0,
                    'templateName': str(doc_meta.get('templateName', '未知模板')),
                    'chunkId': safe_get(doc_data['chunks'][0], 'id', '') if doc_data['chunks'] else '',
                    'chunkContent': merged_content,
                    'chapterTitle': self._extract_title(merged_content),
                    'similarity': doc_data['max_similarity'],
                    'matchType': 'auto',
                    'documentName': doc_data['document_name']
                }

            # 按相似度排序文档
            sorted_docs = sorted(
                doc_chunks_map.items(),
                key=lambda x: x[1]['max_similarity'],
                reverse=True
            )

            # 构建结果
            results = [build_merged_result(doc_id, doc_data) for doc_id, doc_data in sorted_docs]

            # 过滤掉内容为空的结果
            results = [r for r in results if r['chunkContent'].strip()]

            if not results:
                logger.warning("❌ 合并后无有效内容")
                return {'matched': None, 'alternatives': []}

            matched = results[0]
            alternatives = results[1:limit] if len(results) > 1 else []

            logger.info(f"返回 1 个匹配 + {len(alternatives)} 个备选")
            return {'matched': matched, 'alternatives': alternatives}

        except Exception as e:
            logger.error(f"模板检索失败: {e}", exc_info=True)
            return {'matched': None, 'alternatives': []}

    def _build_permission_filter(
        self,
        user_id: str
    ) -> dict:
        """
        构建基于 meta_fields 的权限过滤条件

        过滤逻辑:
        - 系统标准模板 (isStandard="true") 对所有人可见
        - 个人私有模板 (isStandard="false") 仅对所有者可见

        标签过滤在检索后通过 step 7 进行字段级后过滤（profession / business_type）。

        RAGFlow metadata_condition 格式:
        {
            "logic": "or",  # and/or
            "conditions": [
                {"name": "field_name", "comparison_operator": "is", "value": "xxx"}
            ]
        }

        支持的 comparison_operator: is, not is, contains, not contains, in, not in,
                                    start with, end with, >, <, ≥, ≤, empty, not empty
        """
        # 构建权限过滤条件: isStandard="true" OR userId=user_id
        permission_filter = {
            "logic": "or",
            "conditions": [
                # 条件1: 系统标准模板 (所有人可见)
                {"name": "isStandard", "comparison_operator": "is", "value": "true"},
                # 条件2: 个人私有模板 (userId 匹配)
                {"name": "userId", "comparison_operator": "is", "value": user_id}
            ]
        }

        # 注意: 标签过滤通过后处理实现（见 search() 中的"标签后过滤"步骤）
        # 因为 tags 存储为逗号分隔字符串，RAGFlow 的 metadata_condition 不支持复杂的字符串匹配

        return permission_filter

    def _get_document_meta_fields(self, document_id: str) -> dict:
        """获取文档的 meta_fields（优先从缓存）"""
        if not document_id:
            return {}

        # 优先从缓存获取
        if document_id in self._doc_meta_cache:
            return self._doc_meta_cache[document_id]

        # 缓存未命中，从知识库获取
        try:
            datasets = self.rag.list_datasets(name=PERSONAL_TEMPLATE_KB_NAME)
            if not datasets:
                self._doc_meta_cache[document_id] = {}
                return {}

            docs = datasets[0].list_documents(id=document_id)
            if not docs or not hasattr(docs, '__getitem__'):
                self._doc_meta_cache[document_id] = {}
                return {}

            target_doc = docs[0]

            # 兼容字典和对象两种情况
            if isinstance(target_doc, dict):
                meta_fields = target_doc.get('meta_fields', {})
            else:
                meta_fields_obj = getattr(target_doc, 'meta_fields', None)
                # 如果是 Base 对象，使用 to_json() 转换为字典
                if meta_fields_obj is not None and hasattr(meta_fields_obj, 'to_json'):
                    meta_fields = meta_fields_obj.to_json()
                elif isinstance(meta_fields_obj, dict):
                    meta_fields = meta_fields_obj
                else:
                    meta_fields = {}

            if not isinstance(meta_fields, dict):
                self._doc_meta_cache[document_id] = {}
                return {}

            # 清理 meta_fields，只保留可序列化的基本类型
            cleaned_meta = {
                k: v for k, v in meta_fields.items()
                if isinstance(v, (str, int, float, bool, type(None)))
            }

            self._doc_meta_cache[document_id] = cleaned_meta
            return cleaned_meta

        except Exception as e:
            logger.error(f"获取文档 meta_fields 失败: {e}")
            self._doc_meta_cache[document_id] = {}
            return {}

    def _get_template_kb_ids(self) -> List[str]:
        """获取模板知识库ID"""
        kb_id = self._get_kb_id_by_name(PERSONAL_TEMPLATE_KB_NAME)
        return [kb_id] if kb_id else []

    def _get_kb_id_by_name(self, name: str) -> Optional[str]:
        """根据名称获取知识库ID"""
        try:
            datasets = self.rag.list_datasets()
            for ds in datasets:
                if ds.name == name:
                    return ds.id
        except Exception as e:
            logger.error(f"获取知识库失败: {e}")
        return None

    def _extract_title(self, content: str) -> str:
        """从内容中提取章节标题 (通常是第一行)"""
        if not content:
            return ""
        first_line = content.split('\n')[0].strip()
        # 清理 markdown 格式
        first_line = re.sub(r'^#+\s*', '', first_line)
        return first_line

    def _merge_chunk_contents(self, contents: list) -> str:
        """
        合并多个 chunk 的内容，去除重复部分

        Args:
            contents: chunk 内容列表

        Returns:
            合并后的内容
        """
        if not contents:
            return ""

        if len(contents) == 1:
            return contents[0]

        # 按章节号排序内容
        # 提取每个内容的第一个章节号用于排序
        def get_first_chapter_num(content: str) -> tuple:
            """提取内容的第一个章节号，用于排序"""
            lines = content.split('\n')
            for line in lines:
                line = line.strip()
                # 移除 Markdown 标记
                line = re.sub(r'^#+\s*', '', line)
                # 匹配章节号
                match = re.match(r'^(\d+)(?:\.(\d+))?(?:\.(\d+))?', line)
                if match:
                    parts = [int(p) if p else 0 for p in match.groups()]
                    return tuple(parts)
            return (999, 999, 999)  # 无章节号的放最后

        # 按章节号排序
        sorted_contents = sorted(contents, key=get_first_chapter_num)

        # 合并内容，跳过重复行
        seen_lines = set()
        merged_lines = []

        for content in sorted_contents:
            for line in content.split('\n'):
                # 使用去除空格后的行作为去重 key
                line_key = line.strip()
                if line_key and line_key not in seen_lines:
                    seen_lines.add(line_key)
                    merged_lines.append(line)

        return '\n'.join(merged_lines)

