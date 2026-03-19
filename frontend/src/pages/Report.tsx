import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  FileText, Download, Share2, Bookmark,
  ExternalLink, MessageSquare, Zap, Clock,
  Globe, ChevronRight, ArrowLeft, Telescope, Layers
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { useSSE } from '../hooks/useSSE'
import { api } from '../lib/api'
import clsx from 'clsx'

export function Report() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    reportMarkdown, sources, criticResult, sessions,
    startResearch, selectedModel, depth, offlineMode,
  } = useStore()
  const { startStream } = useSSE()

  const [session, setSession] = useState<any>(null)
  const [report, setReport] = useState<string>('')
  const [sourcesData, setSourcesData] = useState<any[]>([])
  const [activeSection, setActiveSection] = useState<string>('')
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [selectionPopup, setSelectionPopup] = useState<{ text: string; x: number; y: number } | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const selectionRangeRef = useRef<Range | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (id) {
      // Try store first (just finished), then fetch from API
      if (reportMarkdown && sources.length > 0) {
        setReport(reportMarkdown)
        setSourcesData(sources)
        const found = sessions.find(s => s.id === id)
        setSession(found || null)
      } else {
        api.getSession(id).then((s) => {
          if (s) {
            setSession(s)
            setReport(s.report_markdown || '')
            setSourcesData(s.sources || [])
          }
        })
      }
    }
  }, [id])

  // Extract headings for ToC
  const headings = report
    .split('\n')
    .filter(line => line.startsWith('## ') || line.startsWith('# '))
    .map(line => ({
      text: line.replace(/^#+\s/, ''),
      level: line.startsWith('## ') ? 2 : 1,
      anchor: line.replace(/^#+\s/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    }))

  // Text-selection deep-dive feature
  const handleMouseUp = () => {
    const selection = window.getSelection()
    const text = selection?.toString().trim() ?? ''
    if (text.length >= 10) {
      const range = selection!.getRangeAt(0)
      selectionRangeRef.current = range.cloneRange()
      const rect = range.getBoundingClientRect()
      setSelectionPopup({ text, x: rect.left + rect.width / 2, y: rect.top })
    } else if (!text) {
      selectionRangeRef.current = null
      setSelectionPopup(null)
    }
  }

  const handleDeepDive = (type: 'deep' | 'sub') => {
    if (!selectionPopup) return
    const query = type === 'deep'
      ? `Deep dive into: ${selectionPopup.text}`
      : `Sub-report on: ${selectionPopup.text}`
    setSelectionPopup(null)
    window.getSelection()?.removeAllRanges()
    startResearch(query)
    startStream(query, selectedModel, depth, offlineMode)
    navigate('/research')
  }

  useEffect(() => {
    const dismiss = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setSelectionPopup(null)
      }
    }
    document.addEventListener('mousedown', dismiss)
    return () => document.removeEventListener('mousedown', dismiss)
  }, [])

  // Reposition popup when the scroll container scrolls
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const onScroll = () => {
      if (!selectionRangeRef.current) return
      const rect = selectionRangeRef.current.getBoundingClientRect()
      setSelectionPopup(prev =>
        prev ? { ...prev, x: rect.left + rect.width / 2, y: rect.top } : null
      )
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [])

  const handleExportMD = () => {
    if (!id) return
    window.open(api.exportMarkdownUrl(id), '_blank')
  }

  const handleExportPDF = async () => {
    if (!id) return
    setIsExportingPdf(true)
    window.open(api.exportPdfUrl(id), '_blank')
    setTimeout(() => setIsExportingPdf(false), 2000)
  }

  const wordCount = report.split(/\s+/).filter(Boolean).length
  const readTime = Math.max(1, Math.ceil(wordCount / 200))

  if (!report && !id) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500">No report found</p>
          <button onClick={() => navigate('/')} className="btn-primary mt-4">Start Research</button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-56px)] flex overflow-hidden">
      {/* Left – Table of Contents */}
      <div className="w-64 border-r border-gray-100 bg-white flex flex-col overflow-hidden shrink-0">
        <div className="px-4 py-3 border-b border-gray-100">
          <button
            onClick={() => navigate('/library')}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> All Reports
          </button>
          <p className="section-label">Contents</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {headings.map((h, i) => (
            <button
              key={i}
              onClick={() => {
                setActiveSection(h.anchor)
                document.getElementById(h.anchor)?.scrollIntoView({ behavior: 'smooth' })
              }}
              className={clsx(
                'w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all hover:bg-gray-50',
                h.level === 1 ? 'font-semibold text-gray-800' : 'pl-5 text-gray-600',
                activeSection === h.anchor ? 'bg-primary-50 text-primary-700 font-medium' : ''
              )}
            >
              {h.text}
            </button>
          ))}

          {headings.length === 0 && (
            <div className="text-center py-6">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
                <FileText className="w-5 h-5 text-gray-300" />
              </div>
              <p className="text-xs text-gray-400">Loading contents…</p>
            </div>
          )}

          {/* PRO TIP */}
          <div className="mt-4 mx-0 p-3 bg-primary-50 rounded-xl border border-primary-100">
            <p className="text-xs font-semibold text-primary-700 mb-1">PRO TIP</p>
            <p className="text-xs text-primary-600">You can highlight any text to generate a specific sub-report or deep dive.</p>
          </div>
        </div>
      </div>

      {/* Center – Report content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-2xl mx-auto px-8 py-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-6">
            <span>Projects</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-600 font-medium">{session?.query?.slice(0, 30) || 'Research Report'}</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-4">
            {session?.query || 'Research Report'}
          </h1>

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-gray-400 mb-8 pb-6 border-b border-gray-100">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {new Date(session?.created_at || Date.now()).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              {sourcesData.length} Sources Cited
            </span>
            <span className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              {readTime} min read
            </span>
          </div>

          {/* Report markdown */}
          {report ? (
            <div className="report-content" onMouseUp={handleMouseUp}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children, ...props }) => {
                    const id = String(children).toLowerCase().replace(/[^a-z0-9]+/g, '-')
                    return <h1 id={id} {...props}>{children}</h1>
                  },
                  h2: ({ children, ...props }) => {
                    const id = String(children).toLowerCase().replace(/[^a-z0-9]+/g, '-')
                    return <h2 id={id} {...props}>{children}</h2>
                  },
                  h3: ({ children, ...props }) => {
                    const id = String(children).toLowerCase().replace(/[^a-z0-9]+/g, '-')
                    return <h3 id={id} {...props}>{children}</h3>
                  },
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 underline underline-offset-2">
                      {children}
                    </a>
                  ),
                }}
              >
                {report
                  .replace(/^#\s+[^\n]*\n?/, '')
                  .replace(/^\*Generated by[^\n]*\*\n?/m, '')
                  .trimStart()}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className={clsx('shimmer-bg rounded-lg h-4', i % 3 === 0 ? 'h-6 w-1/2' : 'w-full')} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right – Sources & Quality */}
      <div className="w-64 border-l border-gray-100 bg-white flex flex-col overflow-hidden shrink-0">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
          <p className="section-label">Sources</p>
          <button className="text-xs text-primary-600 font-medium hover:underline" onClick={() => navigate('/library')}>
            View All
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {sourcesData.map((source) => (
            <a
              key={source.id}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-xl border border-gray-100 hover:border-primary-100 hover:bg-primary-50/30 transition-all group"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                  [{source.id}]
                </span>
                <span className="text-xs text-gray-400 truncate">{source.date?.slice(0, 7) || '2024'}</span>
              </div>
              <p className="text-xs font-semibold text-gray-800 line-clamp-2 mb-1 group-hover:text-primary-700">
                "{source.title}"
              </p>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Globe className="w-3 h-3" />
                <span className="truncate">{source.domain}</span>
                <ExternalLink className="w-3 h-3 ml-auto shrink-0 opacity-0 group-hover:opacity-100" />
              </div>
            </a>
          ))}
        </div>

        {/* Critic score */}
        {criticResult && (
          <div className="mx-3 mb-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100 shrink-0">
            <p className="text-xs font-semibold text-emerald-700 mb-1">Quality Score</p>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-emerald-600">{criticResult.quality_score}</div>
              <div className="text-xs text-emerald-500">/10</div>
            </div>
          </div>
        )}

        {/* Export buttons */}
        <div className="p-3 border-t border-gray-100 shrink-0 space-y-2">
          <button onClick={handleExportMD} className="btn-secondary w-full text-xs justify-center">
            <Download className="w-3.5 h-3.5" /> Markdown
          </button>
          <button onClick={handleExportPDF} disabled={isExportingPdf} className="btn-primary w-full text-xs justify-center">
            <Download className="w-3.5 h-3.5" />
            {isExportingPdf ? 'Generating…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Bottom action bar (follow-up) */}
      <div className="fixed bottom-0 left-64 right-64 bg-white border-t border-gray-100 px-6 py-3 flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-surface-50">
          <MessageSquare className="w-4 h-4 text-gray-400" />
          <input
            className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder:text-gray-400"
            placeholder="Ask follow-up questions about this report…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                const q = e.currentTarget.value.trim()
                e.currentTarget.value = ''
                useStore.getState().startResearch(q)
                navigate('/research')
              }
            }}
          />
        </div>
        <button className="btn-primary text-sm">
          <Zap className="w-4 h-4" /> Generate Deep-dive
        </button>
        <button className="btn-secondary text-sm" onClick={handleExportMD}>
          <Share2 className="w-4 h-4" />
        </button>
        <button className="btn-ghost text-sm">
          <Bookmark className="w-4 h-4" />
        </button>
      </div>

      {/* Text-selection popup */}
      {selectionPopup && (
        <div
          ref={popupRef}
          style={{
            position: 'fixed',
            left: selectionPopup.x,
            top: selectionPopup.y - 8,
            transform: 'translate(-50%, -100%)',
            zIndex: 50,
          }}
          className="bg-gray-900 text-white rounded-xl shadow-2xl px-1 py-1 flex items-center gap-0.5 animate-fade-in"
        >
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleDeepDive('deep')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors text-xs whitespace-nowrap"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            Deep Dive
          </button>
          <div className="w-px h-4 bg-gray-700 shrink-0" />
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleDeepDive('sub')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors text-xs whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            Sub-Report
          </button>
          {/* Arrow */}
          <div
            style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)' }}
            className="w-2.5 h-2.5 bg-gray-900 rotate-45 rounded-sm"
          />
        </div>
      )}
    </div>
  )
}
