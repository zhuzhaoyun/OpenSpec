// ===== 层级数据模型 =====

export interface Standard {
  id: string
  number: string         // GB 50052-2009
  name: string           // 供配电系统设计规范
  profession: string
  status: 'active' | 'superseded'
  supersededBy?: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface Clause {
  id: string
  standardId: string
  clauseNumber: string     // 3.0.2
  title: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface Checkpoint {
  id: string
  clauseId: string
  description: string
  severity: 'critical' | 'warning' | 'suggestion'
  matchKeywords: string[]
  createdAt: string
  updatedAt: string
}

// ===== 前端展示用：带子项的 Standard =====

export interface StandardTreeNode {
  standard: Standard
  clauses: ClauseTreeNode[]
}

export interface ClauseTreeNode {
  clause: Clause
  checkpoints: Checkpoint[]
  expanded?: boolean
}

export const PROFESSION_OPTIONS = [
  { value: '电气', label: '电气' },
  { value: '给排水', label: '给排水' },
  { value: '暖通', label: '暖通' },
  { value: '建筑', label: '建筑' },
  { value: '结构', label: '结构' },
]

// =====================================================================
// Java Backend API 调用（对应 /api/v1/standards, /api/v1/clauses, /api/v1/checkpoints）
// =====================================================================

import { getAuthorization } from '@/utils/auth'

function getApiHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  const authorization = getAuthorization()
  if (authorization) headers['Authorization'] = authorization
  return headers
}

const API_BASE = '/api/v1'

/** 解析 JSON 字符串字段（tags/matchKeywords） */
function parseJsonField(val: string | null | undefined): string[] {
  if (!val) return []
  try { return JSON.parse(val) } catch { return [] }
}

/** 将 API 返回的 StandardTreeNode 中的 JSON 字段解析为前端可用的格式 */
function transformTreeNode(node: any): StandardTreeNode {
  return {
    ...node,
    clauses: (node.clauses || []).map((ct: any) => ({
      clause: {
        ...ct.clause,
        tags: parseJsonField(ct.clause.tags),
      },
      checkpoints: (ct.checkpoints || []).map((cp: any) => ({
        ...cp,
        matchKeywords: parseJsonField(cp.matchKeywords),
      })),
    })),
  }
}

// ===== Standard API =====

export async function getStandardsApi(params?: {
  profession?: string; keyword?: string; page?: number; pageSize?: number
}): Promise<{ list: Standard[]; total: number }> {
  const q = new URLSearchParams()
  if (params?.profession) q.set('profession', params.profession)
  if (params?.keyword) q.set('keyword', params.keyword)
  if (params?.page) q.set('page', String(params.page))
  if (params?.pageSize) q.set('pageSize', String(params.pageSize))
  const res = await fetch(`${API_BASE}/standards?${q}`, { headers: getApiHeaders() })
  const json = await res.json()
  if (json.code === 200) return json.data
  throw new Error(json.message || '获取标准列表失败')
}

export async function getStandardTreeApi(): Promise<StandardTreeNode[]> {
  const res = await fetch(`${API_BASE}/standards/tree`, { headers: getApiHeaders() })
  const json = await res.json()
  if (json.code === 200) {
    return (json.data || []).map(transformTreeNode)
  }
  throw new Error(json.message || '获取标准树失败')
}

export async function createStandardApi(data: {
  number: string; name: string; profession: string; status?: string;
  supersededBy?: string; description?: string
}): Promise<Standard> {
  const res = await fetch(`${API_BASE}/standards`, {
    method: 'POST',
    headers: { ...getApiHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (json.code === 200 || json.code === 201) return json.data
  throw new Error(json.message || '新增标准失败')
}

export async function updateStandardApi(id: string, data: Partial<Standard>): Promise<Standard> {
  const res = await fetch(`${API_BASE}/standards/${id}`, {
    method: 'PUT',
    headers: { ...getApiHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (json.code === 200) return json.data
  throw new Error(json.message || '更新标准失败')
}

export async function deleteStandardApi(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/standards/${id}`, {
    method: 'DELETE',
    headers: getApiHeaders(),
  })
  const json = await res.json()
  if (json.code === 200) return true
  throw new Error(json.message || '删除标准失败')
}

// ===== Clause API =====

export async function getClausesByStandardApi(standardId: string): Promise<ClauseTreeNode[]> {
  const res = await fetch(`${API_BASE}/clauses?standardId=${standardId}`, { headers: getApiHeaders() })
  const json = await res.json()
  if (json.code === 200) {
    return (json.data || []).map((ct: any) => ({
      clause: { ...ct.clause, tags: parseJsonField(ct.clause.tags) },
      checkpoints: (ct.checkpoints || []).map((cp: any) => ({
        ...cp,
        matchKeywords: parseJsonField(cp.matchKeywords),
      })),
    }))
  }
  throw new Error(json.message || '获取条文列表失败')
}

export async function createClauseApi(data: {
  standardId: string; clauseNumber: string;
  title: string; content: string; tags?: string[]
}): Promise<Clause> {
  const res = await fetch(`${API_BASE}/clauses`, {
    method: 'POST',
    headers: { ...getApiHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (json.code === 200 || json.code === 201) return json.data
  throw new Error(json.message || '新增条文失败')
}

export async function updateClauseApi(id: string, data: Partial<Clause>): Promise<Clause> {
  const res = await fetch(`${API_BASE}/clauses/${id}`, {
    method: 'PUT',
    headers: { ...getApiHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (json.code === 200) return json.data
  throw new Error(json.message || '更新条文失败')
}

export async function deleteClauseApi(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/clauses/${id}`, {
    method: 'DELETE',
    headers: getApiHeaders(),
  })
  const json = await res.json()
  if (json.code === 200) return true
  throw new Error(json.message || '删除条文失败')
}

// ===== Checkpoint API =====

export async function getCheckpointsByClauseApi(clauseId: string): Promise<Checkpoint[]> {
  const res = await fetch(`${API_BASE}/checkpoints?clauseId=${clauseId}`, { headers: getApiHeaders() })
  const json = await res.json()
  if (json.code === 200) {
    return (json.data || []).map((cp: any) => ({
      ...cp,
      matchKeywords: parseJsonField(cp.matchKeywords),
    }))
  }
  throw new Error(json.message || '获取检查点列表失败')
}

export async function createCheckpointApi(data: {
  clauseId: string; description: string; severity: Checkpoint['severity']; matchKeywords?: string[]
}): Promise<Checkpoint> {
  const res = await fetch(`${API_BASE}/checkpoints`, {
    method: 'POST',
    headers: { ...getApiHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (json.code === 200 || json.code === 201) return json.data
  throw new Error(json.message || '新增检查点失败')
}

export async function updateCheckpointApi(id: string, data: Partial<Checkpoint>): Promise<Checkpoint> {
  const res = await fetch(`${API_BASE}/checkpoints/${id}`, {
    method: 'PUT',
    headers: { ...getApiHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (json.code === 200) return json.data
  throw new Error(json.message || '更新检查点失败')
}

export async function deleteCheckpointApi(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/checkpoints/${id}`, {
    method: 'DELETE',
    headers: getApiHeaders(),
  })
  const json = await res.json()
  if (json.code === 200) return true
  throw new Error(json.message || '删除检查点失败')
}
