<template>
  <aside class="sidebar-project-list">
    <div class="project-list-header">
      <h3>项目列表</h3>
      <el-button 
        type="primary" 
        size="small"
        class="new-project-btn"
        @click="$emit('create')"
      >新建</el-button>
    </div>
    <div class="project-list">
      <div 
        v-for="p in projects" 
        :key="p.id" 
        class="project-group"
      >
        <div 
          class="project-item"
          :class="{ active: p.id === activeId }"
          @click="$emit('select', p.id)"
        >
          <div class="project-info">
            <div class="project-name">
              {{ p.name }}
            </div>
            <div class="project-meta">
              <span class="last-updated">最近更新 {{ p.lastUpdated }}</span>
            </div>
          </div>
          <div class="project-actions" v-if="p.id === activeId">
            <div class="qa-actions-line">
              <el-button
                size="small"
                link
                class="qa-btn"
                @click.stop="toggleSessions(p.id)"
              >
                会话列表
                <span class="session-count">{{ p.sessionList && p.sessionList?.length || 0 }}</span>
                <el-icon class="el-icon--right" v-if="p.sessionList && p.sessionList?.length">
                  <component :is="expandedProjectId === p.id ? 'ArrowUp' : 'ArrowDown'" />
                </el-icon>
              </el-button>
              <div class="actions-right">
                <el-button
                  size="small"
                  link
                  class="create-session-btn"
                  @click.stop="$emit('create-session', p.id)"
                >新增</el-button>
                <el-button
                  size="small"
                  link
                  type="danger"
                  class="delete-btn"
                  @click.stop="$emit('delete', p.id)"
                >
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Session List -->
        <div 
          v-show="expandedProjectId === p.id && p.sessionList?.length" 
          class="session-list"
        >
          <div
            v-for="(session, idx) in p.sessionList"
            :key="idx"
            class="session-item"
            @click.stop="handleSessionClick(p.id, session)"
          >
            <el-icon class="session-icon"><ChatDotRound /></el-icon>
            <span class="session-name">{{ session.name }}</span>
            <el-dropdown
              trigger="click"
              @command="(cmd: string) => handleSessionCommand(cmd, p.id, session)"
              @click.stop
            >
              <span class="session-more-btn" @click.stop>
                <el-icon><MoreFilled /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="rename">
                    <el-icon><Edit /></el-icon>重命名
                  </el-dropdown-item>
                  <el-dropdown-item command="delete" divided>
                    <el-icon><Delete /></el-icon>删除
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { ProjectItem } from '@/data/mockData'
import { ref, watch } from 'vue'
import { ArrowDown, ArrowUp, ChatDotRound, Plus, Delete, MoreFilled, Edit } from '@element-plus/icons-vue'

interface Props {
  projects: ProjectItem[]
  activeId?: string
  loading?: boolean
}
const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'select', projectId: string): void
  (e: 'create'): void
  (e: 'delete', projectId: string): void
  (e: 'select-session', projectId: string, session: any): void
  (e: 'create-session', projectId: string): void
  (e: 'rename-session', projectId: string, session: any): void
  (e: 'delete-session', projectId: string, session: any): void
}>()

const expandedProjectId = ref<string | null>(null)

const toggleSessions = (projectId: string) => {
  if (expandedProjectId.value === projectId) {
    expandedProjectId.value = null
  } else {
    expandedProjectId.value = projectId
    // If not already active, maybe select it too?
    if (props.activeId !== projectId) {
      emit('select', projectId)
    }
  }
}

const handleSessionClick = (projectId: string, session: any) => {
  emit('select-session', projectId, session)
}

const handleSessionCommand = (command: string, projectId: string, session: any) => {
  if (command === 'rename') {
    emit('rename-session', projectId, session)
  } else if (command === 'delete') {
    emit('delete-session', projectId, session)
  }
}

// Optional: Auto-expand active project if it has sessions?
// For now, respect user's manual toggle as requested.
</script>

<style scoped>
.sidebar-project-list {
  background: #fafbfc;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.project-list-header {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.project-list-header h3 {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin: 0;
}
.new-project-btn {
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.2s ease;
}
.project-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px;
}
.project-group {
  margin-bottom: 4px;
}
.project-item {
  display: flex;
  flex-direction: column;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}
.project-item:hover {
  background: #ffffff;
  border-color: rgba(0, 0, 0, 0.04);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
}
.project-item.active {
  background: #ffffff;
  border-color: var(--primary-color-light, #e0e7ff);
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.08);
}
.project-info {
  flex: 1;
  min-width: 0;
}
.project-name {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 4px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}
.project-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: #9ca3af;
}
.qa-btn {
  display: flex;
  align-items: center;
  gap: 4px;
}
.project-actions {
  width: 100%;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(0, 0, 0, 0.04);
}
.qa-actions-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.session-count {
  margin-left: 6px;
  padding: 2px 6px;
  background-color: var(--primary-color-light, #e0e7ff);
  color: var(--primary-color, #4f46e5);
  border-radius: 10px;
  font-size: 12px;
  line-height: 1;
}
.create-session-btn {
  margin-left: 0;
}
.actions-right {
  display: flex;
  align-items: center;
  gap: 4px;
}
.delete-btn {
  padding: 4px;
}
.session-list {
  margin-top: 2px;
  margin-left: 12px;
  padding-left: 10px;
  border-left: 2px solid #e5e7eb;
}
.session-item {
  padding: 6px 10px;
  font-size: 12px;
  color: #4b5563;
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}
.session-item:hover {
  background: #f3f4f6;
  color: var(--primary-color, #4f46e5);
}
.session-item:hover .session-more-btn {
  opacity: 1;
}
.session-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.session-more-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s;
  color: #9ca3af;
}
.session-more-btn:hover {
  background: #e5e7eb;
  color: #374151;
}
.session-icon {
  font-size: 14px;
  opacity: 0.7;
}
</style>
