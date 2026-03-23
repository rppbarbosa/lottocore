import { createHash } from 'crypto';

/** Faixas por coluna: B, I, N, G, O */
const COLUMN_RANGES = [
  [1, 15],
  [16, 30],
  [31, 45],
  [46, 60],
  [61, 75],
];

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickDistinct(rangeLow, rangeHigh, count) {
  const pool = [];
  for (let n = rangeLow; n <= rangeHigh; n++) pool.push(n);
  shuffleInPlace(pool);
  return pool.slice(0, count);
}

/**
 * Gera matriz 5x5: centro (linha 2, coluna 2) = null; demais células respeitam BINGO.
 * @returns {Array<Array<number|null>>}
 */
export function generateBingoGrid() {
  const grid = Array.from({ length: 5 }, () => Array(5).fill(null));

  for (let c = 0; c < 5; c++) {
    const [lo, hi] = COLUMN_RANGES[c];
    if (c === 2) {
      const nums = pickDistinct(lo, hi, 4);
      let k = 0;
      for (let r = 0; r < 5; r++) {
        if (r === 2) grid[r][c] = null;
        else grid[r][c] = nums[k++];
      }
    } else {
      const nums = pickDistinct(lo, hi, 5);
      for (let r = 0; r < 5; r++) grid[r][c] = nums[r];
    }
  }

  return grid;
}

/**
 * Identificador estável da combinação (unicidade por rodada no banco).
 */
export function fingerprintFromGrid(grid) {
  const payload = JSON.stringify(grid);
  return createHash('sha256').update(payload).digest('hex');
}
