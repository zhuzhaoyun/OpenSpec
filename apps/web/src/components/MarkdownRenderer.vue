<script setup>
import { computed } from 'vue';
import MarkdownIt from 'markdown-it';

const props = defineProps({
  content: {
    type: String,
    default: ''
  },
  streaming: {
    type: Boolean,
    default: false
  }
});

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
});

const renderedContent = computed(() => {
  const html = md.render(props.content);
  if (props.streaming) {
    return html + '<span class="typing-cursor"></span>';
  }
  return html;
});
</script>

<template>
  <div class="markdown-body" v-html="renderedContent"></div>
</template>

<style scoped>
.markdown-body {
  background-color: transparent !important;
  font-size: 13px;
  line-height: 1.6;
  color: inherit !important;
}

.markdown-body pre {
  background-color: var(--gray-100) !important;
  border-radius: 6px;
  padding: 12px;
  margin: 8px 0;
}

.markdown-body code {
  color: var(--primary-color) !important;
  background-color: var(--gray-100) !important;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
}

.markdown-body pre code {
  color: var(--gray-900) !important;
  background-color: transparent !important;
  padding: 0;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4 {
  color: var(--gray-900);
  margin: 12px 0 8px 0;
  font-weight: 600;
}

.markdown-body h2 {
  font-size: 14px;
  border-bottom: 1px solid var(--gray-200);
  padding-bottom: 4px;
}

.markdown-body h3 {
  font-size: 13px;
}

.markdown-body ul,
.markdown-body ol {
  margin: 8px 0;
  padding-left: 20px;
}

.markdown-body p {
  margin: 8px 0;
}

.markdown-body a {
  color: var(--primary-color);
  text-decoration: none;
}

.markdown-body a:hover {
  text-decoration: underline;
}

.markdown-body :deep(.typing-cursor) {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--primary-color, #4f46e5);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: blink 0.8s steps(2) infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>
