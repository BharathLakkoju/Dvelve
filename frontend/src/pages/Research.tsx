import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle, Circle, Loader2, XCircle,
  Globe, Bot, X, ExternalLink, Sparkles,
  ChevronRight, Wifi, WifiOff, AlertTriangle
} from 'lucide-react'
import { useStore } from '../store/useStore'
import type { AgentStatus } from '../store/useStore'
import clsx from 'clsx'

const AGENTS = [
  { key: 'planner', label: 'Planner', desc: 'Formulating research strategy' },
  { key: 'retriever', label: 'Retriever', desc: 'Searching web & documents' },
  { key: 'ranker', label: 'Ranker', desc: 'Scoring & deduplicating' },
  { key: 'writer', label: 'Writer', desc: 'Drafting research report' },
  { key: 'critic', label: 'Critic', desc: 'Reviewing report quality' },
] as const

function AgentIcon({ status }: { status: AgentStatus }) {
  switch (status) {
    case 'complete':
      return <CheckCircle className="w-5 h-5 text-emerald-500" />
    case 'thinking':
      return <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
    case 'error':
      return <XCircle className="w-5 h-5 text-red-500" />
    default:
      return <Circle className="w-5 h-5 text-gray-300" />
  }
}

function AgentStatusLabel({ status }: { status: AgentStatus }) {
  switch (status) {
    case 'complete': return <span className="text-xs font-semibold text-emerald-600">COMPLETED</span>
    case 'thinking': return <span className="text-xs font-semibold text-primary-600 animate-pulse">IN PROGRESS</span>
    case 'error': return <span className="text-xs font-semibold text-red-500">ERROR</span>
    default: return <span className="text-xs font-semibold text-gray-400">PENDING</span>
  }
}

