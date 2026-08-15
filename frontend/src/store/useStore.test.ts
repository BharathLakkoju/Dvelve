import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'

const initialState = useStore.getState()

beforeEach(() => {
  useStore.setState(initialState, true)
})

describe('logout', () => {
  it('clears auth state and session-scoped data, but leaves preferences alone', () => {
    useStore.setState({
      user: { id: '1', email: 'a@b.com', username: 'a', created_at: '2026-01-01' },
      token: 'sometoken',
      sessions: [{ id: 's1', query: 'q', model: 'm', depth: 'quick', status: 'complete', created_at: '2026-01-01', source_count: 0 }],
      currentSessionId: 's1',
      offlineMode: false,
      selectedModel: 'llama3:8b',
    })

    useStore.getState().logout()

    const s = useStore.getState()
    expect(s.user).toBeNull()
    expect(s.token).toBeNull()
    expect(s.sessions).toEqual([])
    expect(s.currentSessionId).toBeNull()
    // Preferences are not auth state and should survive logout.
    expect(s.offlineMode).toBe(false)
    expect(s.selectedModel).toBe('llama3:8b')
  })
})

describe('startResearch / resetResearch', () => {
  it('startResearch seeds a fresh in-progress state for the given query', () => {
    useStore.getState().startResearch('what is quantum computing')
    const s = useStore.getState()
    expect(s.currentQuery).toBe('what is quantum computing')
    expect(s.isResearching).toBe(true)
    expect(s.progress).toBe(0)
    expect(s.researchError).toBeNull()
    expect(s.agentStates).toEqual({
      planner: 'idle', retriever: 'idle', ranker: 'idle', writer: 'idle', critic: 'idle',
    })
  })

  it('resetResearch clears the in-progress run without touching auth/preferences', () => {
    useStore.setState({ token: 'sometoken', offlineMode: true })
    useStore.getState().startResearch('a query')
    useStore.getState().appendReportToken('partial report text')
    useStore.getState().setProgress(42)

    useStore.getState().resetResearch()

    const s = useStore.getState()
    expect(s.currentQuery).toBe('')
    expect(s.reportMarkdown).toBe('')
    expect(s.progress).toBe(0)
    expect(s.isResearching).toBe(false)
    expect(s.currentSessionId).toBeNull()
    // Unrelated state must survive a reset.
    expect(s.token).toBe('sometoken')
    expect(s.offlineMode).toBe(true)
  })
})

describe('updateAgentState', () => {
  it('updates only the targeted agent', () => {
    useStore.getState().updateAgentState('writer', 'thinking')
    const s = useStore.getState()
    expect(s.agentStates.writer).toBe('thinking')
    expect(s.agentStates.planner).toBe('idle')
  })
})

describe('appendReportToken', () => {
  it('appends tokens onto the existing report markdown', () => {
    useStore.getState().setReportMarkdown('Hello')
    useStore.getState().appendReportToken(', world')
    expect(useStore.getState().reportMarkdown).toBe('Hello, world')
  })
})
