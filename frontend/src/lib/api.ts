import { useStore } from '../store/useStore'

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

function authHeaders(): Record<string, string> {
  const token = useStore.getState().token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// FastAPI returns `detail` as a plain string for most errors, but as an array
// of Pydantic validation-error objects ({loc, msg, type}) on a 422 — without
// this, new Error(detail) on an array stringifies to "[object Object],...".
export function extractErrorMessage(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map((d) => (d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : null))
      .filter((m): m is string => !!m)
    if (messages.length) return messages.join(', ')
  }
  return 'Request failed'
}

async function handleResponse(r: Response) {
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }))
    throw new Error(extractErrorMessage(err.detail))
  }
  return r.json()
}

export const api = {
  // ── Auth ────────────────────────────────────────────────────────────────
  async signup(username: string, email: string, password: string) {
    const r = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    })
    return handleResponse(r)
  },

  async signin(email: string, password: string) {
    const r = await fetch(`${API_BASE}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    return handleResponse(r)
  },

  async getMe() {
    const r = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { ...authHeaders() },
    })
    return handleResponse(r)
  },

  // ── Models / Ollama ──────────────────────────────────────────────────────
  async getModels(): Promise<string[]> {
    const r = await fetch(`${API_BASE}/api/models`, { headers: authHeaders() })
    const data = await r.json()
    return data.models || []
  },

  async getOllamaStatus(): Promise<{ available: boolean; base_url: string }> {
    const r = await fetch(`${API_BASE}/api/ollama/status`, { headers: authHeaders() })
    return r.json()
  },

  // ── Sessions ─────────────────────────────────────────────────────────────
  async getSessions() {
    const r = await fetch(`${API_BASE}/api/sessions`, { headers: authHeaders() })
    return handleResponse(r)
  },

  async getSession(id: string) {
    const r = await fetch(`${API_BASE}/api/sessions/${id}`, { headers: authHeaders() })
    return handleResponse(r)
  },

  async deleteSession(id: string) {
    await fetch(`${API_BASE}/api/sessions/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
  },

  async deleteAllSessions() {
    await fetch(`${API_BASE}/api/sessions`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
  },

  exportMarkdownUrl(id: string) {
    return `${API_BASE}/api/sessions/${id}/export/markdown`
  },

  exportPdfUrl(id: string) {
    return `${API_BASE}/api/sessions/${id}/export/pdf`
  },
}

