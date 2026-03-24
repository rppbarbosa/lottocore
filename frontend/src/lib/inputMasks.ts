/** Máscaras só para UX; validação real no backend. */

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

/** CEP brasileiro: 00000-000 */
export function formatCepInput(value: string): string {
  const d = digitsOnly(value).slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

/** Telefone BR: (00) 0000-0000 ou (00) 00000-0000 */
export function formatPhoneBrInput(value: string): string {
  const d = digitsOnly(value).slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Permite só dígitos e uma vírgula decimal (até 2 casas). */
export function sanitizeMoneyInput(raw: string): string {
  let s = raw.replace(/[^\d,]/g, '')
  const idx = s.indexOf(',')
  if (idx === -1) return s
  const head = s.slice(0, idx + 1)
  const tail = s
    .slice(idx + 1)
    .replace(/,/g, '')
    .slice(0, 2)
  return head + tail
}

/** Máximo de dígitos no valor em centavos (evita overflow em JS e valores absurdos). */
const MAX_BRL_CENT_DIGITS = 14

/**
 * Extrai só dígitos do input (colar "10.000,00" → "1000000") e normaliza para centavos em string.
 * Cada dígito novo entra à direita, como em terminal de pagamento (1000000 centavos = R$ 10.000,00).
 */
export function normalizeCurrencyCentDigits(raw: string): string {
  let d = digitsOnly(raw).slice(0, MAX_BRL_CENT_DIGITS)
  if (d === '') return ''
  const n = parseInt(d, 10)
  if (!Number.isFinite(n) || n < 0) return ''
  if (n === 0) return '0'
  return String(n)
}

/**
 * Formata string de centavos (só dígitos) para exibição pt-BR: milhares com ponto, decimais com vírgula.
 */
export function formatBRLCentDigitsDisplay(digits: string): string {
  if (!digits) return ''
  const cents = parseInt(digits, 10)
  if (!Number.isFinite(cents) || cents < 0) return ''
  const intPart = Math.floor(cents / 100)
  const dec = cents % 100
  const intFmt = intPart.toLocaleString('pt-BR', { maximumFractionDigits: 0, useGrouping: true })
  const decFmt = String(dec).padStart(2, '0')
  return `${intFmt},${decFmt}`
}

/** Centavos guardados na API → string de dígitos para o estado do input mascarado. */
export function centsToCurrencyDigitString(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(Number(cents))) return ''
  const n = Math.max(0, Math.trunc(Number(cents)))
  return String(n)
}

/** UF: 2 letras maiúsculas */
export function formatUfInput(value: string): string {
  return value
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 2)
    .toUpperCase()
}
