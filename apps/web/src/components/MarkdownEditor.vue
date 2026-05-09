<template>
  <div class="markdown-editor">
    <!-- 工具栏 -->
      <div class="markdown-toolbar">
        <div class="current-chapter">{{ `当前章节：${currentChapter?.id || ''}.${currentChapter?.title || ''}` }}</div>
        <div class="toolbar-left">
          <div class="mode-toggle">
            <el-tooltip content="编辑" placement="top">
              <button
                class="mode-btn"
                :class="{ 'mode-active': editMode === 'edit' }"
                @click="editMode = 'edit'"
              >
                <el-icon><Edit /></el-icon>
              </button>
            </el-tooltip>
            <el-tooltip content="预览" placement="top">
              <button
                class="mode-btn"
                :class="{ 'mode-active': editMode === 'preview' }"
                @click="editMode = 'preview'"
              >
                <el-icon><View /></el-icon>
              </button>
            </el-tooltip>
          </div>
        </div>
      </div>

    <!-- 编辑区域 -->
    <div class="markdown-content">
      <!-- 仅编辑模式 -->
      <div v-if="editMode === 'edit'" class="editor-panel">
        <textarea
          ref="textareaRef"
          v-model="localContent"
          class="markdown-textarea"
          placeholder="请输入 Markdown 内容..."
          @input="handleInput"
          @blur="handleBlur"
        ></textarea>
      </div>

      <!-- 仅预览模式 -->
      <div v-else-if="editMode === 'preview'" class="preview-panel">
        <div
          class="markdown-preview"
          ref="markdownPreviewRef"
          v-html="renderedContent"
          @click="handlePreviewClick"
        ></div>
        <el-popover
          v-model:visible="popoverVisible"
          trigger="manual"
          placement="top-start"
          virtual-triggering
          :virtual-ref="popoverVirtualRef"
          :width="640"
          :popper-options="popoverPopperOptions"
          popper-class="ref-popover"
        >
          <div v-if="popoverMode === 'single' && popoverItems.length" class="ref-layout">
            <div v-if="popoverItems[0]?.image_id" class="ref-image">
              <img
                :src="imageThumb(popoverItems[0])"
                alt="引用图片"
                style="max-width:100%; max-height:150px; border-radius:4px; cursor:pointer; border:1px solid #d9d9d9"
                @click="openImage(popoverItems[0])"
              />
            </div>
            <div class="ref-right">
              <div class="ref-content-scroll" v-html="popoverItems[0]?.chunk_content"></div>
              <a class="ref-filename" ><span class="file-type">{{ popoverItems[0]?.type }}</span> {{ popoverItems[0]?.doc_name }}</a>
            </div>
          </div>
          <div v-else-if="popoverMode === 'group'" class="ref-group-list">
            <el-collapse v-model="groupActiveNames">
              <el-collapse-item v-for="(refObj, idx) in popoverItems" :key="idx" :name="String(idx)">
                <template #title>
                  <div class="ref-filename"><span class="file-type">{{ refObj?.type }}</span> {{ refObj?.doc_name }}</div>
                </template>
                <div class="ref-details">
                  <div v-if="refObj?.image_id" class="ref-image">
                    <img
                      :src="imageThumb(refObj)"
                      alt="引用图片"
                      style="max-width:100%; max-height:150px; border-radius:4px; cursor:pointer; border:1px solid #d9d9d9"
                      @click="openImage(refObj)"
                    />
                  </div>
                  <div class="ref-content-scroll" v-html="refObj?.chunk_content"></div>
                </div>
              </el-collapse-item>
            </el-collapse>
          </div>
        </el-popover>
        <el-dialog v-model="imageDialogVisible" width="60%" append-to-body>
          <div class="image-preview-container">
            <img :src="imageDialogUrl" alt="原图" class="image-preview" />
          </div>
        </el-dialog>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { marked } from 'marked'
import { Edit, View } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface Props {
  modelValue: string
  autoSave?: boolean
  inGenerating?: boolean
  currentChapter?:any
  showCitation?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'blur', value: string): void
  (e: 'save', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  autoSave: false,
  inGenerating: false,
  showCitation: true
})

const emit = defineEmits<Emits>()

// 编辑模式：edit（仅编辑）、preview（仅预览）
const editMode = ref<'edit' | 'preview'>('preview')
const localContent = ref(props.modelValue)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const markdownPreviewRef = ref<HTMLElement | null>(null)
const popoverVisible = ref(false)

