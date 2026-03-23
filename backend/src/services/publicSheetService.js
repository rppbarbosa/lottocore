import { pool } from '../db.js';
import { isReasonablePublicToken } from '../utils/publicToken.js';

/**
 * Dados para a página pública /f/{token} — todas as cartelas da folha, sorteios em modo estático.
 */
export async function getPublicSheetByToken(token) {
  if (!isReasonablePublicToken(token)) {
    const e = new Error('Token inválido');
    e.statusCode = 400;
    throw e;
  }

  const { rows: sheetRows } = await pool.query(
    `SELECT s.id, s.sheet_number, s.public_token, e.name AS event_name
     FROM sheets s
     INNER JOIN events e ON e.id = s.event_id
     WHERE s.public_token = $1 AND s.sale_status <> 'cancelled'`,
    [token],
  );

  if (!sheetRows.length) return null;

  const srow = sheetRows[0];

  const { rows: cardRows } = await pool.query(
    `SELECT c.grid, c.public_token, c.win_status,
            r.id AS round_id, r.round_number, r.status AS round_status
     FROM cards c
     INNER JOIN rounds r ON r.id = c.round_id
     WHERE c.sheet_id = $1
     ORDER BY r.round_number ASC`,
    [srow.id],
  );

  const roundIds = [...new Set(cardRows.map((r) => r.round_id))];
  /** @type {Map<string, number[]>} */
  const drawnByRound = new Map();
  if (roundIds.length) {
    const { rows: drawn } = await pool.query(
      `SELECT round_id, number FROM drawn_numbers
       WHERE round_id = ANY($1::uuid[])
       ORDER BY round_id, draw_order ASC`,
      [roundIds],
    );
    for (const r of drawn) {
      const list = drawnByRound.get(r.round_id) ?? [];
      list.push(r.number);
      drawnByRound.set(r.round_id, list);
    }
  }

  return {
    eventName: srow.event_name,
    sheetNumber: srow.sheet_number,
    publicToken: srow.public_token,
    cards: cardRows.map((row) => ({
      grid: row.grid,
      publicToken: row.public_token,
      winStatus: row.win_status,
      round: {
        id: row.round_id,
        number: row.round_number,
        status: row.round_status,
      },
      drawnNumbers: drawnByRound.get(row.round_id) ?? [],
    })),
  };
}
