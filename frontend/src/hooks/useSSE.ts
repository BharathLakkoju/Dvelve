import { useRef, useCallback } from 'react'
import { useStore } from '../store/useStore'

const API_BASE = 'http://localhost:8000'

export function useSSE() {
  const abortRef = useRef<AbortController | null>(null)
  const {
    updateAgentState,
    setSubQuestions,
    setSources,
    appendReportToken,
    setProgress,
    setCriticResult,
    setCurrentAgentMessage,
    setCurrentSessionId,
  } = useStore()

  const startStream = useCallback(
    (query: string, model: string, depth: string, offlineMode: boolean) => {
      // Abort any previous stream
      if (abortRef.current) {
        abortRef.current.abort()
      }
      const controller = new AbortController()
      abortRef.current = controller

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

  const handleEvent = (payload: { event: string; data: Record<string, unknown>; session_id: string }) => {
    const { event, data } = payload

    switch (event) {
      case 'status': {
        const agent = data.agent as string
        setCurrentAgentMessage(data.message as string)
        if (agent) updateAgentState(agent as keyof ReturnType<typeof useStore.getState>['agentStates'], 'thinking')
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
        // Fetch updated sessions list
        fetch('http://localhost:8000/api/sessions')
          .then((r) => r.json())
          .then((sessions) => useStore.getState().setSessions(sessions))
          .catch(() => {})
        break
      }
      case 'error': {
        console.error('Research error:', data.message)
        break
      }
    }
  }

  return { startStream }
}