const popoverVirtualRef = ref<HTMLElement | null>(null)

const popoverItems = ref<any[]>([])
const popoverMode = ref<'single' | 'group'>('single')
const groupActiveNames = ref<string[]>([])

const popoverPopperOptions = {
  strategy: 'fixed',
  modifiers: [
    { name: 'preventOverflow', options: { boundary: 'viewport', altBoundary: true, padding: 8 } },
    { name: 'flip', options: { fallbackPlacements: ['bottom-start', 'top-start'] } },
    { name: 'computeStyles', options: { adaptive: true } }
  ]
}

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true
})

// const skipTags = new Set(['code', 'pre', 'style', 'script', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
const skipTags = new Set(['code', 'pre', 'style', 'script', 'h1', 'h2'])
const numberRegex = /\d+(?:\.\d+)?/g

const highlightHtmlNumbers = (html: string) => {
  return html
  // try {
  //   const container = document.createElement('div')
  //   container.innerHTML = html
  //   Array.from(container.querySelectorAll('h3')).forEach((el) => {
  //     const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  //     while (w.nextNode()) {
  //       const tn = w.currentNode as Text
  //       const t = tn.nodeValue || ''
  //       if (!t.trim()) continue
  //       const m = /^\s*\d+(?:\.\d+)*/.exec(t)
  //       if (m) {
  //         const replaced = t.replace(/^\s*\d+(?:\.\d+)*/, '<span class="heading-number">$&</span>')
  //         const span = document.createElement('span')
  //         span.innerHTML = replaced
  //         tn.replaceWith(...Array.from(span.childNodes))
  //         break
  //       }
  //     }
  //   })
  //   const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  //   const textNodes: Text[] = []
  //   while (walker.nextNode()) {
  //     const node = walker.currentNode as Text
  //     let el = node.parentElement
  //     let skip = false
  //     while (el) {
  //       const tag = el.tagName?.toLowerCase()
  //       if (skipTags.has(tag)) { skip = true; break }
  //       if (el.classList && (el.classList.contains('doc-ref') || el.classList.contains('doc-ref-group') || el.classList.contains('heading-number'))) { skip = true; break }
  //       el = el.parentElement
  //     }
  //     if (skip) continue
  //     textNodes.push(node)
  //   }
  //   textNodes.forEach((node) => {
  //     const text = node.nodeValue || ''
  //     if (!text) return
  //     const replaced = text.replace(numberRegex, '<span class="num-highlight">$&</span>')
  //     if (replaced !== text) {
  //       const span = document.createElement('span')
  //       span.innerHTML = replaced
  //       node.replaceWith(...Array.from(span.childNodes))
  //     }
  //   })
  //   return container.innerHTML
  // } catch {
  //   return html
  // }
}

const transformReferences = (md: string) => {
  const groupRegex = /(?:\[(?:ID|id):\d+\])+/g
  return md.replace(groupRegex, (match) => {
    const ids = Array.from(match.matchAll(/\[(?:ID|id):(\d+)\]/g)).map(m => m[1])
    const label = ids.length > 1 ? `ref ×${ids.length}` : 'ref'
    if(ids.length >1) {
      return `<span class=\"doc-ref-group\" data-ref-indices=\"${ids.join(',')}\">${label}</span>`
    }else{
      return `<span class=\"doc-ref\" data-ref-index=\"${ids[0]}\">${label}</span>`
    }
  })
}

const renderedContent = ref<string>('<p class="empty-placeholder">暂无内容</p>')
const updateRenderedContent = async () => {
  if (!localContent.value) {
    renderedContent.value = props.inGenerating
      ? '<p class="generating-placeholder">内容生成中...</p>'
      : '<p class="empty-placeholder">暂无内容</p>'
    return
  }
  try {
    const mdContent = props.showCitation ? transformReferences(localContent.value) : localContent.value
    const result = marked(mdContent) as any
    if (result && typeof result.then === 'function') {
      const html = await result
      renderedContent.value = highlightHtmlNumbers(String(html || ''))
    } else {
      renderedContent.value = highlightHtmlNumbers(String(result || ''))
    }
  } catch (error) {
    console.error('Markdown 渲染错误:', error)
    renderedContent.value = '<p class="error-placeholder">渲染错误，请检查 Markdown 语法</p>'
  }
}
watch([localContent, () => props.inGenerating, () => props.showCitation], () => { updateRenderedContent() })
updateRenderedContent()

