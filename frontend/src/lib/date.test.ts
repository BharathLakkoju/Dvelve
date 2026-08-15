import { describe, it, expect } from 'vitest'
import { parseUtcDate } from './date'

describe('parseUtcDate', () => {
  it('parses a Python-style ISO string with an explicit +00:00 offset', () => {
    // Regression test: datetime.now(timezone.utc).isoformat() in the backend
    // produces this shape — previously the frontend blindly appended "Z"
    // whenever a string didn't already end in "Z", turning this into the
    // unparseable "...+00:00Z" and producing "NaN days ago" everywhere.
    const d = parseUtcDate('2026-08-15T19:42:13.545123+00:00')
    expect(Number.isNaN(d.getTime())).toBe(false)
    expect(d.toISOString()).toBe('2026-08-15T19:42:13.545Z')
  })

  it('parses a string that already ends in Z without double-appending it', () => {
    const d = parseUtcDate('2026-08-15T19:42:13.545Z')
    expect(Number.isNaN(d.getTime())).toBe(false)
    expect(d.toISOString()).toBe('2026-08-15T19:42:13.545Z')
  })

  it('appends Z to a truly naive (no timezone info) string', () => {
    const d = parseUtcDate('2026-08-15T19:42:13.545')
    expect(Number.isNaN(d.getTime())).toBe(false)
    expect(d.toISOString()).toBe('2026-08-15T19:42:13.545Z')
  })

  it('parses a non-UTC explicit offset unchanged', () => {
    const d = parseUtcDate('2026-08-15T19:42:13-05:00')
    expect(Number.isNaN(d.getTime())).toBe(false)
    expect(d.toISOString()).toBe('2026-08-16T00:42:13.000Z')
  })
})
