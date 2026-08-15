// Backend timestamps come from Python's `datetime.now(timezone.utc).isoformat()`,
// which appends an explicit "+00:00" offset, not "Z". Blindly appending "Z"
// whenever a string didn't already end in "Z" turned that into
// "...+00:00Z" — a string every browser's Date parser rejects as invalid,
// producing NaN and "NaN days ago" in relative-date displays.
export function parseUtcDate(dateStr: string): Date {
  const hasTimezone = /(Z|[+-]\d{2}:\d{2})$/.test(dateStr)
  return new Date(hasTimezone ? dateStr : `${dateStr}Z`)
}
