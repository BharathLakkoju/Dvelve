import { useCallback } from 'react'
import { useStore } from '../store/useStore'
import { API_BASE } from '../lib/api'

// Module-level, not per-hook-instance: the component that starts a stream
// (Dashboard/Report) is often not the same component instance that needs to
// stop it (Research's "Stop Research" button). A useRef here would only be
// visible to whichever component's useSSE() call created it.
let activeAbortController: AbortController | null = null

export function useSSE() {
  const {
    updateAgentState,
    setSubQuestions,
    setSources,
    appendReportToken,
    setProgress,
    setCriticResult,
    setCurrentAgentMessage,
    setCurrentSessionId,
    setEffectiveOffline,
    setLlmProvider,
    setResearchError,
  } = useStore()

  const handleEvent = (payload: { event: string; data: Record<string, unknown>; session_id: string }) => {
    const { event, data } = payload

    switch (event) {
      case 'status': {
        const agent = data.agent as string
        setCurrentAgentMessage(data.message as string)
        if (typeof data.online === 'boolean') setEffectiveOffline(!data.online)
        if (typeof data.llm_provider === 'string') setLlmProvider(data.llm_provider as 'mock' | 'ollama' | 'openrouter')
        if (agent && agent !== 'system') updateAgentState(agent as keyof ReturnType<typeof useStore.getState>['agentStates'], 'thinking')
        break
      }
      case 'planner': {
        setSubQuestions(data.sub_questions as Parameters<typeof setSubQuestions>[0])
        updateAgentState('planner', 'complete')
        setProgress(20)
        break
      }
      case 'retriever': {
        setSources(data.sources as Parameters<typeof setSources>[0])
        updateAgentState('retriever', 'complete')
        setProgress(45)
        break
      }
      case 'ranker': {
        updateAgentState('ranker', 'complete')
        setProgress(55)
        break
      }
      case 'writer': {
        updateAgentState('writer', 'thinking')
        if (data.token) appendReportToken(data.token as string)
        // Note: cannot pass a function to setProgress (it takes a number)
        // We'll use getState instead
        const cur = useStore.getState().progress
        setProgress(Math.min(90, cur + 0.3))
        break
      }
      case 'critic': {
        updateAgentState('writer', 'complete')
        updateAgentState('critic', 'complete')
        setCriticResult(data as unknown as Parameters<typeof setCriticResult>[0])
        setProgress(100)
        break
      }
      case 'done': {
        // Capture session_id from event data (fallback if header wasn't accessible)
        if (payload.session_id) {
          setCurrentSessionId(payload.session_id)
        }
        // Fetch updated sessions list with auth headers
        const token = useStore.getState().token
        fetch(`${API_BASE}/api/sessions`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
          .then((r) => r.json())
          .then((sessions) => useStore.getState().setSessions(sessions))
          .catch(() => {})
        break
      }
      case 'cancelled': {
        setCurrentAgentMessage('Research cancelled.')
        break
      }
      case 'error': {
        console.error('Research error:', data.message)
        setResearchError((data.message as string) || 'An unexpected error occurred.')
        const failedStage = data.stage as string | undefined
        if (failedStage) {
          updateAgentState(failedStage as keyof ReturnType<typeof useStore.getState>['agentStates'], 'error')
        }
        break
      }
    }
  }

  const startStream = useCallback(
    (query: string, model: string, depth: string, offlineMode: boolean) => {
      // Abort any previous stream
      activeAbortController?.abort()
      const controller = new AbortController()
      activeAbortController = controller

      const token = useStore.getState().token
      // We use POST with fetch + ReadableStream since EventSource doesn't support POST
      fetch(`${API_BASE}/api/research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ query, model, depth, offline_mode: offlineMode }),
        signal: controller.signal,
      }).then(async (response) => {
        const sessionId = response.headers.get('X-Session-Id')
        if (sessionId) {
          setCurrentSessionId(sessionId)
        }

        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        const processChunk = (chunk: string) => {
          buffer += chunk
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const payload = JSON.parse(line.slice(6))
                handleEvent(payload)
              } catch { /* ignore parse errors */ }
            }
          }
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          processChunk(decoder.decode(value, { stream: true }))
        }
      }).catch((err: Error) => {
        if (err.name !== 'AbortError') {
          console.error('SSE fetch error', err)
        }
      })

      return () => controller.abort()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // FIX: Actually cancel the in-flight request — previously "Stop Research"
  // only reset local UI state and navigated away, while the backend pipeline
  // (and the fetch consuming it) kept running to completion in the background.
  const stopStream = useCallback(() => {
    activeAbortController?.abort()
    activeAbortController = null
  }, [])

  return { startStream, stopStream }
}
