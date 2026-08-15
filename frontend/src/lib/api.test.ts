import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { extractErrorMessage, api } from './api'
import { useStore } from '../store/useStore'

describe('extractErrorMessage', () => {
  it('passes through a plain string detail unchanged', () => {
    expect(extractErrorMessage('Email already registered')).toBe('Email already registered')
  })

  it('joins Pydantic validation-error objects into a readable message', () => {
    // Regression test: FastAPI 422s return `detail` as an array of
    // {loc, msg, type} objects — new Error(detail) on that array used to
    // stringify to the literal text "[object Object],[object Object]".
    const detail = [
      { loc: ['body', 'username'], msg: 'String should match pattern', type: 'string_pattern_mismatch' },
      { loc: ['body', 'password'], msg: 'String should have at least 8 characters', type: 'string_too_short' },
    ]
    expect(extractErrorMessage(detail)).toBe(
      'String should match pattern, String should have at least 8 characters'
    )
  })

  it('falls back to a generic message for an empty or unrecognized shape', () => {
    expect(extractErrorMessage(undefined)).toBe('Request failed')
    expect(extractErrorMessage(null)).toBe('Request failed')
    expect(extractErrorMessage([])).toBe('Request failed')
    expect(extractErrorMessage(42)).toBe('Request failed')
  })
})

describe('api error handling', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    useStore.setState({ token: null })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('surfaces the joined validation message when signup returns a 422', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        detail: [{ loc: ['body', 'email'], msg: 'value is not a valid email address', type: 'value_error' }],
      }),
    } as Response)

    await expect(api.signup('user', 'not-an-email', 'password123')).rejects.toThrow(
      'value is not a valid email address'
    )
  })

  it('surfaces a plain-string detail unchanged (e.g. duplicate email)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'Email already registered' }),
    } as Response)

    await expect(api.signin('taken@example.com', 'password123')).rejects.toThrow('Email already registered')
  })
})
