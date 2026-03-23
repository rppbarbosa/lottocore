/** Interpreta "7-23", "7–23" (travessão) ou um único número "7". */
export function parseSheetRangeInput(raw: string): { from: number; to: number } | null {
  const t = raw.trim().replace(/\u2013/g, '-').replace(/\s+/g, '')
  const pair = /^(\d+)-(\d+)$/.exec(t)
  if (pair) {
    const from = parseInt(pair[1], 10)
    const to = parseInt(pair[2], 10)
    if (from >= 1 && to >= 1) return { from, to }
    return null
  }
  const one = /^(\d+)$/.exec(t)
  if (one) {
    const n = parseInt(one[1], 10)
    if (n >= 1) return { from: n, to: n }
  }
  return null
}
