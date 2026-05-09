<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-form">
        <div class="login-header">
          <h2>注册</h2>
          <p class="subtitle">创建您的账户</p>
        </div>

        <form class="login-form-content" @submit.prevent="handleSubmit">
          <div class="form-item">
            <label class="form-label">邮箱</label>
            <div class="form-control">
              <el-input
                v-model="formData.email"
                type="email"
                placeholder="请输入邮箱"
                size="large"
                clearable
              />
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">昵称</label>
            <div class="form-control">
              <el-input
                v-model="formData.nickname"
                placeholder="请输入昵称（选填）"
                size="large"
                clearable
              />
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">密码</label>
            <div class="form-control">
              <el-input
                v-model="formData.password"
                type="password"
                placeholder="请输入密码（至少6位）"
                size="large"
                show-password
                clearable
              />
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">确认密码</label>
            <div class="form-control">
              <el-input
                v-model="formData.confirmPassword"
                type="password"
                placeholder="请再次输入密码"
                size="large"
                show-password
                clearable
                @keyup.enter="handleSubmit"
              />
            </div>
          </div>

          <div class="form-item" v-if="errorMsg">
            <el-alert :title="errorMsg" type="error" :closable="false" show-icon />
          </div>

          <div class="form-item">
            <el-button
              type="primary"
              size="large"
              :loading="loading"
              native-type="submit"
              class="submit-button"
            >
              注册
            </el-button>
          </div>

          <div class="form-item register-link">
            已有账户？<router-link to="/home">返回首页</router-link>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { register } from '@/service/user';
import { authStorage } from '@/utils/auth';
import type { UserInfo } from '@/utils/auth';

const router = useRouter();
const loading = ref(false);
const errorMsg = ref('');

const formData = reactive({
  email: '',
  nickname: '',
  password: '',
  confirmPassword: '',
});

const handleSubmit = async () => {
  errorMsg.value = '';
  const email = formData.email.trim();
  const password = formData.password;
  const confirmPassword = formData.confirmPassword;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email) { errorMsg.value = '请输入邮箱'; return; }
  if (!emailRegex.test(email)) { errorMsg.value = '请输入正确的邮箱格式'; return; }
  if (!password) { errorMsg.value = '请输入密码'; return; }
  if (password.length < 6) { errorMsg.value = '密码长度至少6位'; return; }
  if (password !== confirmPassword) { errorMsg.value = '两次输入的密码不一致'; return; }

  loading.value = true;
  try {
    const response = await register({
      email,
      password,
      nickname: formData.nickname.trim() || undefined,
    });

    if (response.code === 200 && response.data) {
      const userData = response.data;
      const userInfo: UserInfo = {
        id: userData.id,
        email: userData.email,
        name: userData.nickname,
        nickname: userData.nickname,
        avatar: userData.avatar,
      };
      authStorage.setAuthData({
        Authorization: `Bearer ${userData.access_token}`,
        Token: userData.access_token,
        userInfo,
      });
      ElMessage.success('注册成功');
      router.push('/');
    } else {
      errorMsg.value = response.message || '注册失败';
    }
  } catch (err: any) {
    errorMsg.value = err.message || '注册失败，请检查网络连接';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped lang="scss">
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

  .login-container {
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 480px;

    .login-form {
      padding: 40px 20px;

      .login-header {
        text-align: center;
        margin-bottom: 40px;

        h2 {
          font-size: 28px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #333;
        }

        .subtitle {
          color: #666;
          font-size: 14px;
        }
      }

      .login-form-content {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 5px 20px;

        .form-item {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-label {
          font-size: 14px;
          color: #666;
        }

        .form-control {
          width: 100%;
        }

        .form-control :deep(.el-input__wrapper) {
          width: 100%;
        }

        .submit-button {
          width: 100%;
          margin-top: 10px;
        }

        .register-link {
          text-align: center;
          font-size: 14px;
          color: #666;
          a {
            color: #667eea;
            text-decoration: none;
            &:hover {
              text-decoration: underline;
            }
          }
        }
      }
    }
  }
}
</style>
