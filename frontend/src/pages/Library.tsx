import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Library as LibraryIcon, Search, Grid, List,
  ArrowRight, Atom, Leaf, Bot, Rocket, Dna, Beaker,
  Trash2, Clock, Wifi, WifiOff, AlertTriangle
} from 'lucide-react'
import { useStore } from '../store/useStore'
import type { LlmProvider } from '../store/useStore'
import { api } from '../lib/api'
import { parseUtcDate } from '../lib/date'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { PROVIDER_LABELS, PROVIDER_TEXT_CLASS } from '../lib/provider'
import clsx from 'clsx'

const TOPIC_COLORS: Record<string, string> = {
  'Quantum': 'from-purple-100 to-indigo-100',
  'Sustainable': 'from-emerald-100 to-teal-100',
  'Economic': 'from-orange-100 to-amber-100',
  'AI': 'from-blue-100 to-cyan-100',
  'Space': 'from-indigo-100 to-violet-100',
  'CRISPR': 'from-pink-100 to-rose-100',
}

const TOPIC_ICON_COLORS: Record<string, string> = {
  'Quantum': 'text-purple-400',
  'Sustainable': 'text-emerald-400',
  'Economic': 'text-orange-400',
  'AI': 'text-blue-400',
  'Space': 'text-indigo-400',
  'CRISPR': 'text-pink-400',
}

function ModeBadge({ llmProvider }: { llmProvider?: LlmProvider | null }) {
  if (!llmProvider) return null
  const Icon = llmProvider === 'openrouter' ? Wifi : WifiOff
  return (
    <span className={clsx('flex items-center gap-1 text-xs', PROVIDER_TEXT_CLASS[llmProvider])} title={PROVIDER_LABELS[llmProvider]}>
      <Icon className="w-3 h-3" /> {llmProvider === 'mock' ? 'Mock' : llmProvider === 'ollama' ? 'Ollama' : 'OpenRouter'}
    </span>
  )
}

const STATUS_META = {
  failed: { label: 'Failed', className: 'text-red-600 bg-red-50' },
  cancelled: { label: 'Cancelled', className: 'text-amber-600 bg-amber-50' },
} as const

function StatusBadge({ status, pill }: { status: string; pill?: boolean }) {
  const meta = STATUS_META[status as keyof typeof STATUS_META]
  if (!meta) return null
  return (
    <span className={clsx(
      'flex items-center gap-1 text-xs font-semibold',
      pill ? clsx(meta.className, 'px-2 py-0.5 rounded-full') : meta.className.split(' ')[0]
    )}>
      <AlertTriangle className="w-3 h-3" /> {meta.label}
    </span>
  )
}

