/** Espelha a disposição das cartelas no PDF (`sheetPdfService.js`). */
export const SHEET_LAYOUT_LABELS: Record<number, string> = {
  1: 'Uma cartela centrada.',
  2: 'Duas cartelas, uma ao lado da outra.',
  3: 'Duas em cima e uma centrada em baixo (pirâmide invertida).',
  4: 'Quatro cartelas em grelha 2×2.',
  5: 'Cinco em cruz: cantos e centro, com espaços para imagens/texto entre elas.',
}

export function sheetLayoutDescription(count: number): string {
  return SHEET_LAYOUT_LABELS[count] ?? SHEET_LAYOUT_LABELS[1]
}
