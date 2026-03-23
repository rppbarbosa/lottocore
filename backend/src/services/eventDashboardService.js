import { pool } from '../db.js';

/**
 * Indicadores agregados para o painel inicial.
 * @param {string} eventId
 * @param {string} userId
 */
export async function getEventDashboardStats(eventId, userId) {
  const eventRes = await pool.query(
    `SELECT id, name, status, created_at FROM events WHERE id = $1 AND owner_user_id = $2`,
    [eventId, userId],
  );
  const event = eventRes.rows[0] ?? null;
  if (!event) return null;

  const [sheetsRes, cardsRes, roundsRes, winsRes] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE sale_status = 'sold')::int AS sold,
         COUNT(*) FILTER (WHERE sale_status = 'available')::int AS available,
         COUNT(*) FILTER (WHERE sale_status = 'cancelled')::int AS cancelled,
         COALESCE(SUM(amount_paid_cents) FILTER (WHERE sale_status = 'sold'), 0)::bigint AS total_received_cents,
         COALESCE(
           SUM(
             GREATEST(
               COALESCE(sale_price_cents, 0) - COALESCE(amount_paid_cents, 0),
               0
             )
           ) FILTER (WHERE sale_status = 'sold'),
           0
         )::bigint AS total_pending_cents
       FROM sheets WHERE event_id = $1`,
      [eventId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM cards c
       INNER JOIN sheets s ON s.id = c.sheet_id
       WHERE s.event_id = $1`,
      [eventId],
    ),
    pool.query(
      `SELECT r.id, r.round_number, r.status,
        (SELECT COUNT(*)::int FROM drawn_numbers d WHERE d.round_id = r.id) AS numbers_drawn
       FROM rounds r
       WHERE r.event_id = $1
       ORDER BY r.round_number`,
      [eventId],
    ),
    pool.query(
      `SELECT c.win_status, COUNT(*)::int AS n
       FROM cards c
       INNER JOIN sheets s ON s.id = c.sheet_id
       WHERE s.event_id = $1 AND c.win_status <> 'none'
       GROUP BY c.win_status`,
      [eventId],
    ),
  ]);

  const sh = sheetsRes.rows[0] ?? {
    total: 0,
    sold: 0,
    available: 0,
    cancelled: 0,
    total_received_cents: '0',
    total_pending_cents: '0',
  };
  const wins = { suggested: 0, confirmed: 0, dismissed: 0 };
  for (const row of winsRes.rows) {
    if (row.win_status === 'suggested') wins.suggested = row.n;
    if (row.win_status === 'confirmed') wins.confirmed = row.n;
    if (row.win_status === 'dismissed') wins.dismissed = row.n;
  }

  const rounds = roundsRes.rows.map((r) => ({
    id: r.id,
    round_number: r.round_number,
    status: r.status,
    numbers_drawn: r.numbers_drawn,
  }));

  const numbers_drawn_total = rounds.reduce((acc, r) => acc + r.numbers_drawn, 0);

  const open_round = rounds.find((r) => r.status === 'open');
  const first_pending = rounds.find((r) => r.status === 'pending');

  return {
    event,
    sheets: {
      total: sh.total,
      sold: sh.sold,
      available: sh.available,
      cancelled: sh.cancelled,
      total_received_cents: Number(sh.total_received_cents),
      total_pending_cents: Number(sh.total_pending_cents),
    },
    cards: {
      total: cardsRes.rows[0]?.total ?? 0,
    },
    rounds,
    wins,
    summary: {
      numbers_drawn_total,
      open_round_number: open_round?.round_number ?? null,
      next_pending_round_number: !open_round && first_pending ? first_pending.round_number : null,
    },
  };
}
