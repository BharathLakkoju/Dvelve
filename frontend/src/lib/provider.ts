import type { LlmProvider } from '../store/useStore'

// Shared display metadata for the three possible report-generation backends.
// Kept provider-agnostic of icon components so each page picks its own lucide imports.
export const PROVIDER_LABELS: Record<LlmProvider, string> = {
  mock: 'Offline · Mock Data',
  ollama: 'Offline · Local Ollama',
  openrouter: 'Online · OpenRouter Cloud',
}

export const PROVIDER_TEXT_CLASS: Record<LlmProvider, string> = {
  mock: 'text-amber-600',
  ollama: 'text-emerald-600',
  openrouter: 'text-sky-600',
}

export const PROVIDER_BADGE_CLASS: Record<LlmProvider, string> = {
  mock: 'bg-amber-50 border-amber-100 text-amber-700',
  ollama: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  openrouter: 'bg-sky-50 border-sky-100 text-sky-700',
}

export function isLiveProvider(p?: LlmProvider | null): boolean {
  return p === 'ollama' || p === 'openrouter'
}
