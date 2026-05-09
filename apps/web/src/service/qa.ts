import { authFetch } from '@/utils/auth'

// --- 类型定义 ---

export interface DocReference {
  document_id: string
  document_name: string
}

export interface ChunkReference {
  doc_id: string
  doc_name: string
  content?: string
  chunk_content?: string
  position?: any
  image_id?: string
  type?: string
}

export interface ChatChunk {
  content: string
  sessionId?: string
  thoughts?: string
  doc_reference: DocReference[]
  chunk_reference: ChunkReference[]
}

export interface ChatCompleteResponse {
  content: string
  sessionId?: string
  thoughts?: string
}

// --- API 配置 ---

const QA_BASE_URL = import.meta.env.DEV
  ? 'http://localhost:5000'
  : (import.meta.env.VITE_QA_BASE_URL || 'https://cm.aizzyun.com')

const FIXED_SESSION_ID = '8dc216e7c7074b938fa479a5ab047988'

// --- 核心函数 ---

/**
 * 调用 RAGFlow chat_with_assistant 流式接口
 * SSE 解析逻辑参考 bsp-user-front/src/services/rag.ts sendMessageToRagService()
 */
export async function chatWithAssistant(
  prompt: string,
  sessionId: string = FIXED_SESSION_ID,
  chatId: string,
  onChunk?: (chunk: ChatChunk) => void,
  onComplete?: (response: ChatCompleteResponse) => void,
  signal?: AbortSignal,
  
): Promise<ChatCompleteResponse | undefined> {
  const params: Record<string, string> = {
    prompt,
    session_id: sessionId,
    chat_id: chatId
  }
  const fullUrl = `${QA_BASE_URL}/agent/rag/ragflow/chat_electric_qa`

  const response = await authFetch(fullUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  if (!response.body) {
    throw new Error('ReadableStream not supported in this browser.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  let fullContent = ''
  let currentSessionId = sessionId
  let allThoughts = ''
  let sseBuffer = ''
  let sseMode = false

  while (true) {
    if (signal?.aborted) {
      reader.cancel()
      throw new DOMException('The operation was aborted.', 'AbortError')
    }

    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })

    try {
      if (chunk.includes('data:') || sseMode) {
        // SSE 模式
        sseMode = true
        sseBuffer += chunk
        if (sseBuffer.includes('\n\n')) {
          const events = sseBuffer.split('\n\n')
          sseBuffer = events.pop() || ''
          for (const event of events) {
            const dataLines = event.split('\n').filter((l) => l.startsWith('data:'))
            if (dataLines.length === 0) continue
            const payload = dataLines.map((l) => l.slice(5).trim()).join('\n')
            try {
              if (payload.trim().startsWith('{') || payload.trim().startsWith('[')) {
                const jsonChunk = JSON.parse(payload)
                const eventContent = jsonChunk.data?.text || jsonChunk.text || ''
                const eventSessionId = jsonChunk.data?.session_id || jsonChunk.session_id || currentSessionId
                const newThoughts = jsonChunk.data?.thoughts || jsonChunk.thoughts || ''
                const eventThoughts = typeof newThoughts === 'string' ? newThoughts : ''
                const doc_ref_list: DocReference[] = jsonChunk.doc_reference || []
                const chunk_ref_list: ChunkReference[] = jsonChunk.chunk_reference || []

                fullContent += eventContent
                currentSessionId = eventSessionId || currentSessionId
                if (eventThoughts) allThoughts += eventThoughts

                if (onChunk) {
                  onChunk({
                    content: eventContent,
                    sessionId: currentSessionId,
                    thoughts: eventThoughts,
                    doc_reference: doc_ref_list,
                    chunk_reference: chunk_ref_list,
                  })
                }
              }
            } catch {
              console.warn('SSE payload parse failed, skip this event')
            }
          }
        }
      } else {
        // 原始 JSON fallback 模式
        const trimmed = chunk.trim()
        if (trimmed && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
          try {
            const jsonChunk = JSON.parse(trimmed)
            const chunkContent = jsonChunk.data?.text || jsonChunk.text || ''
            const chunkSessionId = jsonChunk.data?.session_id || jsonChunk.session_id || currentSessionId
            const chunkThoughts = jsonChunk.data?.thoughts || jsonChunk.thoughts || ''
            const doc_ref_list: DocReference[] = jsonChunk.doc_reference || []
            const chunk_ref_list: ChunkReference[] = jsonChunk.chunk_reference || []

            fullContent += chunkContent
            currentSessionId = chunkSessionId
            if (chunkThoughts) allThoughts += chunkThoughts

            if (onChunk) {
              onChunk({
                content: chunkContent,
                sessionId: chunkSessionId,
                thoughts: typeof chunkThoughts === 'string' ? chunkThoughts : '',
                doc_reference: doc_ref_list,
                chunk_reference: chunk_ref_list,
              })
            }
          } catch {
            console.warn('Non-SSE JSON parse failed, treat as text')
          }
        }
      }
    } catch (e) {
      console.warn('Failed to parse chunk:', e)
    }
  }

  const fullResponse: ChatCompleteResponse = {
    content: fullContent,
    sessionId: currentSessionId,
    thoughts: allThoughts,
  }

  if (onComplete) {
    onComplete(fullResponse)
  }

  return fullResponse
}

// --- Chat Assistant 管理 API ---

/**
 * 查询对话列表
 */
export async function listChatAssistants(params?: {
  page?: number
  page_size?: number
  name?: string
  keywords?: string
}): Promise<any[]> {
  const query = new URLSearchParams()
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) query.append(k, String(v))
    })
  }
  const qs = query.toString()
  const url = `${QA_BASE_URL}/agent/rag/ragflow/chat_assistant/list${qs ? '?' + qs : ''}`
  const res = await authFetch(url)
  if (!res.ok) throw new Error(`查询对话列表失败: ${res.status}`)
  const json = await res.json()
  return json.data || json || []
}

/**
 * 创建对话
 */
export async function createChatAssistant(name: string): Promise<any> {
  const res = await authFetch(`${QA_BASE_URL}/agent/rag/ragflow/chat_assistant/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(`创建对话失败: ${res.status}`)
  const json = await res.json()
  return json.data || json
}

/**
 * 删除对话
 */
export async function deleteChatAssistants(ids: string[]): Promise<void> {
  const res = await authFetch(`${QA_BASE_URL}/agent/rag/ragflow/chat_assistant/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) throw new Error(`删除对话失败: ${res.status}`)
}

/**
 * 查询 session 列表
 */
export async function listChatSessions(chatId: string, params?: {
  page?: number
  page_size?: number
}): Promise<any[]> {
  const res = await authFetch(`${QA_BASE_URL}/agent/rag/ragflow/chat_assistant/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, ...params }),
  })
  if (!res.ok) throw new Error(`查询session列表失败: ${res.status}`)
  const json = await res.json()
  return json.data || json || []
}

/**
 * 创建 session
 */
export async function createChatSession(chatId: string): Promise<any> {
  const res = await authFetch(`${QA_BASE_URL}/agent/rag/ragflow/create_chat_session_by_id?chat_id=${encodeURIComponent(chatId)}`)
  if (!res.ok) throw new Error(`创建session失败: ${res.status}`)
  const json = await res.json()
  return json.data || json
}
