import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Research } from './Research'
import { useStore } from '../store/useStore'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

const stopStreamMock = vi.fn()
vi.mock('../hooks/useSSE', () => ({
  useSSE: () => ({ startStream: vi.fn(), stopStream: stopStreamMock }),
}))

const initialState = useStore.getState()

beforeEach(() => {
  useStore.setState(initialState, true)
  navigateMock.mockClear()
  stopStreamMock.mockClear()
})

function renderResearch() {
  return render(
    <MemoryRouter>
      <Research />
    </MemoryRouter>
  )
}

describe('Research page — Stop Research', () => {
  it('navigates to /dashboard, not the public landing page, when stopped', () => {
    // Regression test: handleStop previously called navigate('/'), which is
    // the public marketing Landing page (always shows "Sign In / Get
    // Started" regardless of auth state) — from the user's perspective this
    // looked exactly like being logged out, even though the session was
    // still valid.
    useStore.getState().startResearch('a research query in progress')
    renderResearch()

    fireEvent.click(screen.getByRole('button', { name: /stop research/i }))

    expect(navigateMock).toHaveBeenCalledWith('/dashboard')
    expect(navigateMock).not.toHaveBeenCalledWith('/')
  })

  it('actually aborts the in-flight stream, not just local UI state', () => {
    // Regression test: stopping previously only called resetResearch() and
    // navigated away — the backend pipeline (and the fetch consuming it)
    // kept running to completion in the background. stopStream() must be
    // called so the underlying fetch is genuinely aborted.
    useStore.getState().startResearch('a research query in progress')
    renderResearch()

    fireEvent.click(screen.getByRole('button', { name: /stop research/i }))

    expect(stopStreamMock).toHaveBeenCalledTimes(1)
  })

  it('resets the in-progress research state on stop', () => {
    useStore.getState().startResearch('a research query in progress')
    useStore.getState().setProgress(55)
    renderResearch()

    fireEvent.click(screen.getByRole('button', { name: /stop research/i }))

    expect(useStore.getState().isResearching).toBe(false)
    expect(useStore.getState().progress).toBe(0)
  })

  it('redirects to /dashboard on mount if there is no active query', () => {
    // currentQuery stays '' (default state) — simulates navigating directly
    // to /research with nothing in progress.
    renderResearch()
    expect(navigateMock).toHaveBeenCalledWith('/dashboard')
  })
})
