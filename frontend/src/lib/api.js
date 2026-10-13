export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || API_URL.replace(/^http/, "ws")

export function getImageUrl(path) {
  if (!path) return ""
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path}`
}

export function getToken() {
  if (typeof window === "undefined") return null
  return localStorage.getItem("token")
}

export function getRole() {
  if (typeof window === "undefined") return null
  return localStorage.getItem("role")
}

export function logout() {
  localStorage.removeItem("token")
  localStorage.removeItem("role")
}

export async function apiFetch(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    const msg = `${res.status}: ${body}`
    throw new Error(msg)
  }
  if (res.status === 204) return null
  return res.json()
}

export function connectWebSocket(sessionId, onMessage) {
  const token = getToken()
  const url = token
    ? `${WS_URL}/api/chat/ws/${sessionId}?token=${token}`
    : `${WS_URL}/api/chat/ws/${sessionId}`
  const ws = new WebSocket(url)
  ws.onmessage = (e) => onMessage(JSON.parse(e.data))
  return ws
}


export const billingApi = {
  config: () => apiFetch("/api/billing/config"),
  status: () => apiFetch("/api/billing/status"),
  paddleCheckout: (plan, cycle) =>
    apiFetch("/api/billing/paddle/checkout", {
      method: "POST",
      body: JSON.stringify({ plan, cycle }),
    }),
  paddleTransaction: (transactionId) =>
    apiFetch(`/api/billing/paddle/transaction/${transactionId}`),
  startTrial: (restaurantId) =>
    apiFetch(`/api/restaurants/${restaurantId}/trial`, { method: "POST" }),
  setCurrency: (restaurantId, currency) =>
    apiFetch(`/api/restaurants/${restaurantId}/currency`, {
      method: "POST",
      body: JSON.stringify({ currency }),
    }),
};
