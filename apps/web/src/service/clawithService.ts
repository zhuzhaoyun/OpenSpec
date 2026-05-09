const cfg = (): Record<string, string> => window.__APP_CONFIG__ ?? import.meta.env

const BASE = cfg().VITE_CLAWITH_BASE_URL as string
const AGENT_ID = cfg().VITE_CLAWITH_AGENT_ID as string

export async function loginToClawith(): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      login_identifier: cfg().VITE_CLAWITH_EMAIL,
      password: cfg().VITE_CLAWITH_PASSWORD,
    }),
  })
  if (!r.ok) throw new Error('Clawith 登录失败')
  return (await r.json()).access_token
}

export async function createClawithSession(jwt: string, title: string): Promise<string> {
  const r = await fetch(`${BASE}/api/agents/${AGENT_ID}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: '{}',
  })
  if (!r.ok) throw new Error('Clawith session 创建失败')
  return (await r.json()).id
}

export function connectClawithWebSocket(
  jwt: string,
  sessionId: string,
  onMessage: (msg: any) => void,
): { ws: WebSocket; send: (text: string) => void; close: () => void } {
  const wsUrl = BASE.replace(/^http/, 'ws')
  const ws = new WebSocket(
    `${wsUrl}/ws/chat/${AGENT_ID}?token=${encodeURIComponent(jwt)}&session_id=${encodeURIComponent(sessionId)}`,
  )

  const pendingMessages: string[] = []

  ws.onopen = () => {
    console.log('[Clawith] WebSocket connected, session:', sessionId)
    // 连接建立后，发送之前排队的消息
    for (const msg of pendingMessages) {
      ws.send(msg)
    }
    pendingMessages.length = 0
  }

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      onMessage(msg)
    } catch {
      console.warn('[Clawith] Non-JSON message:', event.data)
    }
  }

  ws.onerror = (err) => {
    console.error('[Clawith] WebSocket error:', err)
  }

  ws.onclose = (e) => {
    console.log('[Clawith] WebSocket closed:', e.code, e.reason)
  }

  return {
    ws,
    send: (text: string) => {
      const payload = JSON.stringify({ content: text })
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload)
      } else if (ws.readyState === WebSocket.CONNECTING) {
        pendingMessages.push(payload)
      }
    },
    close: () => ws.close(),
  }
}
