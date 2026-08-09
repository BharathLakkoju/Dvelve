import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface User {
  id: string
  email: string
  username: string
  created_at: string
}

export interface SubQuestion {
  id: number
  question: string
  search_query: string
}

export interface Source {
  id: number
  title: string
  url: string
  domain: string
  snippet: string
  content: string
  relevance_score: number
  date?: string
}

export interface Session {
  id: string
  query: string
  model: string
  depth: string
  status: string
  created_at: string
  completed_at?: string
  source_count: number
  critic_score?: number
  offline_mode?: boolean | null
  llm_provider?: LlmProvider | null
}

// Which backend actually generated + reviewed a report.
export type LlmProvider = 'mock' | 'ollama' | 'openrouter'

export interface CriticResult {
  quality_score: number
  strengths: string[]
  suggestions: string[]
  citation_count: number
}

export type AgentStatus = 'idle' | 'thinking' | 'complete' | 'error'

export interface AgentState {
  planner: AgentStatus
  retriever: AgentStatus
  ranker: AgentStatus
  writer: AgentStatus
  critic: AgentStatus
}

interface AppState {
  // Auth
  user: User | null
  token: string | null

  // Settings
  selectedModel: string
  depth: 'quick' | 'standard' | 'deep'
  offlineMode: boolean
  ollamaUrl: string
  ollamaConnected: boolean

  // Research in progress
  currentSessionId: string | null
  currentQuery: string
  subQuestions: SubQuestion[]
  sources: Source[]
  reportMarkdown: string
  agentStates: AgentState
  currentAgentMessage: string
  progress: number // 0-100
  isResearching: boolean
  // The ACTUAL mode used for the in-progress/last run, confirmed by the backend
  // (may differ from the `offlineMode` setting if Ollama wasn't reachable).
  // null until the backend's first status event arrives.
  effectiveOffline: boolean | null
  // Which backend is actually generating this run's report: "mock" | "ollama"
  // | "openrouter". null until the backend's first status event arrives.
  llmProvider: LlmProvider | null
  researchError: string | null

  // Critic result
  criticResult: CriticResult | null

  // Session history
  sessions: Session[]

  // Actions
  setModel: (model: string) => void
  setDepth: (depth: 'quick' | 'standard' | 'deep') => void
  setOfflineMode: (v: boolean) => void
  setOllamaUrl: (url: string) => void
  setOllamaConnected: (v: boolean) => void
  startResearch: (query: string) => void
  resetResearch: () => void
  updateAgentState: (agent: keyof AgentState, status: AgentStatus) => void
  setCurrentAgentMessage: (msg: string) => void
  setEffectiveOffline: (v: boolean) => void
  setLlmProvider: (p: LlmProvider) => void
  setResearchError: (msg: string | null) => void
  setSubQuestions: (sqs: SubQuestion[]) => void
  setSources: (sources: Source[]) => void
  appendReportToken: (token: string) => void
  setReportMarkdown: (md: string) => void
  setProgress: (p: number) => void
  setCriticResult: (r: CriticResult) => void
  setCurrentSessionId: (id: string) => void
  setSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void

  // Auth actions
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  logout: () => void
}

const DEFAULT_AGENT_STATES: AgentState = {
  planner: 'idle',
  retriever: 'idle',
  ranker: 'idle',
  writer: 'idle',
  critic: 'idle',
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Auth
      user: null,
      token: null,

      selectedModel: 'llama3:8b',
      depth: 'standard',
      offlineMode: true,
      ollamaUrl: 'http://localhost:11434',
      ollamaConnected: false,

      currentSessionId: null,
      currentQuery: '',
      subQuestions: [],
      sources: [],
      reportMarkdown: '',
      agentStates: { ...DEFAULT_AGENT_STATES },
      currentAgentMessage: '',
      progress: 0,
      isResearching: false,
      effectiveOffline: null,
      llmProvider: null,
      researchError: null,
      criticResult: null,
      sessions: [],

      setModel: (model) => set({ selectedModel: model }),
      setDepth: (depth) => set({ depth }),
      setOfflineMode: (v) => set({ offlineMode: v }),
      setOllamaUrl: (url) => set({ ollamaUrl: url }),
      setOllamaConnected: (v) => set({ ollamaConnected: v }),

      startResearch: (query) => set({
        currentQuery: query,
        subQuestions: [],
        sources: [],
        reportMarkdown: '',
        agentStates: { ...DEFAULT_AGENT_STATES },
        currentAgentMessage: '',
        progress: 0,
        isResearching: true,
        effectiveOffline: null,
        llmProvider: null,
        researchError: null,
        criticResult: null,
        currentSessionId: null,
      }),

      resetResearch: () => set({
        currentQuery: '',
        subQuestions: [],
        sources: [],
        reportMarkdown: '',
        agentStates: { ...DEFAULT_AGENT_STATES },
        currentAgentMessage: '',
        progress: 0,
        isResearching: false,
        effectiveOffline: null,
        llmProvider: null,
        researchError: null,
        criticResult: null,
        currentSessionId: null,
      }),

      updateAgentState: (agent, status) =>
        set((s) => ({ agentStates: { ...s.agentStates, [agent]: status } })),

      setCurrentAgentMessage: (msg) => set({ currentAgentMessage: msg }),
      setEffectiveOffline: (v) => set({ effectiveOffline: v }),
      setLlmProvider: (p) => set({ llmProvider: p }),
      setResearchError: (msg) => set({ researchError: msg, isResearching: false }),
      setSubQuestions: (subQuestions) => set({ subQuestions }),
      setSources: (sources) => set({ sources }),
      appendReportToken: (token) =>
        set((s) => ({ reportMarkdown: s.reportMarkdown + token })),
      setReportMarkdown: (reportMarkdown) => set({ reportMarkdown }),
      setProgress: (progress) => set({ progress }),
      setCriticResult: (criticResult) => set({ criticResult }),
      setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),
      setSessions: (sessions) => set({ sessions }),
      addSession: (session) =>
        set((s) => ({ sessions: [session, ...s.sessions] })),

      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      logout: () => set({ user: null, token: null, sessions: [], currentSessionId: null }),
    }),
    {
      name: 'research-agent-storage',
      // FIX: Use sessionStorage instead of the default localStorage so the JWT
      // token is not persisted to disk and is only available for the current
      // browser session. This limits the exposure window if an XSS attack occurs.
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        selectedModel: state.selectedModel,
        depth: state.depth,
        offlineMode: state.offlineMode,
        ollamaUrl: state.ollamaUrl,
        user: state.user,
        token: state.token,
      }),
    }
  )
)