export function Library() {
  const navigate = useNavigate()
  const { sessions, setSessions } = useStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'quick' | 'standard' | 'deep'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  useEffect(() => {
    api.getSessions().then(setSessions).catch(() => {})
  }, [setSessions])

  const getIcon = (q: string) => {
    const key = Object.keys(TOPIC_COLORS).find(k => q.toLowerCase().includes(k.toLowerCase()))
    const color = key ? TOPIC_ICON_COLORS[key] : 'text-gray-400'
    switch (key) {
      case 'Quantum': return <Atom className={clsx('w-8 h-8', color)} />
      case 'AI': return <Bot className={clsx('w-8 h-8', color)} />
      case 'Sustainable': return <Leaf className={clsx('w-8 h-8', color)} />
      case 'Space': return <Rocket className={clsx('w-8 h-8', color)} />
      case 'CRISPR': return <Dna className={clsx('w-8 h-8', color)} />
      default: return <Beaker className={clsx('w-8 h-8', color)} />
    }
  }

  const getBg = (q: string) => {
    const key = Object.keys(TOPIC_COLORS).find(k => q.toLowerCase().includes(k.toLowerCase()))
    return key ? TOPIC_COLORS[key] : 'from-gray-100 to-slate-100'
  }

  const formatDate = (dateStr: string) => {
    const d = parseUtcDate(dateStr)
    const now = new Date()
    const diff = (now.getTime() - d.getTime()) / 1000
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
    if (diff < 172800) return 'Yesterday'
    return d.toLocaleDateString()
  }

  const filtered = sessions
    .filter(s => filter === 'all' || s.depth === filter)
    .filter(s => s.query.toLowerCase().includes(searchQuery.toLowerCase()))

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDeleteTarget(id)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    await api.deleteSession(deleteTarget)
    setSessions(sessions.filter(s => s.id !== deleteTarget))
    setDeleteTarget(null)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Research Session"
        message="This report will be permanently deleted and cannot be recovered."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Research Library</h1>
          <p className="text-sm text-gray-500 mt-0.5">{sessions.length} research reports</p>
        </div>
        <button onClick={() => navigate('/dashboard')} className="btn-primary text-sm">
          + New Research
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          {(['all', 'quick', 'standard', 'deep'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
                filter === f ? 'bg-white shadow text-primary-700' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-1 border border-gray-200 rounded-xl p-1 bg-white">
          <button
            onClick={() => setViewMode('grid')}
            className={clsx('p-1.5 rounded-lg transition-all', viewMode === 'grid' ? 'bg-primary-50 text-primary-600' : 'text-gray-400 hover:text-gray-600')}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={clsx('p-1.5 rounded-lg transition-all', viewMode === 'list' ? 'bg-primary-50 text-primary-600' : 'text-gray-400 hover:text-gray-600')}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card py-20 text-center">
          <LibraryIcon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {sessions.length === 0 ? 'No research reports yet' : 'No reports match your search'}
          </p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary mt-4 mx-auto">
            Start Your First Research
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((session) => (
            <div
              key={session.id}
              className="card card-hover overflow-hidden cursor-pointer group relative"
              onClick={() => navigate(`/report/${session.id}`)}
            >
              <button
                onClick={(e) => handleDelete(e, session.id)}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 text-gray-400 hover:text-red-500 hover:bg-white opacity-0 group-hover:opacity-100 transition-all z-10"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <div className={clsx('h-20 bg-gradient-to-br flex items-center justify-center', getBg(session.query))}>
                {getIcon(session.query)}
              </div>
              <div className="p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={clsx('badge text-xs', session.depth === 'quick' ? 'badge-quick' : session.depth === 'deep' ? 'bg-purple-100 text-purple-700' : 'badge-standard')}>
                    {session.depth.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(session.created_at)}</span>
                </div>
                <p className="text-sm font-semibold text-gray-800 line-clamp-2 mb-2">{session.query}</p>
                {(session.status === 'failed' || session.status === 'cancelled') && (
                  <div className="mb-2"><StatusBadge status={session.status} /></div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{session.source_count} sources</span>
                  <ModeBadge llmProvider={session.llm_provider as LlmProvider} />
                </div>
                <div className="flex items-center justify-end mt-1">
                  <span className="text-xs font-semibold text-primary-600 group-hover:underline flex items-center gap-0.5">OPEN <ArrowRight className="w-3 h-3" /></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card divide-y divide-gray-100 overflow-hidden">
          {filtered.map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 cursor-pointer group transition-colors"
              onClick={() => navigate(`/report/${session.id}`)}
            >
              <div className={clsx('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0', getBg(session.query))}>
                {getIcon(session.query)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{session.query}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className={clsx('badge text-xs', session.depth === 'quick' ? 'badge-quick' : session.depth === 'deep' ? 'bg-purple-100 text-purple-700' : 'badge-standard')}>
                    {session.depth}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" /> {formatDate(session.created_at)}
                  </span>
                  <span className="text-xs text-gray-400">{session.source_count} sources</span>
                  <ModeBadge llmProvider={session.llm_provider as LlmProvider} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {session.status === 'failed' || session.status === 'cancelled' ? (
                  <StatusBadge status={session.status} pill />
                ) : session.critic_score ? (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {session.critic_score}/10
                  </span>
                ) : null}
                <button onClick={(e) => handleDelete(e, session.id)} className="btn-ghost text-red-400 hover:text-red-500 opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-4 h-4" />
                </button>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-primary-400" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
