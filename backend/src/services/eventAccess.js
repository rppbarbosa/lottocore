import { pool } from '../db.js';

export async function getEventForUser(eventId, userId) {
  const { rows } = await pool.query(
    `SELECT id, name, status, created_at, print_settings FROM events WHERE id = $1 AND owner_user_id = $2`,
    [eventId, userId],
  );
  return rows[0] ?? null;
}

export async function userOwnsSheet(userId, sheetId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM sheets s
     INNER JOIN events e ON e.id = s.event_id
     WHERE s.id = $1 AND e.owner_user_id = $2`,
    [sheetId, userId],
  );
  return rows.length > 0;
}

export async function userOwnsRound(userId, roundId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM rounds r
     INNER JOIN events e ON e.id = r.event_id
     WHERE r.id = $1 AND e.owner_user_id = $2`,
    [roundId, userId],
  );
  return rows.length > 0;
}

export async function userOwnsCard(userId, cardId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM cards c
     INNER JOIN sheets s ON s.id = c.sheet_id
     INNER JOIN events e ON e.id = s.event_id
     WHERE c.id = $1 AND e.owner_user_id = $2`,
    [cardId, userId],
  );
  return rows.length > 0;
}
