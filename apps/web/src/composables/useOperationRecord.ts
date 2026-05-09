/**
 * 操作记录采集 composable
 * 统一采集用户操作事件，缓冲批量上报
 */
import { ref, onBeforeUnmount, type Ref } from 'vue'
import { saveOperationRecords, type OperationRecord } from '@/service/operationRecord'
import { authStorage } from '@/utils/auth'

const FLUSH_INTERVAL = 10_000 // 10秒定时上报
const FLUSH_SIZE = 5          // 累积5条立即上报

export function useOperationRecord(documentId: Ref<string>) {
  const buffer = ref<OperationRecord[]>([])

  function record(
    actionType: string,
    chapterName: string | undefined,
    detail: string,
    context?: Record<string, any>
  ) {
    if (!documentId.value) return

    buffer.value.push({
      document_id: documentId.value,
      chapter_name: chapterName || undefined,
      action_type: actionType,
      action_detail: detail,
      context: context || undefined,
    })

    if (buffer.value.length >= FLUSH_SIZE) {
      flush()
    }
  }

  async function flush() {
    if (buffer.value.length === 0) return

    const toSend = [...buffer.value]
    buffer.value = []

    try {
      await saveOperationRecords(toSend)
    } catch {
      // 上报失败，静默丢弃，不阻塞用户操作
    }
  }

  const timer = setInterval(flush, FLUSH_INTERVAL)

  onBeforeUnmount(() => {
    clearInterval(timer)
    flush()
  })

  return { record, flush }
}
