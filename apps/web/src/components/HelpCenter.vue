<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { helpTabs, faqList } from '../data/helpData'
import type { TutorialItem } from '../data/helpData'

const activeTab = ref(helpTabs[0].key)
const searchKeyword = ref('')
const activeFaqNames = ref<string[]>([])

/** 类型标签映射 */
const typeLabel: Record<string, string> = {
  gif: 'GIF 动图',
  screenshot: '截图分步',
  article: '图文说明',
}

const typeTagType: Record<string, string> = {
  gif: 'success',
  screenshot: '',
  article: 'warning',
}

/** 搜索过滤后的教程列表 */
const filteredTutorials = computed(() => {
  const tab = helpTabs.find(t => t.key === activeTab.value)
  if (!tab) return []
  if (!searchKeyword.value.trim()) return tab.tutorials
  const kw = searchKeyword.value.trim().toLowerCase()
  return tab.tutorials.filter(
    t => t.title.toLowerCase().includes(kw) || t.description.toLowerCase().includes(kw)
  )
})

/** 搜索过滤后的 FAQ */
const filteredFaq = computed(() => {
  if (!searchKeyword.value.trim()) return faqList
  const kw = searchKeyword.value.trim().toLowerCase()
  return faqList.filter(
    f => f.question.toLowerCase().includes(kw) || f.answer.toLowerCase().includes(kw)
  )
})

/** 占位缩略图颜色 */
const placeholderColors = ['#EFF6FF', '#ECFDF5', '#FFF7ED', '#F5F3FF', '#FEF2F2']
function getPlaceholderColor(index: number) {
  return placeholderColors[index % placeholderColors.length]
}
const placeholderIcons: Record<string, string> = {
  gif: '▶',
  screenshot: '📷',
  article: '📄',
}

/** 打开 GitHub 仓库 */
function openGitHub() {
  window.open('https://github.com/zhuzhaoyun/OpenSpec', '_blank')
}
</script>

<template>
  <div class="help-center">
    <!-- 标题 + 搜索栏 -->
    <div class="help-header">
      <h2 class="help-title">帮助中心</h2>
      <p class="help-subtitle">快速上手产品功能，解决常见问题</p>
      <div class="help-search">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索教程或常见问题..."
          clearable
          :prefix-icon="Search"
          size="large"
        />
      </div>
    </div>

    <!-- Tab 分类 -->
    <el-tabs v-model="activeTab" class="help-tabs">
      <el-tab-pane
        v-for="tab in helpTabs"
        :key="tab.key"
        :label="tab.label"
        :name="tab.key"
      />
    </el-tabs>

    <!-- 教程卡片网格 -->
    <div class="tutorial-grid">
      <div
        v-for="(item, index) in filteredTutorials"
        :key="item.title"
        class="tutorial-card"
      >
        <div
          class="tutorial-thumbnail"
          :style="{ background: getPlaceholderColor(index) }"
        >
          <span class="thumbnail-placeholder">{{ placeholderIcons[item.type] || '📄' }}</span>
        </div>
        <div class="tutorial-body">
          <div class="tutorial-title">{{ item.title }}</div>
          <div class="tutorial-desc">{{ item.description }}</div>
          <el-tag size="small" :type="(typeTagType[item.type] as any) || 'info'" class="tutorial-type">
            {{ typeLabel[item.type] || item.type }}
          </el-tag>
        </div>
      </div>
      <el-empty v-if="filteredTutorials.length === 0" description="未找到匹配的教程" />
    </div>

    <!-- 常见问题 FAQ -->
    <div class="faq-section">
      <h3 class="section-label">常见问题</h3>
      <el-collapse v-model="activeFaqNames" class="faq-collapse">
        <el-collapse-item
          v-for="(faq, index) in filteredFaq"
          :key="index"
          :title="faq.question"
          :name="String(index)"
        >
          <p class="faq-answer">{{ faq.answer }}</p>
        </el-collapse-item>
      </el-collapse>
      <el-empty v-if="filteredFaq.length === 0" description="未找到匹配的问题" :image-size="80" />
    </div>

    <!-- 联系我们 -->
    <div class="contact-section">
      <h3 class="section-label">联系我们</h3>
      <div class="contact-cards">
        <div class="contact-card">
          <span class="contact-icon">📧</span>
          <div class="contact-info">
            <div class="contact-label">反馈邮箱</div>
            <div class="contact-value">dlutyaol@qq.com</div>
          </div>
        </div>
        <div class="contact-card contact-card-clickable" @click="openGitHub">
          <span class="contact-icon">💬</span>
          <div class="contact-info">
            <div class="contact-label">GitHub开源</div>
            <div class="contact-value">查看源码or问题反馈</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.help-center {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px;
}

/* 头部 */
.help-header {
  text-align: center;
  margin-bottom: 32px;
}
.help-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--gray-900, #111827);
  margin: 0 0 8px;
}
.help-subtitle {
  font-size: 14px;
  color: var(--gray-500, #6b7280);
  margin: 0 0 20px;
}
.help-search {
  max-width: 480px;
  margin: 0 auto;
}

/* Tabs */
.help-tabs {
  margin-bottom: 24px;
}

/* 教程卡片网格 */
.tutorial-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 48px;
}
.tutorial-card {
  border: 1px solid var(--gray-200, #e5e7eb);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
  cursor: pointer;
}
.tutorial-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}
.tutorial-thumbnail {
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.thumbnail-placeholder {
  font-size: 36px;
  opacity: 0.7;
}
.tutorial-body {
  padding: 14px 16px 16px;
}
.tutorial-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--gray-900, #111827);
  margin-bottom: 4px;
}
.tutorial-desc {
  font-size: 13px;
  color: var(--gray-500, #6b7280);
  margin-bottom: 10px;
  line-height: 1.5;
}
.tutorial-type {
  font-size: 12px;
}

/* FAQ */
.faq-section {
  margin-bottom: 48px;
}
.section-label {
  font-size: 18px;
  font-weight: 600;
  color: var(--gray-900, #111827);
  margin: 0 0 16px;
}
.faq-collapse {
  border-radius: 8px;
}
.faq-answer {
  font-size: 14px;
  color: var(--gray-600, #4b5563);
  line-height: 1.6;
  margin: 0;
}

/* 联系我们 */
.contact-section {
  margin-bottom: 32px;
}
.contact-cards {
  display: flex;
  gap: 16px;
}
.contact-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border: 1px solid var(--gray-200, #e5e7eb);
  border-radius: 10px;
  flex: 1;
  background: #fff;
}
.contact-icon {
  font-size: 28px;
}
.contact-label {
  font-size: 13px;
  color: var(--gray-500, #6b7280);
  margin-bottom: 2px;
}
.contact-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--gray-900, #111827);
}
.contact-card-clickable {
  cursor: pointer;
  transition: all 0.2s ease;
}
.contact-card-clickable:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 8px rgba(0, 120, 212, 0.15);
  transform: translateY(-2px);
}

/* 响应式 */
@media (max-width: 1024px) {
  .tutorial-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 768px) {
  .tutorial-grid {
    grid-template-columns: 1fr;
  }
  .contact-cards {
    flex-direction: column;
  }
  .help-center {
    padding: 20px 16px;
  }
}
</style>
