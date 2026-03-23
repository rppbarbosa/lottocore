/** Formatação em BRL para valores guardados em centavos (inteiro). */
export function formatBRLFromCents(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(Number(cents))) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents) / 100)
}

/** "12,50" ou "12.5" → centavos; vazio → null */
export function parseReaisToCents(s: string): number | null {
  const t = s.trim().replace(/\s/g, '')
  if (!t) return null
  const n = Number.parseFloat(t.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

/** Centavos → string com vírgula para input (ex.: 1250 → "12,50") */
export function centsToReaisInput(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(Number(cents))) return ''
  return (Number(cents) / 100).toFixed(2).replace('.', ',')
}
