import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  chatWithAssistant,
  type DocReference,
  type ChunkReference,
} from '@/service/qa'

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  loading?: boolean
  error?: string
  thoughts?: string
  docReferences?: DocReference[]
  chunkReferences?: ChunkReference[]
}

export function useQAChat() {
  const chatMessages = ref<ChatMessage[]>([])
  const isGenerating = ref(false)
  const currentAbortController = ref<AbortController | null>(null)

  async function askQuestion(question: string, sessionId: string, chatId: string) {
    const q = question.trim()
    if (!q || isGenerating.value) return

    // 1. 添加用户消息
    chatMessages.value.push({
      id: Date.now(),
      role: 'user',
      content: q,
    })

    // 2. 添加 AI 占位消息
    const aiMessage: ChatMessage = {
      id: Date.now() + 1,
      role: 'assistant',
      content: '',
      loading: true,
    }
    chatMessages.value.push(aiMessage)
    isGenerating.value = true

    // 3. 流式请求
    const abortController = new AbortController()
    currentAbortController.value = abortController

    // 累积引用（chunk 中可能多次返回）
    const allDocRefs: DocReference[] = []
    const allChunkRefs: ChunkReference[] = []

    try {
      await chatWithAssistant(
        q,
        sessionId,
        chatId,
        // onChunk
        (chunk) => {
          aiMessage.content += chunk.content
          if (chunk.thoughts) {
            aiMessage.thoughts = (aiMessage.thoughts || '') + chunk.thoughts
          }
          if (chunk.doc_reference.length > 0) {
            allDocRefs.push(...chunk.doc_reference)
          }
          if (chunk.chunk_reference.length > 0) {
            allChunkRefs.push(...chunk.chunk_reference)
          }
        },
        // onComplete
        () => {
          aiMessage.loading = false
          aiMessage.docReferences = allDocRefs
          aiMessage.chunkReferences = allChunkRefs
          isGenerating.value = false
          currentAbortController.value = null
        },
        abortController.signal,
      )
    } catch (err: any) {
      aiMessage.loading = false
      isGenerating.value = false
      currentAbortController.value = null

      if (err.name === 'AbortError') {
        // 用户主动取消，不报错
        return
      }
      aiMessage.error = err.message || '请求失败'
      aiMessage.content = aiMessage.content || `请求失败: ${err.message}`
      ElMessage.error(err.message || '请求失败')
    }
  }

  function stopGeneration() {
    currentAbortController.value?.abort()
    // 找到最后一条 loading 的 AI 消息，标记为完成
    const lastAi = [...chatMessages.value].reverse().find(
      (m) => m.role === 'assistant' && m.loading
    )
    if (lastAi) {
      lastAi.loading = false
    }
    isGenerating.value = false
    currentAbortController.value = null
  }

  function clearMessages() {
    chatMessages.value = []
  }

  return {
    chatMessages,
    isGenerating,
    askQuestion,
    stopGeneration,
    clearMessages,
  }
}
