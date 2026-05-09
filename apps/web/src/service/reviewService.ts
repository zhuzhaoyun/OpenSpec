// ===== 类型定义 =====

export type ReviewSeverity = 'critical' | 'warning' | 'suggestion'
export type ReviewDimension = 'compliance' | 'completeness' | 'terminology' | 'consistency'
export type ReviewIssueStatus = 'pending' | 'resolved' | 'ignored'

export interface ReviewIssue {
  id: string
  severity: ReviewSeverity
  dimension: ReviewDimension
  title: string
  description: string
  originalSnippet: string
  chapterRef?: string
  standardRef?: string
  standardClause?: string
  standardText?: string
  suggestionText?: string
  status: ReviewIssueStatus
  // 关联字段（用于交叉导航）
  standardId?: string
  clauseId?: string
  checkpointId?: string
  /** 原文中匹配位置（用于滚动定位） */
  snippetStart?: number
}

export interface ReviewRecord {
  id: string
  documentName: string
  content: string
  dimensions: ReviewDimension[]
  standardIds: string[]
  issues: ReviewIssue[]
  severityCounts: {
    critical: number
    warning: number
    suggestion: number
    terminology: number
  }
  status: 'pending' | 'all_handled'
  createdAt: string
  updatedAt: string
}

export interface StandardScope {
  standardId: string
  number: string
  name: string
  profession: string
  status: string
  clauseCount: number
  checkpointCount: number
  selected: boolean
}

// ===== 从后端获取标准列表（供手动添加使用） =====

export async function fetchAllStandards(): Promise<{ id: string; number: string; name: string; profession: string }[]> {
  const res = await getStandardsApi()
  return res.list.map(s => ({ id: s.id, number: s.number, name: s.name, profession: s.profession }))
}

// ===== 从后端获取范围统计 =====

export async function fetchStandardScope(standardIds: string[]): Promise<StandardScope[]> {
  const tree = await getStandardTreeApi()
  const filtered = tree.filter(node => standardIds.includes(node.standard.id))
  return filtered.map(node => ({
    standardId: node.standard.id,
    number: node.standard.number,
    name: node.standard.name,
    profession: node.standard.profession,
    status: node.standard.status,
    clauseCount: node.clauses.length,
    checkpointCount: node.clauses.reduce((sum, c) => sum + (c.checkpoints || []).length, 0),
    selected: true,
  }))
}

// ===== 审查记录适配 =====

export interface ReviewRecordListItemData {
  id: string
  userId: string
  documentName: string
  dimensions: string[] | string
  standardIds: string[] | string
  summary: Record<string, number> | string
  status: string
  errorMessage?: string
  ossFileKey?: string
  createdAt: string
  updatedAt: string
}

export interface ReviewSourceAccessData {
  reviewId: string
  documentName: string
  ossFileKey: string
  fileName: string
  contentType: string
  accessUrl: string
  expiresAt: string
}

async function parseApiResponse<T>(res: Response, defaultMessage: string): Promise<T> {
  let json: { code?: number; message?: string; data?: T } | null = null
  try {
    json = await res.json()
  } catch {
    json = null
  }

  if (res.ok && json && (json.code === 200 || json.code === 201)) {
    return json.data as T
  }

  throw new Error(json?.message || defaultMessage)
}

// =====================================================================
// Java Backend API 调用（对应 /api/v1/reviews）
// =====================================================================

import { getAuthorization } from '@/utils/auth'
import { getStandardsApi, getStandardTreeApi } from '@/service/standardClauses'

function getApiHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  const authorization = getAuthorization()
  if (authorization) headers['Authorization'] = authorization
  return headers
}

const REVIEW_API_BASE = '/api/v1/reviews'

interface ReviewNotFoundError extends Error {
  reviewNotFound: true
}

function createReviewNotFoundError(message: string): ReviewNotFoundError {
  const error = new Error(message) as ReviewNotFoundError
  error.reviewNotFound = true
  return error
}

export interface ReviewRecordData {
  id: string
  userId: string
  documentName: string
  content: string
  ossFileKey?: string
  dimensions: string[] | string
  standardIds: string[] | string
  summary: Record<string, number> | string
  status: string
  errorMessage?: string
  issues: ReviewIssue[]
  createdAt: string
  updatedAt: string
}

export async function createReviewApi(data: {
  documentName: string
  dimensions: string[]
  standardIds: string[]
  ossFileKey: string
  clawithSessionId?: string
}): Promise<{ id: string; status: string; manifestUrl?: string }> {
  const res = await fetch(REVIEW_API_BASE, {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify(data),
  })
  return parseApiResponse<{ id: string; status: string; manifestUrl?: string }>(
    res,
    '发起审查失败',
  )
}

