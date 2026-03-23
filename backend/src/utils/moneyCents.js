/**
 * Converte entrada monetária (número inteiro em centavos ou string "12,34") em centavos.
 * @param {unknown} input
 * @param {{ allowUndefined?: boolean }} [opts]
 * @returns {number|undefined|null} undefined = omitir campo; null = inválido (quando allowUndefined false)
 */
export function parseMoneyCents(input, opts = {}) {
  const { allowUndefined = true } = opts;
  if (input === undefined || input === null || input === '') {
    return allowUndefined ? undefined : null;
  }
  if (typeof input === 'number' && Number.isInteger(input) && input >= 0) {
    return input;
  }
  const s = String(input).trim().replace(/\s/g, '').replace(',', '.');
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return Math.round(n * 100);
}