const escapeHtml = (str: string) => String(str || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const api_host = import.meta.env.RAGFLOW_BASE_URL || 'https://rag.aizzyun.com/v1'
const thumbQuery = (import.meta.env.VITE_IMAGE_THUMB_QUERY || '').trim()
const imageHref = (refObj: any) => `${api_host}/document/image/${escapeHtml(String(refObj?.image_id ?? ''))}`
const imageThumb = (refObj: any) => {
  const base = imageHref(refObj)
  return base
  // return thumbQuery ? `${base}?${thumbQuery}` : base
}

const imageDialogVisible = ref(false)
const imageDialogUrl = ref('')
const openImage = (refObj: any) => {
  imageDialogUrl.value = imageHref(refObj)
  imageDialogVisible.value = true
}

const showRefPopover = (t: HTMLElement, idx: number) => {
  const refList = Array.isArray(props.currentChapter?.chunkReference) ? props.currentChapter.chunkReference : []
  // 先按数组下标查找，再按 index 字段查找（兼容 hash_id 引用）
  const refObj = refList[idx] || (refList as any[]).find((r: any) => r?.index === idx)
  if (!refObj) {
    ElMessage.warning('未找到对应的引用')
    popoverVisible.value = false;
    return 
  }

  popoverItems.value = [refObj]
  popoverMode.value = 'single'
  popoverVirtualRef.value = t
  popoverVisible.value = true
}


const showGroupPopover = (t: HTMLElement, indices: number[]) => {
  console.log('showGroupPopover', t, indices, props.currentChapter)
  const refList = Array.isArray(props.currentChapter?.chunkReference) ? props.currentChapter!.chunkReference : []

  const items = indices.map((i) => {
    if (!Array.isArray(refList)) return undefined as any
    const byIndex = refList[i]
    if (byIndex) return byIndex
    return (refList as any[]).find((r: any) => r?.index === i || r?.idx === i || r?.ref_index === i)
  }).filter(Boolean)

  if (!items.length) {
    ElMessage.warning('未找到对应的引用')
    popoverVisible.value = false;
    return 
  }

  popoverItems.value = items as any[]
  popoverMode.value = 'group'
  popoverVirtualRef.value = t
  popoverVisible.value = true
}

// 使用 el-collapse 实现分组折叠，无需手动切换样式类

const buildPreviewUrl = (docId: string) => {
  //TODO-文档在线预览，待实现
  // const origin = window.location.origin
  // return `${origin}/preview/document/${encodeURIComponent(docId)}`
}

// 通过锚点直接跳转预览，无需事件处理

const handlePreviewClick = (e: MouseEvent) => {
  const t = e.target as HTMLElement
  // console.log('111111111111,', t, t?.classList, t?.dataset)
  if (t && t.classList && (t.classList.contains('doc-ref-group') || t.classList.contains('doc-ref'))) {
    if (t.classList.contains('doc-ref-group')) {
      const indicesStr = t.dataset.refIndices || ''
      const indices = indicesStr.split(',').map(s => Number(s)).filter(n => !Number.isNaN(n))
      if (!indices.length){ return }
      if (popoverVisible.value && popoverVirtualRef.value === t) {
        groupActiveNames.value = []
        popoverVisible.value = false
        popoverVirtualRef.value = null
      } else {
        showGroupPopover(t, indices)
      }
    } else {
      const idxStr = t.dataset.refIndex || t.dataset.refId
      const idx = Number(idxStr ?? '-1')
      if (Number.isNaN(idx)) return
      // console.log('aaaaaaaaaaaaaaaaaaa,',popoverVisible.value)
      if (popoverVisible.value && popoverVirtualRef.value === t) {
        groupActiveNames.value = []
        popoverVisible.value = false
        popoverVirtualRef.value = null
      } else {
        showRefPopover(t, idx)
      }
    }
  } else {
    groupActiveNames.value = []
    popoverVisible.value = false
    popoverVirtualRef.value = null
  }
}

// 监听外部值变化
watch(() => props.modelValue, (newVal) => {
  if (newVal !== localContent.value) {
    localContent.value = newVal
  }
})

// 处理输入
const handleInput = () => {
  emit('update:modelValue', localContent.value)
  if (props.autoSave) {
    emit('save', localContent.value)
  }
}

// 处理失焦
const handleBlur = () => {
  emit('blur', localContent.value)
  if (props.autoSave) {
    emit('save', localContent.value)
  }
}

// 暴露方法
defineExpose({
  focus: () => {
    nextTick(() => {
      textareaRef.value?.focus()
    })
  },
  getContent: () => localContent.value,
  setContent: (content: string) => {
    localContent.value = content
    emit('update:modelValue', content)
  }
})
</script>

<style scoped lang="scss">
.markdown-editor {
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  min-height: 0;
  border: none;
  border-radius: 0;
  background: #fff;
  box-shadow: none;
  overflow: hidden;
}

.markdown-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #e4e7ed;
  background: #fafbfc;
  backdrop-filter: blur(10px);
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 4px;
  
  :deep(.el-button-group) {
    .el-button {
      border-radius: 6px;
      font-weight: 500;
      transition: all 0.2s ease;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      &.is-primary {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        border-color: #2563eb;
      }
    }
  }

  .mode-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .mode-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    .el-icon {
      font-size: 16px;
      color: #64748b;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    &:hover {
      background: #f1f5f9;

      .el-icon {
        color: #334155;
      }
    }

    &.mode-active {
      background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
      box-shadow: 0 2px 4px rgba(96, 165, 250, 0.25);

      .el-icon {
        color: #ffffff;
      }

      &:hover {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        box-shadow: 0 4px 6px rgba(59, 130, 246, 0.35);
      }
    }

    &:active {
      transform: scale(0.95);
    }
  }
}

