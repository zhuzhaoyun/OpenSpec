export {}

declare global {
  interface Window {
    __APP_CONFIG__?: {
      VITE_CLAWITH_BASE_URL: string
      VITE_CLAWITH_AGENT_ID: string
      VITE_CLAWITH_EMAIL: string
      VITE_CLAWITH_PASSWORD: string
    }
  }
}