export async function getReviewApi(id: string): Promise<ReviewRecordData> {
  const res = await fetch(`${REVIEW_API_BASE}/${id}`, { headers: getApiHeaders() })
  return parseReviewApiResponse<ReviewRecordData>(res, '获取审查结果失败')
}

export async function getReviewListApi(params?: {
  page?: number
  pageSize?: number
}): Promise<{ list: ReviewRecordListItemData[]; total: number; page: number; pageSize: number }> {
  const q = new URLSearchParams()
  if (params?.page) q.set('page', String(params.page))
  if (params?.pageSize) q.set('pageSize', String(params.pageSize))
  const suffix = q.toString() ? `?${q.toString()}` : ''
  const res = await fetch(`${REVIEW_API_BASE}${suffix}`, { headers: getApiHeaders() })
  return parseApiResponse<{ list: ReviewRecordListItemData[]; total: number; page: number; pageSize: number }>(
    res,
    '获取审查列表失败',
  )
}

export async function getReviewSourceAccessApi(id: string): Promise<ReviewSourceAccessData> {
  const res = await fetch(`${REVIEW_API_BASE}/${id}/source-access`, { headers: getApiHeaders() })
  return parseReviewApiResponse<ReviewSourceAccessData>(res, '获取源文件访问地址失败')
}

async function parseReviewApiResponse<T>(res: Response, defaultMessage: string): Promise<T> {
  let json: { code?: number; message?: string; data?: T } | null = null
  try {
    json = await res.json()
  } catch {
    json = null
  }

  if (json?.code === 404) {
    throw createReviewNotFoundError(json?.message || '审查记录不存在')
  }

  if (res.ok && json && (json.code === 200 || json.code === 201)) {
    return json.data as T
  }

  throw new Error(json?.message || defaultMessage)
}

export async function deleteReviewApi(id: string): Promise<boolean> {
  const res = await fetch(`${REVIEW_API_BASE}/${id}`, {
    method: 'DELETE',
    headers: getApiHeaders(),
  })
  await parseApiResponse<void>(res, '删除审查记录失败')
  return true
}

export async function updateIssueStatusApi(recordId: string, issueId: string, status: string): Promise<any> {
  const res = await fetch(`${REVIEW_API_BASE}/${recordId}/issues/${issueId}`, {
    method: 'PUT',
    headers: { ...getApiHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  return parseApiResponse<any>(res, '更新问题状态失败')
}

export async function updateReviewResultsApi(
  id: string,
  data: { summary: string; issues: any[] },
): Promise<void> {
  const res = await fetch(`${REVIEW_API_BASE}/${id}/results`, {
    method: 'PUT',
    headers: getApiHeaders(),
    body: JSON.stringify(data),
  })
  await parseApiResponse<void>(res, '写入审查结果失败')
}

export async function updateClawithSessionApi(
  id: string,
  clawithSessionId: string,
): Promise<void> {
  const res = await fetch(`${REVIEW_API_BASE}/${id}/clawith-session`, {
    method: 'PATCH',
    headers: getApiHeaders(),
    body: JSON.stringify({ clawithSessionId }),
  })
  await parseApiResponse<void>(res, '绑定 Clawith session 失败')
}

// =====================================================================
// OSS 直传（服务端签名 + 浏览器直传）
// =====================================================================

export interface OssUploadSignature {
  host: string
  dir: string
  policy: string
  signature: string
  x_oss_credential: string
  x_oss_date: string
  version: string
}

export async function getOssUploadSignature(): Promise<OssUploadSignature> {
  const res = await fetch('/api/v1/oss/upload-signature', { headers: getApiHeaders() })
  const json = await res.json()
  if (json.code === 200) return json.data
  throw new Error(json.message || '获取上传签名失败')
}

function generateOssKey(dir: string, filename: string): string {
  const now = new Date()
  const yyyyMM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const uuid = crypto.randomUUID()
  return `${dir}${yyyyMM}/${uuid}_${filename}`
}

export async function uploadFileToOss(file: File, sig: OssUploadSignature): Promise<string> {
  const key = generateOssKey(sig.dir, file.name)
  const formData = new FormData()
  formData.append('key', key)
  formData.append('policy', sig.policy)
  formData.append('x-oss-signature-version', 'OSS4-HMAC-SHA256')
  formData.append('x-oss-credential', sig.x_oss_credential)
  formData.append('x-oss-date', sig.x_oss_date)
  formData.append('x-oss-signature', sig.signature)
  formData.append('success_action_status', '200')
  formData.append('file', file)

  const res = await fetch(sig.host, { method: 'POST', body: formData })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OSS 上传失败 (${res.status}): ${text}`)
  }
  return key
}
