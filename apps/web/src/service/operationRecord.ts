/**
 * 操作记录 API 服务
 */
import { authFetch } from '@/utils/auth'

const OPERATION_BASE_URL = '/agent/operation'

export interface OperationRecord {
  id?: number
  user_id?: string
  document_id: string
  chapter_name?: string
  action_type: string
  action_detail?: string
  context?: Record<string, any>
  created_at?: string
}

/**
 * 批量上报操作记录
 */
export async function saveOperationRecords(records: OperationRecord[]): Promise<number> {
  try {
    const res = await authFetch(`${OPERATION_BASE_URL}/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    })
    const json = await res.json()
    return json.code === 200 ? json.data?.saved ?? 0 : 0
  } catch {
    return 0
  }
}

/**
 * 获取操作记录列表
 */
export async function listOperationRecords(
  params: {
    document_id?: string
    action_type?: string
    limit?: number
    offset?: number
  } = {}
): Promise<OperationRecord[]> {
  const query = new URLSearchParams()
  if (params.document_id) query.set('document_id', params.document_id)
  if (params.action_type) query.set('action_type', params.action_type)
  if (params.limit) query.set('limit', String(params.limit))
  if (params.offset) query.set('offset', String(params.offset))

  try {
    const res = await authFetch(`${OPERATION_BASE_URL}/list?${query.toString()}`)
    const json = await res.json()
    return json.code === 200 ? json.data : []
  } catch {
    return []
  }
}

/**
 * 清空指定文档的操作记录
 */
export async function clearOperationRecords(documentId: string): Promise<boolean> {
  try {
    const res = await authFetch(`${OPERATION_BASE_URL}/clear?document_id=${encodeURIComponent(documentId)}`, {
      method: 'DELETE',
    })
    const json = await res.json()
    return json.code === 200
  } catch {
    return false
  }
}

/**
 * 操作类型中文映射
 */
export const ACTION_TYPE_LABELS: Record<string, string> = {
  content_generated: 'AI生成内容',
  content_saved: '保存内容',
  content_edited: '编辑内容',
  generation_stopped: '停止生成',
  chapter_switched: '切换章节',
  batch_generated: '一键生成',
  document_exported: '导出文档',
}
