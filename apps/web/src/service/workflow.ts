/**
 * Workflow API 服务
 * 基于 LangGraph ReAct Agent，提供流式对话接口
 */
import { authFetch } from '@/utils/auth'

export interface WorkflowChatRequest {
  message: string
  project_id?: string
  template?: string
  project_info?: string
  user_id?: string
  document_id?: string  // 文档 ID，用作 session_id
  enable_audit?: boolean  // 是否启用校验
  enable_citation?: boolean  // 是否启用引用标记
  chapter_name?: string  // 当前生成的章节名称（用于记忆召回）
  additional_requirements?: string  // 用户补充要求（用于记忆保存）
  memory_window?: number  // 记忆天数限制（最近 N 天）
  memory_chapters?: string[]  // 指定召回的章节名称列表
  // 标签字段：用于动态知识库选择
  profession_tag_id?: number  // 专业标签 ID
  business_type_tag_id?: number  // 业态标签 ID
}

export interface SSEEvent {
  event: string
  data: any
}

const WORKFLOW_BASE_URL = '/agent'

/**
 * 调用工作流流式聊天接口
 * @param request 请求参数
 * @param onEvent SSE 事件回调（处理 timeline_step、token、tool_call 等）
 * @param signal AbortSignal (用于取消请求)
 */
export async function workflowChatStream(
  request: WorkflowChatRequest,
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const url = `${WORKFLOW_BASE_URL}/workflow/chat/stream`

  const response = await authFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    credentials: 'include',
    signal
  })

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  if (!response.body) {
    throw new Error('ReadableStream not supported in this browser.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    // 检查是否已被中断
    if (signal?.aborted) {
      reader.cancel()
      throw new Error('AbortError')
    }

    const { done, value } = await reader.read()
    if (done) break

    // 解码二进制数据
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n\n')
    buffer = lines.pop() || '' // 保留最后一个不完整的块

    // 解析 SSE 事件
    for (const line of lines) {
      if (line.trim().startsWith('event: ')) {
        const parts = line.split('\n')
        if (parts.length < 2) continue

        const eventType = parts[0].replace('event: ', '').trim()
        const dataStr = parts[1].replace('data: ', '').trim()

        if (!dataStr) continue

        try {
          const data = JSON.parse(dataStr)
          onEvent({ event: eventType, data })
        } catch (e) {
          console.error('Error parsing SSE data:', e)
        }
      }
    }
  }
}
