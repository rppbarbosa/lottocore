import { pool } from '../db.js';

/**
 * @param {unknown} grid
 * @returns {Array<Array<number|null>>|null}
 */
function asGridMatrix(grid) {
  if (!Array.isArray(grid) || grid.length !== 5) return null;
  for (const row of grid) {
    if (!Array.isArray(row) || row.length !== 5) return null;
  }
  return grid;
}

/**
 * Cartela cheia: todas as células não livres aparecem nos sorteados.
 * @param {Array<Array<number|null>>} grid
 * @param {Set<number>} drawn
 */
export function isFullCard(grid, drawn) {
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const v = grid[r][c];
      if (v === null || v === undefined) continue;
      if (typeof v !== 'number' || !drawn.has(v)) return false;
    }
  }
  return true;
}

async function drawnNumberSet(roundId) {
  const { rows } = await pool.query(
    `SELECT number FROM drawn_numbers WHERE round_id = $1`,
    [roundId]
  );
  return new Set(rows.map((r) => r.number));
}

async function getRoundEventMeta(roundId) {
  const { rows } = await pool.query(
    `SELECT id, event_id, round_number FROM rounds WHERE id = $1`,
    [roundId]
  );
  return rows[0] ?? null;
}

/**
 * Marca cartelas vendidas com cartela cheia como `suggested`.
 * Ignora `dismissed` e `confirmed`; só atua em `none`.
 * @returns {Promise<{ eventId: string, roundId: string, roundNumber: number, winners: object[] }>}
 */
export async function evaluateRoundForWinners(roundId) {
  const meta = await getRoundEventMeta(roundId);
  if (!meta) {
    const e = new Error('Rodada não encontrada');
    e.statusCode = 404;
    throw e;
  }

  const drawn = await drawnNumberSet(roundId);

  const { rows: candidates } = await pool.query(
    `SELECT c.id, c.public_token, c.grid, c.win_status, s.id AS sheet_id, s.sheet_number
     FROM cards c
     INNER JOIN sheets s ON s.id = c.sheet_id
     WHERE c.round_id = $1
       AND s.sale_status = 'sold'
       AND c.win_status = 'none'`,
    [roundId]
  );

  const toSuggest = [];
  for (const row of candidates) {
    const grid = asGridMatrix(row.grid);
    if (!grid) continue;
    if (isFullCard(grid, drawn)) toSuggest.push(row.id);
  }

  if (!toSuggest.length) {
    return {
      eventId: meta.event_id,
      roundId: meta.id,
      roundNumber: meta.round_number,
      winners: [],
    };
  }

  const { rows: updated } = await pool.query(
    `UPDATE cards
     SET win_status = 'suggested', win_suggested_at = NOW()
     WHERE id = ANY($1::uuid[]) AND win_status = 'none'
     RETURNING id, public_token, sheet_id, win_status, win_suggested_at`,
    [toSuggest]
  );

  const sheetIds = [...new Set(updated.map((u) => u.sheet_id))];
  const { rows: sheets } = await pool.query(
    `SELECT id, sheet_number FROM sheets WHERE id = ANY($1::uuid[])`,
    [sheetIds]
  );
  const sheetMap = Object.fromEntries(sheets.map((s) => [s.id, s.sheet_number]));

  const winners = updated.map((u) => ({
    cardId: u.id,
    publicToken: u.public_token,
    sheetId: u.sheet_id,
    sheetNumber: sheetMap[u.sheet_id],
    phase: 'suggested',
    suggestedAt: u.win_suggested_at,
  }));

  return {
    eventId: meta.event_id,
    roundId: meta.id,
    roundNumber: meta.round_number,
    winners,
  };
}

/**
 * Após desfazer sorteio: remove sugestão se a cartela deixou de estar cheia.
 */
