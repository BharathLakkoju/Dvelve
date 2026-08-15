import { describe, it, expect } from 'vitest'
import { PROVIDER_LABELS, PROVIDER_TEXT_CLASS, PROVIDER_BADGE_CLASS, isLiveProvider } from './provider'
import type { LlmProvider } from '../store/useStore'

const PROVIDERS: LlmProvider[] = ['mock', 'ollama', 'openrouter']

describe('provider display metadata', () => {
  it('defines a label, text class, and badge class for every provider', () => {
    for (const p of PROVIDERS) {
      expect(PROVIDER_LABELS[p]).toBeTruthy()
      expect(PROVIDER_TEXT_CLASS[p]).toBeTruthy()
      expect(PROVIDER_BADGE_CLASS[p]).toBeTruthy()
    }
  })

  it('never puts the word "mock" in the openrouter label (mandatory: no model/mode leakage for cloud runs)', () => {
    expect(PROVIDER_LABELS.openrouter.toLowerCase()).not.toContain('mock')
  })
})

describe('isLiveProvider', () => {
  it('treats ollama and openrouter as live', () => {
    expect(isLiveProvider('ollama')).toBe(true)
    expect(isLiveProvider('openrouter')).toBe(true)
  })

  it('treats mock and null/undefined as not live', () => {
    expect(isLiveProvider('mock')).toBe(false)
    expect(isLiveProvider(null)).toBe(false)
    expect(isLiveProvider(undefined)).toBe(false)
  })
})
