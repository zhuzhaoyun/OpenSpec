/**
 * 认证工具函数
 * 用于管理用户认证信息（token、用户信息等）
 */

export const AUTH_KEYS = {
  AUTHORIZATION: 'Authorization',
  TOKEN: 'token',
  USER_INFO: 'userInfo',
} as const;

export interface UserInfo {
  avatar?: string;
  name?: string;
  nickname?: string;
  email: string;
  id?: string;
  access_token?: string;
}

/**
 * 认证存储工具
 */
export const authStorage = {
  /**
   * 获取 Authorization token
   */
  getAuthorization(): string | null {
    return localStorage.getItem(AUTH_KEYS.AUTHORIZATION);
  },

  /**
   * 设置 Authorization token
   */
  setAuthorization(token: string): void {
    localStorage.setItem(AUTH_KEYS.AUTHORIZATION, token);
  },

  /**
   * 获取 access_token
   */
  getToken(): string | null {
    return localStorage.getItem(AUTH_KEYS.TOKEN);
  },

  /**
   * 设置 access_token
   */
  setToken(token: string): void {
    localStorage.setItem(AUTH_KEYS.TOKEN, token);
  },

  /**
   * 获取用户信息
   */
  getUserInfo(): UserInfo | null {
    const userInfoStr = localStorage.getItem(AUTH_KEYS.USER_INFO);
    if (!userInfoStr) return null;
    try {
      return JSON.parse(userInfoStr);
    } catch {
      return null;
    }
  },

  /**
   * 设置用户信息
   */
  setUserInfo(userInfo: UserInfo): void {
    localStorage.setItem(AUTH_KEYS.USER_INFO, JSON.stringify(userInfo));
  },

  /**
   * 批量设置认证信息
   */
  setAuthData(data: {
    Authorization?: string;
    Token?: string;
    userInfo?: UserInfo;
  }): void {
    if (data.Authorization) {
      this.setAuthorization(data.Authorization);
    }
    if (data.Token) {
      this.setToken(data.Token);
    }
    if (data.userInfo) {
      this.setUserInfo(data.userInfo);
    }
  },

  /**
   * 清除所有认证信息
   */
  clearAll(): void {
    Object.values(AUTH_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
  },

  /**
   * 检查是否已登录
   */
  isAuthenticated(): boolean {
    return !!this.getAuthorization() && !!this.getToken();
  },
};

/**
 * 从 URL 参数或 localStorage 获取 Authorization
 * RAGFlow 登录成功后会通过 URL 参数传递 auth token
 */
export function getAuthorization(): string {
  const urlParams = new URLSearchParams(window.location.search);
  const authFromUrl = urlParams.get('auth');
  
  if (authFromUrl) {
    return `Bearer ${authFromUrl}`;
  }
  
  return authStorage.getAuthorization() || '';
}

/**
 * 重定向到首页（token 失效时）
 */
export function redirectToLogin(): void {
  const baseUrl = import.meta.env.BASE_URL || '/';
  const homePath = baseUrl.endsWith('/') ? `${baseUrl}home` : `${baseUrl}/home`;
  window.location.href = `${window.location.origin}${homePath}`;
}

/**
 * 带 JWT 认证的 fetch 封装
 * 自动注入 Authorization header，401 时跳转登录页
 */
export function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const authorization = getAuthorization();
  const headers = new Headers(init?.headers);
  if (authorization && !headers.has('Authorization')) {
    headers.set('Authorization', authorization);
  }
  return fetch(input, { ...init, headers }).then(res => {
    if (res.status === 401) {
      authStorage.clearAll();
      redirectToLogin();
    }
    return res;
  });
}

