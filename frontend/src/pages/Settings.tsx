import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Server, Shield, Trash2,
  CheckCircle, XCircle, Search, Clock,
  ArrowRight
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { api } from '../lib/api'
import { parseUtcDate } from '../lib/date'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import clsx from 'clsx'

export function Settings() {
  const navigate = useNavigate()
  const {
    ollamaUrl, setOllamaUrl, offlineMode, setOfflineMode,
    ollamaConnected, setOllamaConnected, sessions, setSessions,
  } = useStore()

  const [urlInput, setUrlInput] = useState(ollamaUrl)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ available: boolean; models: string[] } | null>(null)
  const [saved, setSaved] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false)

  useEffect(() => {
    api.getSessions().then(setSessions).catch(() => {})
  }, [setSessions])

  // FIX: Test Ollama connectivity directly from the browser instead of
  // proxying through the backend. Ollama is inherently a local/loopback (or
  // tunnel) service reachable from the user's own machine — a cloud-deployed
  // backend testing "localhost" would only ever reach itself, never the
  // user's Ollama, and always report false regardless of the real state.
  // Requires the target Ollama instance to allow this origin via
  // OLLAMA_ORIGINS (see Settings page copy / Instructions.md).
  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4000)
      const base = urlInput.trim().replace(/\/+$/, '')
      const r = await fetch(`${base}/api/tags`, { signal: controller.signal })
      clearTimeout(timeoutId)
      if (!r.ok) throw new Error(`Ollama responded ${r.status}`)
      const data = await r.json()
      const models: string[] = Array.isArray(data.models)
        ? data.models.map((m: { name: string }) => m.name)
        : []
      setTestResult({ available: true, models })
      setOllamaConnected(true)
    } catch {
      setTestResult({ available: false, models: [] })
      setOllamaConnected(false)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    setOllamaUrl(urlInput)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleDeleteAllSessions = async () => {
    setShowDeleteAllDialog(true)
  }

  const confirmDeleteAll = async () => {
    await api.deleteAllSessions()
    setSessions([])
    setShowDeleteAllDialog(false)
  }

  const formatDate = (dateStr: string) => {
    const d = parseUtcDate(dateStr)
    const now = new Date()
    const diff = (now.getTime() - d.getTime()) / 1000
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
    if (diff < 172800) return 'Yesterday'
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/(\d+)\s(\w+)\s(\d+)/, '$2 $3')
  }

  const filteredSessions = sessions.filter(s =>
    s.query.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="h-[calc(100vh-56px)] flex overflow-hidden">
      <ConfirmDialog
        open={showDeleteAllDialog}
        title="Delete All Sessions"
        message="All research sessions and generated reports will be permanently deleted. This cannot be undone."
        confirmLabel="Delete All"
        onConfirm={confirmDeleteAll}
        onCancel={() => setShowDeleteAllDialog(false)}
      />
      {/* Left — Research History */}
      <div className="w-72 border-r border-gray-100 bg-white flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Research History</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-300"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-10 px-4">
              <Clock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No sessions found</p>
            </div>
          ) : (
            filteredSessions.map((session) => (
              <div
                key={session.id}
                className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 group transition-colors"
                onClick={() => navigate(`/report/${session.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 line-clamp-1">{session.query}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                      {session.query.length > 80 ? session.query.slice(0, 80) + '…' : ''}
                    </p>
                    <span className="text-xs text-gray-400">{formatDate(session.created_at)}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-primary-400 shrink-0 mt-1 ml-2" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right — Settings Panel */}
      <div className="flex-1 overflow-y-auto bg-surface-50">
        <div className="max-w-2xl mx-auto px-8 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Settings</h1>
            <p className="text-gray-500 mt-1">Configure your local AI environment and workspace preferences.</p>
          </div>

          {/* Ollama Config */}
          <div className="card p-6 mb-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
                <Server className="w-5 h-5 text-primary-600" />
              </div>
              <h2 className="text-base font-bold text-gray-800">Ollama Configuration</h2>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Local Host URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="input-field flex-1"
                  placeholder="http://localhost:11434"
                />
                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="btn-secondary whitespace-nowrap"
                >
                  {testing ? 'Testing…' : 'Test Connection'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                Tested directly from this browser, not the server — works for a local instance
                or a tunnel URL (ngrok, Cloudflare Tunnel). Requires Ollama's <code className="text-[11px]">OLLAMA_ORIGINS</code> to
                include this site's origin.
              </p>

              {testResult && (
                <div className={clsx(
                  'flex items-center gap-2 mt-2 text-sm',
                  testResult.available ? 'text-emerald-600' : 'text-red-500'
                )}>
                  {testResult.available ? (
                    <><CheckCircle className="w-4 h-4" /> Successfully connected to Ollama instance</>
                  ) : (
                    <><XCircle className="w-4 h-4" /> Could not connect — check the URL, that Ollama is running, and OLLAMA_ORIGINS</>
                  )}
                </div>
              )}

              {ollamaConnected && !testResult && (
                <p className="text-sm text-emerald-600 flex items-center gap-1.5 mt-2">
                  <CheckCircle className="w-4 h-4" /> Successfully connected to Ollama instance
                </p>
              )}
            </div>

            {testResult?.available && testResult.models.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Default Model Selection</label>
                <select
                  className="input-field"
                  value={useStore.getState().selectedModel}
                  onChange={(e) => useStore.getState().setModel(e.target.value)}
                >
                  {testResult.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* System & Privacy */}
          <div className="card p-6 mb-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                <Shield className="w-5 h-5 text-amber-600" />
              </div>
              <h2 className="text-base font-bold text-gray-800">System & Privacy</h2>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-800">Offline Mode</p>
                <p className="text-xs text-gray-500 mt-0.5">Prevent the agent from making any external web requests during research.</p>
              </div>
              <button
                onClick={() => setOfflineMode(!offlineMode)}
                className={clsx(
                  'relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none shrink-0 ml-4',
                  offlineMode ? 'bg-primary-600' : 'bg-gray-300'
                )}
              >
                <span className={clsx(
                  'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
                  offlineMode ? 'translate-x-5' : 'translate-x-0'
                )} />
              </button>
            </div>
          </div>

          {/* Purge History */}
          <div className="card p-6 mb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-800">Purge History</p>
                <p className="text-xs text-gray-500 mt-0.5">Permanently delete all research sessions and indexed documents.</p>
              </div>
              <button
                onClick={handleDeleteAllSessions}
                className="btn-secondary text-red-600 border-red-200 hover:bg-red-50 text-sm shrink-0 ml-4"
              >
                <Trash2 className="w-4 h-4" /> Delete All Data
              </button>
            </div>
          </div>

          {/* Save / Discard */}
          <div className="flex items-center justify-end gap-3">
            <button onClick={() => setUrlInput(ollamaUrl)} className="btn-secondary">Discard</button>
            <button onClick={handleSave} className="btn-primary">
              {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