.markdown-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

// 编辑面板
.editor-panel {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.markdown-textarea {
  flex: 1;
  width: 100%;
  padding: 16px;
  border: none;
  outline: none;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.8;
  resize: none;
  background: #fff;
  color: #1f2937;
  overflow-y: auto;
  min-height: 0;
  
  &::placeholder {
    color: #9ca3af;
  }
  
  &:focus {
    background: #fafbfc;
  }
  
  // 自定义滚动条
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: #f1f5f9;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
    
    &:hover {
      background: #94a3b8;
    }
  }
}

// 预览面板
.preview-panel {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #fff;
  min-height: 0;
  
  // 自定义滚动条
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: #f1f5f9;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
    
    &:hover {
      background: #94a3b8;
    }
  }
}

.markdown-preview {
  max-width: 100%;
  word-wrap: break-word;
  
  // Markdown 样式
  :deep(h1) {
    font-size: 2em;
    font-weight: bold;
    margin: 0.67em 0;
    padding-bottom: 0.3em;
    border-bottom: 1px solid #eaecef;
  }

  :deep(h2) {
    font-size: 1.5em;
    font-weight: bold;
    margin: 0.8em 0;
    padding-bottom: 0.3em;
    border-bottom: 1px solid #eaecef;
  }

  :deep(h3) {
    font-size: 1.2em;
    font-weight: 500;
    margin: 1em 0;
  }

  :deep(h4) {
    font-size: 1em;
    font-weight: 400;
    margin: 1em 0;
  }

  :deep(p) {
    margin: 16px 0;
    line-height: 1.6;
  }

  :deep(ul),
  :deep(ol) {
    margin: 16px 0;
    padding-left: 30px;
  }

  :deep(li) {
    margin: 8px 0;
    line-height: 1.6;
  }

  :deep(blockquote) {
    margin: 16px 0;
    padding: 0 1em;
    color: #6a737d;
    border-left: 0.25em solid #dfe2e5;
  }

  :deep(code) {
    padding: 2px 4px;
    margin: 0;
    font-size: 85%;
    background-color: rgba(27, 31, 35, 0.05);
    border-radius: 3px;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  }

  :deep(pre) {
    padding: 16px;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
    background-color: #f6f8fa;
    border-radius: 6px;
    margin: 16px 0;

    code {
      padding: 0;
      margin: 0;
      background-color: transparent;
      border-radius: 0;
    }
  }

  :deep(table) {
    border-collapse: collapse;
    margin: 16px 0;
    width: 100%;
    
    th,
    td {
      border: 1px solid #dfe2e5;
      padding: 6px 13px;
    }

    th {
      background-color: #f6f8fa;
      font-weight: 600;
    }

    tr:nth-child(2n) {
      background-color: #f6f8fa;
    }
  }

  :deep(hr) {
    height: 0.25em;
    padding: 0;
    margin: 24px 0;
    background-color: #e1e4e8;
    border: 0;
  }

  :deep(a) {
    color: #0366d6;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  :deep(strong),
  :deep(b) {
    font-weight: 500;
  }

  .empty-placeholder,
  .error-placeholder {
    color: #909399;
    font-style: italic;
    text-align: center;
    padding: 40px;
  }

  .error-placeholder {
    color: #f56c6c;
  }

  .generating-placeholder {
    color: #409EFF; /* 主色，提示生成中 */
    font-style: italic;
    text-align: center;
    padding: 40px;
  }
  :deep(.num-highlight) {
    color: var(--warning-color);
    // background: rgba(239, 68, 68, 0.08);
    background: rgba(233, 158, 28, 0.08);
    // border: 1px solid rgba(239, 68, 68, 0.25);
    // border-radius: 4px;
    padding: 0 4px;
    margin: 0 2px;
  }
}

.current-chapter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;           /* 深灰文字 */
  background: #f3f4f6;      /* 浅灰背景 */
  border: 1px solid #e5e7eb;/* 细边框 */
  border-radius: 8px;       /* 圆角 */
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.6);
  white-space: nowrap;
}
:deep(.doc-ref) {
  display: inline-flex;
  align-items: center;
  padding: 0 6px;
  margin: 0 4px 0 0;
  height: 20px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 20px;
  color: #2563eb;
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.25);
  cursor: pointer;
  position: relative;
}
:deep(.doc-ref-group) {
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  margin: 0 6px 0 0;
  height: 22px;
  border-radius: 11px;
  font-size: 12px;
  line-height: 22px;
  color: #2563eb;
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.25);
  cursor: pointer;
}
:deep(.doc-ref + .doc-ref) {
  margin-left: 2px;
}

