import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, ChevronDown, Sparkles, ArrowRight,
  Beaker, Leaf, Atom, Rocket, Dna, WifiOff, Wifi,
  Bot, Zap, BookOpen, Cloud
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { useSSE } from '../hooks/useSSE'
import { api } from '../lib/api'
import { parseUtcDate } from '../lib/date'
import clsx from 'clsx'

const DEPTH_OPTIONS = [
  { value: 'quick', label: 'Quick', desc: '3 sub-questions', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { value: 'standard', label: 'Standard', desc: '5 sub-questions', color: 'text-primary-600 bg-primary-50 border-primary-200' },
  { value: 'deep', label: 'Deep', desc: '8 sub-questions', color: 'text-purple-600 bg-purple-50 border-purple-200' },
] as const

const TOPIC_ICONS: Record<string, React.ReactNode> = {
  'Quantum': <Atom className="w-8 h-8 text-purple-400" />,
  'Sustainable': <Leaf className="w-8 h-8 text-emerald-400" />,
  'Economic': <BookOpen className="w-8 h-8 text-orange-400" />,
  'AI': <Bot className="w-8 h-8 text-blue-400" />,
  'Space': <Rocket className="w-8 h-8 text-indigo-400" />,
  'CRISPR': <Dna className="w-8 h-8 text-pink-400" />,
}

const TOPIC_BG: Record<string, string> = {
  'Quantum': 'from-purple-50 to-indigo-50',
  'Sustainable': 'from-emerald-50 to-teal-50',
  'Economic': 'from-orange-50 to-amber-50',
  'AI': 'from-blue-50 to-cyan-50',
  'Space': 'from-indigo-50 to-violet-50',
  'CRISPR': 'from-pink-50 to-rose-50',
}

const EXAMPLE_QUERIES = [
  'The future of artificial intelligence in healthcare',
  'Sustainable energy transitions and economic impacts',
  'Quantum computing applications in cryptography',
]

export function Dashboard() {
  const navigate = useNavigate()
  const {
    selectedModel, depth, offlineMode,
    setModel, setDepth, setOfflineMode, setOllamaConnected,
    sessions, setSessions, startResearch,
  } = useStore()

  const [query, setQuery] = useState('')
  const [models, setModels] = useState<string[]>(['llama3:8b', 'mistral:7b', 'gemma2:9b'])
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { startStream } = useSSE()

  useEffect(() => {
    // Load sessions
    api.getSessions().then(setSessions).catch(() => {})
    // Load models — if the currently selected model isn't actually installed
    // in this Ollama instance, fall back to the first one that is, so live
    // research doesn't silently fail with "model not found".
    api.getModels().then((m) => {
      if (m.length) {
        setModels(m)
        if (!m.includes(selectedModel)) setModel(m[0])
      }
    }).catch(() => {})
    // Check Ollama
    api.getOllamaStatus()
      .then((s) => setOllamaConnected(s.available))
      .catch(() => setOllamaConnected(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleBeginResearch = async () => {
    if (!query.trim() || isStarting) return
    setIsStarting(true)
    startResearch(query.trim())
    startStream(query.trim(), selectedModel, depth, offlineMode)
    navigate('/research')
  }

  const getIconForSession = (q: string) => {
    const key = Object.keys(TOPIC_ICONS).find(k => q.toLowerCase().includes(k.toLowerCase()))
    return key ? TOPIC_ICONS[key] : <Beaker className="w-8 h-8 text-gray-400" />
  }

  const getBgForSession = (q: string) => {
    const key = Object.keys(TOPIC_BG).find(k => q.toLowerCase().includes(k.toLowerCase()))
    return key ? TOPIC_BG[key] : 'from-gray-50 to-slate-50'
  }

  const formatDate = (dateStr: string) => {
    const d = parseUtcDate(dateStr)
    const now = new Date()
    const diff = (now.getTime() - d.getTime()) / 1000
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
    if (diff < 172800) return 'Yesterday'
    return `${Math.round(diff / 86400)} days ago`
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-10 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-50 border border-primary-100 rounded-full text-primary-700 text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" /> New Research Inquiry
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 mb-3 tracking-tight">What should we look into today?</h1>
        <p className="text-gray-500 text-lg">Leverage advanced AI models to synthesize global knowledge and data.</p>
      </div>

      {/* Query card */}
      <div className="card p-6 mb-10 animate-slide-up shadow-elevated border-gray-100/80">
        {/* Search input */}
        <div className="relative mb-5">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            className="w-full pl-12 pr-4 py-4 text-base rounded-xl border border-gray-200 bg-surface-50
                       placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40
                       focus:border-primary-300 focus:bg-white transition-all duration-150"
            placeholder="What would you like to research today?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBeginResearch()}
          />
        </div>

        {/* Example queries */}
        {!query && (
          <div className="flex flex-wrap gap-2 mb-5">
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => setQuery(q)}
                className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-primary-50 hover:text-primary-700 transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Model Engine selector — only meaningful in offline mode (local Ollama).
              Online mode always uses the server-configured OpenRouter model, so
              there's nothing for the user to pick. */}
          <div>
            <label className="section-label mb-2 block">Model Engine</label>
            {offlineMode ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-primary-300 transition-all text-sm font-medium text-gray-700"
                >
                  <span>{selectedModel}</span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>
                {showModelDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden animate-fade-in">
                    {models.map((m) => (
                      <button
                        key={m}
                        onClick={() => { setModel(m); setShowModelDropdown(false) }}
                        className={clsx(
                          'w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 transition-colors',
                          m === selectedModel ? 'text-primary-700 bg-primary-50 font-medium' : 'text-gray-700'
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-400 cursor-not-allowed"
                title="Online mode always uses the server-configured OpenRouter model"
              >
                <span>OpenRouter (cloud)</span>
                <Cloud className="w-4 h-4 text-gray-300" />
              </div>
            )}
          </div>

          {/* Research Depth */}
          <div>
            <label className="section-label mb-2 block">Research Depth</label>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
              {DEPTH_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setDepth(value)}
                  className={clsx(
                    'flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-150',
                    depth === value
                      ? 'bg-white shadow text-primary-700'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode */}
          <div>
            <label className="section-label mb-2 block">Mode</label>
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                {offlineMode ? <WifiOff className="w-4 h-4 text-amber-500" /> : <Wifi className="w-4 h-4 text-emerald-500" />}
                <span>Offline Mode</span>
              </div>
              <button
                onClick={() => setOfflineMode(!offlineMode)}
                className={clsx(
                  'relative w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none',
                  offlineMode ? 'bg-primary-600' : 'bg-gray-300'
                )}
              >
                <span className={clsx(
                  'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
                  offlineMode ? 'translate-x-4' : 'translate-x-0'
                )} />
              </button>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="flex justify-end mt-5">
          <button
            onClick={handleBeginResearch}
            disabled={!query.trim() || isStarting}
            className="btn-primary text-base px-7 py-3"
          >
            <Sparkles className="w-5 h-5" />
            {isStarting ? 'Starting…' : 'Begin Research Inquiry'}
          </button>
        </div>
      </div>

      {/* Recent Research */}
      <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Recent Research</h2>
            <p className="text-sm text-gray-500 mt-0.5">Your past queries and generated papers.</p>
          </div>
          <button
            onClick={() => navigate('/library')}
            className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            View All Library <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {sessions.length === 0 ? (
          <div className="card p-12 text-center">
            <Zap className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No research sessions yet</p>
            <p className="text-sm text-gray-400 mt-1">Enter a query above and click "Begin Research Inquiry" to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.slice(0, 6).map((session) => (
              <div
                key={session.id}
                className="card card-hover overflow-hidden cursor-pointer group"
                onClick={() => navigate(`/report/${session.id}`)}
              >
                {/* Top color block */}
                <div className={clsx(
                  'h-24 bg-gradient-to-br flex items-center justify-center',
                  getBgForSession(session.query)
                )}>
                  {getIconForSession(session.query)}
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={clsx(
                      'badge',
                      session.depth === 'quick' ? 'badge-quick' :
                      session.depth === 'deep' ? 'bg-purple-100 text-purple-700' : 'badge-standard'
                    )}>
                      {session.depth.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(session.created_at)}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 leading-snug mb-3 line-clamp-2">
                    {session.query}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {session.critic_score && (
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(i => (
                            <div key={i} className={clsx(
                              'w-3 h-3 rounded-full',
                              i <= Math.round(session.critic_score! / 2) ? 'bg-emerald-400' : 'bg-gray-200'
                            )} />
                          ))}
                        </div>
                      )}
                    </div>
                    <button className="text-xs font-semibold text-primary-600 group-hover:underline flex items-center gap-1">
                      OPEN <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-16 text-center pb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <img src="/logo.ico" alt="Dvelve" className="w-6 h-6 rounded-md object-contain" />
          <span className="text-sm font-semibold text-gray-700">Dvelve Academic Edition</span>
        </div>
        <p className="text-xs text-gray-400">© 2026 Dvelve. All queries are processed locally with scholarly integrity.</p>
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-400">
          <button className="hover:text-gray-600">Privacy Policy</button>
          <button className="hover:text-gray-600">Ethics Statement</button>
          <button className="hover:text-gray-600">API Documentation</button>
        </div>
      </div>
    </div>
  )
}
