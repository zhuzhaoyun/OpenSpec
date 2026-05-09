"""
操作记录存储与查询服务
"""
import os
import json
import logging
from datetime import datetime

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


def _get_conn_str() -> str:
    return os.getenv(
        "POSTGRES_URL",
        "postgresql://archspec:archspec_doc_pass@localhost:5433/doc_generator",
    )


def _get_connection():
    return psycopg.connect(_get_conn_str(), row_factory=dict_row)


def ensure_table():
    """确保 operation_record 表存在"""
    try:
        with _get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS operation_record (
                        id            BIGSERIAL PRIMARY KEY,
                        user_id       VARCHAR(50)   NOT NULL,
                        document_id   VARCHAR(100)  NOT NULL,
                        chapter_name  VARCHAR(200),
                        action_type   VARCHAR(50)   NOT NULL,
                        action_detail TEXT,
                        context       JSONB         DEFAULT '{}',
                        created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_operation_record_user_id
                    ON operation_record(user_id)
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_operation_record_document
                    ON operation_record(user_id, document_id)
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_operation_record_time
                    ON operation_record(created_at DESC)
                """)
            conn.commit()
        logger.info("operation_record table ensured")
    except Exception as e:
        logger.error(f"Failed to ensure operation_record table: {e}")


def save_records(records: list[dict]) -> int:
    """
    批量保存操作记录。返回成功插入的条数。
    """
    if not records:
        return 0

    saved = 0
    try:
        with _get_connection() as conn:
            with conn.cursor() as cur:
                for r in records:
                    cur.execute(
                        """
                        INSERT INTO operation_record
                            (user_id, document_id, chapter_name, action_type, action_detail, context)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        (
                            r["user_id"],
                            r["document_id"],
                            r.get("chapter_name"),
                            r["action_type"],
                            r.get("action_detail"),
                            Jsonb(r.get("context", {})),
                        ),
                    )
                    saved += 1
            conn.commit()
        logger.info(f"Saved {saved} operation records")
    except Exception as e:
        logger.error(f"Failed to save operation records: {e}")
    return saved


def list_records(
    user_id: str,
    document_id: str | None = None,
    action_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """查询操作记录，支持按文档和操作类型过滤"""
    try:
        conditions = ["user_id = %s"]
        params: list = [user_id]

        if document_id:
            conditions.append("document_id = %s")
            params.append(document_id)
        if action_type:
            conditions.append("action_type = %s")
            params.append(action_type)

        where_clause = " AND ".join(conditions)
        params.extend([limit, offset])

        with _get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT id, user_id, document_id, chapter_name,
                           action_type, action_detail, context, created_at
                    FROM operation_record
                    WHERE {where_clause}
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                    """,
                    params,
                )
                rows = cur.fetchall()
        return [_row_to_dict(r) for r in rows]
    except Exception as e:
        logger.error(f"Failed to list operation records: {e}")
        return []


def clear_records(user_id: str, document_id: str) -> int:
    """清空指定文档的操作记录，返回删除条数"""
    try:
        with _get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM operation_record WHERE user_id = %s AND document_id = %s",
                    (user_id, document_id),
                )
                deleted = cur.rowcount
            conn.commit()
        logger.info(f"Cleared {deleted} operation records for document {document_id}")
        return deleted
    except Exception as e:
        logger.error(f"Failed to clear operation records: {e}")
        return 0


def _row_to_dict(row: dict) -> dict:
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "document_id": row["document_id"],
        "chapter_name": row.get("chapter_name"),
        "action_type": row["action_type"],
        "action_detail": row.get("action_detail"),
        "context": row.get("context", {}),
        "created_at": row["created_at"].isoformat() + "Z"
        if isinstance(row["created_at"], datetime)
        else str(row["created_at"]),
    }