:global(.ref-popover) {
  max-width: 720px;
  max-height: 70vh;
  padding: 10px 12px;
  overflow: auto;
}

:global(.ref-popover)::-webkit-scrollbar {
  width: 8px;
}
:global(.ref-popover)::-webkit-scrollbar-track {
  background: #f1f5f9;
}
:global(.ref-popover)::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
:global(.ref-popover)::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.ref-layout {
  display:flex;
}
.ref-image {
  min-width: 90px;
}
:deep(.ref-popover .ref-layout) {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: nowrap;
}
:deep(.ref-popover .ref-image) {
  flex: 0 0 180px;
  width: 180px;
  height: 120px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f7f8fa;
  color: #606266;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
:deep(.ref-popover .ref-image img) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
:deep(.ref-popover .ref-right) {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
:deep(.ref-popover .ref-content-scroll) {
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  line-height: 1.7;
  word-break: break-word;
  padding-right: 6px;
}

:deep(.ref-popover .ref-content-scroll table) {
  border-collapse: collapse;
  margin: 12px 0;
  max-width: 100%;
}

:deep(.ref-popover .ref-content-scroll th),
:deep(.ref-popover .ref-content-scroll td) {
  border: 1px solid #dfe2e5;
  padding: 6px 13px;
}

:deep(.ref-popover .ref-content-scroll th) {
  background-color: #f6f8fa;
  font-weight: 600;
}

:deep(.ref-popover .ref-content-scroll tr:nth-child(2n)) {
  background-color: #f6f8fa;
}
:deep(.ref-popover .ref-filename) {
  margin-top: 0;
  font-weight: 600;
  cursor: pointer;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ref-filename {
  color:#409EFF !important;
}
:deep(.ref-popover .ref-filename:hover) {
  text-decoration: underline;
}
:deep(.ref-popover .file-type) {
  display: inline-block;
  margin-right: 6px;
  padding: 0 6px;
  line-height: 18px;
  border-radius: 4px;
  background: #f2f3f5;
  color: #606266;
}
:deep(.ref-popover .ref-group-list .el-collapse-item__content) {
  padding: 0;
}
.ref-details {
  display:flex;
  gap: 12px;
  align-items: flex-start;
  max-height: 260px;
  overflow: auto;
}

.ref-details::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.ref-details::-webkit-scrollbar-track {
  background: #f1f5f9;
}
.ref-details::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
.ref-details::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
:global(.ref-popover .ref-group-list) {
  max-height: 68vh;
  overflow: auto;
}
.image-preview-container {
  display: flex;
  align-items: center;
  justify-content: center;
}
.image-preview {
  max-width: 100%;
  max-height: 80vh;
  border-radius: 4px;
}
</style>
