import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from './Dashboard'
import { useStore } from '../store/useStore'
import * as apiModule from '../lib/api'
import * as ollamaModule from '../lib/ollama'

const initialState = useStore.getState()

vi.mock('../hooks/useSSE', () => ({
  useSSE: () => ({ startStream: vi.fn(), stopStream: vi.fn() }),
}))

beforeEach(() => {
  useStore.setState(initialState, true)
  vi.spyOn(apiModule.api, 'getSessions').mockResolvedValue([])
})

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  )
}

describe('Dashboard — Model Engine picker', () => {
  it('never shows a fabricated model list when Ollama is unreachable', async () => {
    // Regression test: this used to default to a hardcoded stub
    // ['llama3:8b', 'mistral:7b', 'gemma2:9b'] and only replace it via the
    // backend-mediated api.getModels(), which silently returns that exact
    // same stub whenever the *server* can't reach Ollama (e.g. deployed) —
    // even when the user's own browser can reach it fine. That produced a
    // visible disagreement with Settings' client-side-verified model list,
    // and offered models to pick that might not even exist.
    vi.spyOn(ollamaModule, 'probeOllama').mockResolvedValue({ available: false, models: [] })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/ollama not connected/i)).toBeInTheDocument()
    })
    expect(screen.queryByText('llama3:8b')).not.toBeInTheDocument()
    expect(screen.queryByText('mistral:7b')).not.toBeInTheDocument()
    expect(screen.queryByText('gemma2:9b')).not.toBeInTheDocument()
  })

  it('shows the real, client-verified model list once Ollama is reachable', async () => {
    vi.spyOn(ollamaModule, 'probeOllama').mockResolvedValue({
      available: true,
      models: ['qwen3.5:9b', 'llama3.2:latest'],
    })

    renderDashboard()

    await waitFor(() => {
      expect(useStore.getState().ollamaModels).toEqual(['qwen3.5:9b', 'llama3.2:latest'])
    })
    expect(useStore.getState().ollamaConnected).toBe(true)
    // The selector should adopt a real model as the default rather than
    // keeping whatever placeholder was selected before the probe resolved.
    expect(useStore.getState().selectedModel).toBe('qwen3.5:9b')
  })
})