const PROVIDER_META = {
  mock: { label: 'Offline · Mock Data', dotClass: 'bg-amber-400', badgeClass: 'text-amber-700 bg-amber-50 border-amber-200', Icon: WifiOff },
  ollama: { label: 'Offline · Local Ollama', dotClass: 'bg-emerald-400', badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200', Icon: Wifi },
  openrouter: { label: 'Online · OpenRouter Cloud', dotClass: 'bg-sky-400', badgeClass: 'text-sky-700 bg-sky-50 border-sky-200', Icon: Wifi },
} as const

export function Research() {
  const navigate = useNavigate()
  const {
    currentQuery, subQuestions, sources, agentStates,
    currentAgentMessage, progress, isResearching,
    currentSessionId, criticResult, llmProvider, researchError,
  } = useStore()

  useEffect(() => {
    if (!currentQuery) {
      navigate('/')
    }
  }, [currentQuery, navigate])

  const isComplete = agentStates.critic === 'complete'
  const hasError = !!researchError
  // llmProvider is null until the backend confirms the mode via the first
  // status event ("mock" | "ollama" | "openrouter").
  const providerMeta = llmProvider ? PROVIDER_META[llmProvider] : null

  const handleViewReport = () => {
    if (currentSessionId) navigate(`/report/${currentSessionId}`)
  }

  const handleStop = () => {
    useStore.getState().resetResearch()
    navigate('/')
  }

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Current Research</p>
          <p className="text-sm font-semibold text-gray-800 mt-0.5 max-w-xl truncate">{currentQuery}</p>
        </div>
        <div className="flex items-center gap-3">
          {providerMeta && (
            <div className={clsx(
              'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border',
              providerMeta.badgeClass
            )}>
              <providerMeta.Icon className="w-3.5 h-3.5" />
              <span>{providerMeta.label}</span>
            </div>
          )}
          {/* Model name is only meaningful for local Ollama — OpenRouter always
              uses the server-configured model, ignoring the client's selection. */}
          <div className={clsx(
            'items-center gap-1.5 text-xs text-gray-500 font-medium',
            llmProvider === 'openrouter' ? 'hidden' : 'flex'
          )}>
            <Bot className="w-3.5 h-3.5 text-primary-400" />
            <span>{useStore.getState().selectedModel}</span>
          </div>
          {isComplete ? (
            <button onClick={handleViewReport} className="btn-primary text-sm">
              <Sparkles className="w-4 h-4" /> View Report
            </button>
          ) : (
            <button onClick={handleStop} className="btn-secondary text-sm text-red-600 border-red-200 hover:bg-red-50">
              <X className="w-4 h-4" /> {hasError ? 'Back to Dashboard' : 'Stop Research'}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — Agent Activity */}
        <div className="w-56 border-r border-gray-100 bg-white flex flex-col shrink-0 overflow-y-auto">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="section-label">Agent Activity</p>
          </div>
          <div className="px-3 py-3 space-y-1 flex-1">
            {AGENTS.map(({ key, label, desc }) => {
              const status = agentStates[key]
              return (
                <div
                  key={key}
                  className={clsx(
                    'flex items-start gap-3 px-3 py-3 rounded-xl transition-all',
                    status === 'thinking' ? 'bg-primary-50 border border-primary-100' :
                    status === 'complete' ? 'bg-gray-50' : ''
                  )}
                >
                  <AgentIcon status={status} />
                  <div className="min-w-0">
                    <p className={clsx(
                      'text-sm font-semibold',
                      status === 'thinking' ? 'text-primary-700' :
                      status === 'complete' ? 'text-gray-700' : 'text-gray-400'
                    )}>{label}</p>
                    <p className="text-xs text-gray-400 truncate">{desc}</p>
                    <AgentStatusLabel status={status} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Current operation */}
          {currentAgentMessage && (
            <div className="m-3 p-3 bg-primary-50 rounded-xl border border-primary-100">
              <p className="text-xs font-semibold text-primary-700 mb-1">Current Operation</p>
              <p className="text-xs text-primary-600 italic leading-relaxed">"{currentAgentMessage}"</p>
            </div>
          )}

          {/* Status bar */}
          <div className="p-3 border-t border-gray-100 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <div className={clsx('w-2 h-2 rounded-full', hasError ? 'bg-red-400' : isComplete ? 'bg-emerald-400' : 'bg-blue-400 animate-pulse')} />
              <span className="text-xs text-gray-500">
                {hasError ? 'Failed' : isComplete ? 'Complete' : providerMeta ? providerMeta.label : 'Connecting…'}
              </span>
            </div>
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1 text-right">Progress: {Math.round(progress)}%</p>
          </div>
        </div>

        {/* Center — Live Reasoning Stream */}
        <div className="flex-1 flex flex-col overflow-hidden bg-surface-50">
          <div className="px-6 py-3 border-b border-gray-100 bg-white shrink-0 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-widest">Live Reasoning Stream</p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {/* Sub-questions */}
            {subQuestions.map((sq, i) => (
              <div
                key={sq.id}
                className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm animate-slide-up flex items-start gap-3"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-primary-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{sq.question}</p>
                  {sq.search_query && (
                    <p className="text-xs text-gray-400 mt-1 italic">Searching: "{sq.search_query}"</p>
                  )}
                </div>
              </div>
            ))}

            {/* Error banner */}
            {hasError && (
              <div className="bg-red-50 rounded-xl border border-red-200 p-4 animate-fade-in flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Research failed</p>
                  <p className="text-xs text-red-600 mt-1 leading-relaxed">{researchError}</p>
                </div>
              </div>
            )}

            {/* Thinking activity */}
            {isResearching && !isComplete && !hasError && (
              <div className="bg-white rounded-xl border border-primary-100 p-4 shadow-sm animate-fade-in flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                  <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-medium text-primary-700 italic">
                    {currentAgentMessage || 'Agent is processing…'}
                  </p>
                  <div className="flex gap-1 mt-1.5">
                    <div className="w-2 h-2 rounded-full bg-primary-300 animate-bounce" style={{ animationDelay: '0s' }} />
                    <div className="w-2 h-2 rounded-full bg-primary-300 animate-bounce" style={{ animationDelay: '0.15s' }} />
                    <div className="w-2 h-2 rounded-full bg-primary-300 animate-bounce" style={{ animationDelay: '0.3s' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Critic result */}
            {criticResult && (
              <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4 animate-slide-up">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <p className="text-sm font-semibold text-emerald-700">Report Quality Score: {criticResult.quality_score}/10</p>
                </div>
                {criticResult.strengths.slice(0, 2).map((s, i) => (
                  <p key={i} className="text-xs text-emerald-600">✓ {s}</p>
                ))}
              </div>
            )}

            {/* Complete CTA */}
            {isComplete && (
              <div className="bg-gradient-to-r from-primary-600 to-purple-600 rounded-xl p-5 text-white text-center animate-slide-up">
                <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                <p className="font-bold text-lg mb-1">Research Complete!</p>
                <p className="text-sm text-white/80 mb-3">Your report is ready to view.</p>
                <button onClick={handleViewReport} className="bg-white text-primary-700 font-semibold text-sm px-6 py-2.5 rounded-xl hover:bg-primary-50 transition-all flex items-center gap-2 mx-auto">
                  View Full Report <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Est. completion */}
          {!isComplete && !hasError && (
            <div className="px-6 py-2 border-t border-gray-100 bg-white shrink-0 flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <div className={clsx('w-1.5 h-1.5 rounded-full', providerMeta ? providerMeta.dotClass : 'bg-gray-300 animate-pulse')} />
                  {providerMeta ? providerMeta.label : 'Connecting…'}
                </span>
              </div>
              <span>Progress: {Math.round(progress)}%</span>
            </div>
          )}
        </div>

        {/* Right — Sources Panel */}
        <div className="w-64 border-l border-gray-100 bg-white flex flex-col overflow-hidden shrink-0">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
            <p className="section-label">Sources Found ({sources.length})</p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {sources.length === 0 ? (
              <div className="text-center py-8">
                <Globe className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Sources will appear here</p>
              </div>
            ) : (
              sources.map((source, i) => (
                <div
                  key={source.id}
                  className="p-3 rounded-xl border border-gray-100 hover:border-primary-100 hover:bg-primary-50/30 transition-all animate-slide-up cursor-pointer group"
                  style={{ animationDelay: `${i * 0.05}s` }}
                  onClick={() => window.open(source.url, '_blank')}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-4 h-4 rounded bg-gray-100 flex items-center justify-center">
                      <Globe className="w-2.5 h-2.5 text-gray-500" />
                    </div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide truncate">{source.domain}</p>
                    <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-primary-400 ml-auto shrink-0" />
                  </div>
                  <p className="text-xs font-semibold text-gray-800 line-clamp-2 mb-1">{source.title}</p>
                  <p className="text-xs text-gray-500 line-clamp-2">{source.snippet}</p>
                  {source.relevance_score > 0 && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="flex-1 h-1 bg-gray-100 rounded-full">
                        <div
                          className="h-full bg-primary-400 rounded-full"
                          style={{ width: `${Math.round(source.relevance_score * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">{Math.round(source.relevance_score * 100)}%</span>
                    </div>
                  )}
                </div>
              ))
            )}

            {isResearching && sources.length > 0 && !isComplete && (
              <div className="flex items-center justify-center gap-2 py-2">
                <div className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-primary-300 animate-bounce" style={{ animationDelay: '0.15s' }} />
                <div className="w-2 h-2 rounded-full bg-primary-200 animate-bounce" style={{ animationDelay: '0.3s' }} />
                <span className="text-xs text-gray-400">Fetching more…</span>
              </div>
            )}
          </div>

          {sources.length > 0 && (
            <div className="p-3 border-t border-gray-100 shrink-0">
              <button
                onClick={() => navigate('/library')}
                className="w-full btn-secondary text-xs justify-center"
              >
                <Globe className="w-3.5 h-3.5" /> View Library
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