export async function reconcileSuggestedAfterUndo(roundId) {
  const meta = await getRoundEventMeta(roundId);
  if (!meta) return { eventId: null, roundId, roundNumber: null, cleared: [] };

  const drawn = await drawnNumberSet(roundId);

  const { rows: suggested } = await pool.query(
    `SELECT c.id, c.public_token, c.grid, s.id AS sheet_id, s.sheet_number
     FROM cards c
     INNER JOIN sheets s ON s.id = c.sheet_id
     WHERE c.round_id = $1 AND c.win_status = 'suggested'`,
    [roundId]
  );

  const toClear = [];
  for (const row of suggested) {
    const grid = asGridMatrix(row.grid);
    if (!grid || !isFullCard(grid, drawn)) toClear.push(row.id);
  }

  if (!toClear.length) {
    return {
      eventId: meta.event_id,
      roundId: meta.id,
      roundNumber: meta.round_number,
      cleared: [],
    };
  }

  await pool.query(
    `UPDATE cards
     SET win_status = 'none', win_suggested_at = NULL
     WHERE id = ANY($1::uuid[])`,
    [toClear]
  );

  const cleared = suggested
    .filter((r) => toClear.includes(r.id))
    .map((r) => ({
      cardId: r.id,
      publicToken: r.public_token,
      sheetId: r.sheet_id,
      sheetNumber: r.sheet_number,
      phase: 'cleared',
    }));

  return {
    eventId: meta.event_id,
    roundId: meta.id,
    roundNumber: meta.round_number,
    cleared,
  };
}

export async function getCardById(cardId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.round_id, c.sheet_id, c.public_token, c.grid, c.win_status,
            c.win_suggested_at, c.win_confirmed_at, c.win_dismissed_at,
            r.event_id, r.round_number, s.sheet_number, s.sale_status
     FROM cards c
     INNER JOIN rounds r ON r.id = c.round_id
     INNER JOIN sheets s ON s.id = c.sheet_id
     WHERE c.id = $1`,
    [cardId]
  );
  return rows[0] ?? null;
}

export async function confirmWin(cardId) {
  const { rows } = await pool.query(
    `UPDATE cards c
     SET win_status = 'confirmed', win_confirmed_at = NOW()
     FROM rounds r
     INNER JOIN sheets s ON s.id = c.sheet_id AND r.id = c.round_id
     WHERE c.id = $1 AND c.win_status = 'suggested'
     RETURNING c.id, c.public_token, c.sheet_id, s.sheet_number, r.event_id, r.id AS round_id, r.round_number, c.win_confirmed_at`,
    [cardId]
  );
  if (!rows.length) {
    const e = new Error('Cartela não encontrada ou não está aguardando confirmação');
    e.statusCode = 400;
    throw e;
  }
  return rows[0];
}

export async function dismissWin(cardId) {
  const { rows } = await pool.query(
    `UPDATE cards c
     SET win_status = 'dismissed', win_dismissed_at = NOW()
     FROM rounds r
     INNER JOIN sheets s ON s.id = c.sheet_id AND r.id = c.round_id
     WHERE c.id = $1 AND c.win_status = 'suggested'
     RETURNING c.id, c.public_token, c.sheet_id, s.sheet_number, r.event_id, r.id AS round_id, r.round_number, c.win_dismissed_at`,
    [cardId]
  );
  if (!rows.length) {
    const e = new Error('Cartela não encontrada ou não está aguardando confirmação');
    e.statusCode = 400;
    throw e;
  }
  return rows[0];
}

export async function listWinnersForRound(roundId) {
  const { rows } = await pool.query(
    `SELECT c.id AS card_id, c.public_token, c.win_status, c.win_suggested_at, c.win_confirmed_at, c.win_dismissed_at,
            s.id AS sheet_id, s.sheet_number, s.sale_status
     FROM cards c
     INNER JOIN sheets s ON s.id = c.sheet_id
     WHERE c.round_id = $1 AND c.win_status <> 'none'
     ORDER BY c.win_suggested_at NULLS LAST, c.id`,
    [roundId]
  );
  return rows;
}
