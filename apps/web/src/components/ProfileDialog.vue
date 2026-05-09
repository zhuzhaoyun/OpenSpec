<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Lock } from '@element-plus/icons-vue'
import { authStorage } from '../utils/auth'
import { updateProfile, changePassword } from '../service/user'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'updated'): void
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

const userInfo = ref(authStorage.getUserInfo())

// 是否为演示账号
const isDemoAccount = computed(() => userInfo.value?.email === 'test@qq.com')

// 昵称编辑
const editingNickname = ref(false)
const nicknameInput = ref('')
const savingProfile = ref(false)

// 密码修改
const showPasswordForm = ref(false)
const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})
const savingPassword = ref(false)

watch(() => props.visible, (val) => {
  if (val) {
    // 刷新用户信息
    userInfo.value = authStorage.getUserInfo()
    nicknameInput.value = userInfo.value?.nickname || ''
    editingNickname.value = false
    showPasswordForm.value = false
    passwordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
  }
})

function startEditNickname() {
  nicknameInput.value = userInfo.value?.nickname || ''
  editingNickname.value = true
}

function cancelEditNickname() {
  editingNickname.value = false
}

async function saveNickname() {
  const name = nicknameInput.value.trim()
  if (!name) {
    ElMessage.warning('昵称不能为空')
    return
  }
  if (name.length > 100) {
    ElMessage.warning('昵称最长100个字符')
    return
  }

  savingProfile.value = true
  try {
    const res = await updateProfile(name)
    if (res.code === 200 && res.data) {
      // 更新本地存储
      const info = authStorage.getUserInfo()
      if (info) {
        info.nickname = res.data.nickname
        authStorage.setUserInfo(info)
      }
      // 更新响应式数据
      userInfo.value = authStorage.getUserInfo()
      editingNickname.value = false
      ElMessage.success('昵称修改成功')
      emit('updated')
    } else {
      ElMessage.error(res.message || '修改失败')
    }
  } catch {
    ElMessage.error('网络错误，请稍后重试')
  } finally {
    savingProfile.value = false
  }
}

async function savePassword() {
  const { oldPassword, newPassword, confirmPassword } = passwordForm.value
  if (!oldPassword) {
    ElMessage.warning('请输入当前密码')
    return
  }
  if (!newPassword) {
    ElMessage.warning('请输入新密码')
    return
  }
  if (newPassword.length < 6 || newPassword.length > 50) {
    ElMessage.warning('新密码长度为6-50位')
    return
  }
  if (newPassword !== confirmPassword) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }

  savingPassword.value = true
  try {
    const res = await changePassword(oldPassword, newPassword)
    if (res.code === 200) {
      showPasswordForm.value = false
      passwordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
      ElMessage.success('密码修改成功')
    } else {
      ElMessage.error(res.message || '修改失败')
    }
  } catch {
    ElMessage.error('网络错误，请稍后重试')
  } finally {
    savingPassword.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="个人信息"
    width="480px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <!-- 用户头像区 -->
    <div class="profile-header">
      <div class="profile-avatar">
        {{ userInfo?.nickname?.charAt(0) || userInfo?.name?.charAt(0) || '用' }}
      </div>
      <div class="profile-header-info">
        <div class="profile-header-name">{{ userInfo?.nickname || userInfo?.name || '用户' }}</div>
        <div class="profile-header-email">{{ userInfo?.email || '' }}</div>
      </div>
    </div>

    <!-- 信息表单 -->
    <div class="profile-form">
      <!-- 昵称 -->
      <div class="profile-field">
        <label class="profile-field-label">昵称</label>
        <div class="profile-field-value">
          <template v-if="editingNickname">
            <el-input
              v-model="nicknameInput"
              size="default"
              maxlength="100"
              show-word-limit
              style="flex: 1"
              @keyup.enter="saveNickname"
            />
            <el-button type="primary" size="small" :loading="savingProfile" @click="saveNickname">保存</el-button>
            <el-button size="small" @click="cancelEditNickname">取消</el-button>
          </template>
          <template v-else>
            <span class="profile-field-text">{{ userInfo?.nickname || userInfo?.name || '未设置' }}</span>
            <el-button link type="primary" @click="startEditNickname">修改</el-button>
          </template>
        </div>
      </div>

      <!-- 邮箱 -->
      <div class="profile-field">
        <label class="profile-field-label">邮箱</label>
        <div class="profile-field-value">
          <span class="profile-field-text">{{ userInfo?.email || '未设置' }}</span>
          <el-icon :size="14" color="#999"><Lock /></el-icon>
        </div>
      </div>

      <!-- 密码 -->
      <div class="profile-field">
        <label class="profile-field-label">密码</label>
        <div class="profile-field-value">
          <template v-if="!showPasswordForm">
            <span class="profile-field-text">******</span>
            <template v-if="isDemoAccount">
              <el-tag size="small" type="info">演示账号</el-tag>
            </template>
            <template v-else>
              <el-button link type="primary" @click="showPasswordForm = true">修改</el-button>
            </template>
          </template>
        </div>
      </div>

      <!-- 修改密码表单 -->
      <div v-if="showPasswordForm" class="password-form">
        <div class="password-field">
          <label>当前密码</label>
          <el-input
            v-model="passwordForm.oldPassword"
            type="password"
            show-password
            placeholder="请输入当前密码"
          />
        </div>
        <div class="password-field">
          <label>新密码</label>
          <el-input
            v-model="passwordForm.newPassword"
            type="password"
            show-password
            placeholder="6-50位字符"
          />
        </div>
        <div class="password-field">
          <label>确认密码</label>
          <el-input
            v-model="passwordForm.confirmPassword"
            type="password"
            show-password
            placeholder="再次输入新密码"
            @keyup.enter="savePassword"
          />
        </div>
        <div class="password-actions">
          <el-button type="primary" :loading="savingPassword" @click="savePassword">确认修改</el-button>
          <el-button @click="showPasswordForm = false">取消</el-button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.profile-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 20px;
}

.profile-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0078D4, #00BCF2);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 600;
  flex-shrink: 0;
}

.profile-header-name {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
}

.profile-header-email {
  font-size: 13px;
  color: #999;
  margin-top: 4px;
}

.profile-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.profile-field {
  display: flex;
  align-items: center;
  min-height: 40px;
}

.profile-field-label {
  width: 60px;
  font-size: 14px;
  color: #666;
  flex-shrink: 0;
}

.profile-field-value {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.profile-field-text {
  font-size: 14px;
  color: #1a1a1a;
}

.password-form {
  background: #f9fafb;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.password-field {
  display: flex;
  align-items: center;
  gap: 12px;
}

.password-field label {
  width: 70px;
  font-size: 13px;
  color: #666;
  flex-shrink: 0;
}

.password-field .el-input {
  flex: 1;
}

.password-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
</style>
