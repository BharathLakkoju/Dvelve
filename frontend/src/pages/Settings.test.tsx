import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Settings } from './Settings'
import { useStore } from '../store/useStore'
import * as apiModule from '../lib/api'

const initialState = useStore.getState()
const originalFetch = globalThis.fetch

beforeEach(() => {
  useStore.setState(initialState, true)
  useStore.setState({ ollamaUrl: 'http://localhost:11434' })
  vi.spyOn(apiModule.api, 'getSessions').mockResolvedValue([])
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  )
}

describe('Settings — Ollama Test Connection', () => {
  it('tests the Ollama URL directly from the browser, not via the backend', async () => {
    // Regression test: previously this went through POST /api/ollama/test on
    // the backend, which — for a cloud-deployed backend — can only ever
    // reach *its own* localhost, never the user's machine, so it always
    // reported "false" regardless of whether Ollama was actually running.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3:8b' }, { name: 'mistral:7b' }] }),
    } as Response)
    globalThis.fetch = fetchMock

    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }))

    await waitFor(() => {
      expect(screen.getByText(/successfully connected to ollama instance/i)).toBeInTheDocument()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:11434/api/tags')
    expect(options?.method ?? 'GET').not.toBe('POST')
    expect(useStore.getState().ollamaConnected).toBe(true)
  })

  it('reports failure without throwing when Ollama is unreachable', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }))

    await waitFor(() => {
      expect(screen.getByText(/could not connect/i)).toBeInTheDocument()
    })
    expect(useStore.getState().ollamaConnected).toBe(false)
  })

  it('shows inline OLLAMA_ORIGINS troubleshooting with the real origin on failure', async () => {
    // Regression test for the guidance added after a user hit exactly this:
    // Ollama's own origin check (not just standard CORS) returns 403 for an
    // unrecognized origin, and the fix (set OLLAMA_ORIGINS, fully restart
    // Ollama) is non-obvious enough that it needs to be surfaced in the UI,
    // not just docs — with the actual origin value, not a placeholder.
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }))

    await waitFor(() => {
      expect(screen.getByText(/most likely causes/i)).toBeInTheDocument()
    })
    expect(screen.getAllByText(/OLLAMA_ORIGINS/).length).toBeGreaterThan(0)
    // jsdom's default test origin is http://localhost:3000 — the block must
    // reflect the page's *actual* origin, not a hardcoded example.
    expect(screen.getByText((_, node) =>
      node?.textContent === "[System.Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', 'http://localhost:5173,http://localhost:3000', 'User')"
    )).toBeInTheDocument()
  })

  it('does not show the troubleshooting block before a test has run or after success', () => {
    renderSettings()
    expect(screen.queryByText(/most likely causes/i)).not.toBeInTheDocument()
  })
})
