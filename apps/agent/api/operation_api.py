"""
操作记录 API
提供操作记录的批量上报和查询接口
"""
import logging
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional

from service.operation.operation_service import save_records, list_records, clear_records

logger = logging.getLogger(__name__)

operation_router = APIRouter(prefix="/agent/operation")


class OperationRecordItem(BaseModel):
    document_id: str
    chapter_name: Optional[str] = None
    action_type: str
    action_detail: Optional[str] = None
    context: Optional[dict] = None
    created_at: Optional[str] = None


class BatchRecordRequest(BaseModel):
    records: list[OperationRecordItem]


@operation_router.post("/record")
async def batch_save_records(request: Request, body: BatchRecordRequest):
    """批量上报操作记录"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        return {"code": 401, "message": "未登录"}

    records = []
    for item in body.records:
        records.append({
            "user_id": user_id,
            "document_id": item.document_id,
            "chapter_name": item.chapter_name,
            "action_type": item.action_type,
            "action_detail": item.action_detail,
            "context": item.context or {},
            "created_at": item.created_at,
        })

    saved = save_records(records)
    return {"code": 200, "data": {"saved": saved}}


@operation_router.get("/list")
async def get_operation_list(
    request: Request,
    document_id: Optional[str] = None,
    action_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    """获取当前用户的操作记录列表"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        return {"code": 401, "message": "未登录"}

    records = list_records(
        user_id,
        document_id=document_id,
        action_type=action_type,
        limit=limit,
        offset=offset,
    )
    return {"code": 200, "data": records}


@operation_router.delete("/clear")
async def clear_operation_records(request: Request, document_id: str):
    """清空指定文档的操作记录"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        return {"code": 401, "message": "未登录"}

    deleted = clear_records(user_id, document_id)
    return {"code": 200, "data": {"deleted": deleted}}
