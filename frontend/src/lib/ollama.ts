// Shared client-side Ollama connectivity check, used by both Settings.tsx
// (explicit "Test Connection" button) and Dashboard.tsx (model picker).
// FIX: this must run in the browser, not be proxied through the backend —
// Ollama is inherently a local/loopback (or tunnel) service reachable from
// the user's own machine. A cloud-deployed backend testing "localhost" can
// only ever reach itself, never the user's Ollama, so a backend-mediated
// check always reports unavailable regardless of the real state. Dashboard
// and Settings used to probe independently (one client-side, one backend-
// mediated) and could disagree about which models actually exist — this is
// the single source of truth for both now.
export interface OllamaProbeResult {
  available: boolean
  models: string[]
}

export async function probeOllama(baseUrl: string, timeoutMs = 4000): Promise<OllamaProbeResult> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    const base = baseUrl.trim().replace(/\/+$/, '')
    const r = await fetch(`${base}/api/tags`, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!r.ok) throw new Error(`Ollama responded ${r.status}`)
    const data = await r.json()
    const models: string[] = Array.isArray(data.models)
      ? data.models.map((m: { name: string }) => m.name).filter((n: unknown): n is string => typeof n === 'string')
      : []
    return { available: true, models }
  } catch {
    return { available: false, models: [] }
  }
}
