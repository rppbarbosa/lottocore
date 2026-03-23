import { pool } from '../db.js';

export async function getRoundById(roundId) {
  const { rows } = await pool.query(
    `SELECT r.id, r.event_id, r.round_number, r.status, r.created_at
     FROM rounds r WHERE r.id = $1`,
    [roundId]
  );
  return rows[0] ?? null;
}

export async function listDrawnNumbers(roundId) {
  const { rows } = await pool.query(
    `SELECT id, number, draw_order, drawn_at
     FROM drawn_numbers
     WHERE round_id = $1
     ORDER BY draw_order ASC`,
    [roundId]
  );
  return rows;
}

/**
 * Sorteia um número na rodada (1–75, sem repetir). Rodada `closed` bloqueada.
 * Se `pending`, passa a `open` no primeiro sorteio válido.
 */
export async function drawNumber(roundId, number) {
  if (!Number.isInteger(number) || number < 1 || number > 75) {
    const e = new Error('Número deve ser inteiro entre 1 e 75');
    e.statusCode = 400;
    throw e;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: rrows } = await client.query(
      `SELECT id, event_id, round_number, status FROM rounds WHERE id = $1 FOR UPDATE`,
      [roundId]
    );
    const round = rrows[0];
    if (!round) {
      const e = new Error('Rodada não encontrada');
      e.statusCode = 404;
      throw e;
    }
    if (round.status === 'closed') {
      const e = new Error('Rodada encerrada');
      e.statusCode = 400;
      throw e;
    }

    const { rows: orderRows } = await client.query(
      `SELECT COALESCE(MAX(draw_order), 0) + 1 AS next FROM drawn_numbers WHERE round_id = $1`,
      [roundId]
    );
    const drawOrder = Number(orderRows[0].next);

    const { rows: inserted } = await client.query(
      `INSERT INTO drawn_numbers (round_id, number, draw_order)
       VALUES ($1, $2, $3)
       RETURNING id, number, draw_order, drawn_at`,
      [roundId, number, drawOrder]
    );

    if (round.status === 'pending') {
      await client.query(`UPDATE rounds SET status = 'open' WHERE id = $1`, [roundId]);
    }

    await client.query('COMMIT');

    const row = inserted[0];
    return {
      id: row.id,
      round_id: roundId,
      event_id: round.event_id,
      round_number: round.round_number,
      number: row.number,
      draw_order: row.draw_order,
      drawn_at: row.drawn_at,
    };
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') {
      const dup = new Error('Número já sorteado nesta rodada');
      dup.statusCode = 409;
      throw dup;
    }
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Remove o último número sorteado na rodada (mitiga erro do operador).
 */
export async function undoLastDraw(roundId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: rrows } = await client.query(
      `SELECT id, event_id, round_number, status FROM rounds WHERE id = $1 FOR UPDATE`,
      [roundId]
    );
    const round = rrows[0];
    if (!round) {
      const e = new Error('Rodada não encontrada');
      e.statusCode = 404;
      throw e;
    }
    if (round.status === 'closed') {
      const e = new Error('Rodada encerrada');
      e.statusCode = 400;
      throw e;
    }

    const { rows: deleted } = await client.query(
      `DELETE FROM drawn_numbers
       WHERE id = (
         SELECT id FROM drawn_numbers WHERE round_id = $1 ORDER BY draw_order DESC LIMIT 1
       )
       RETURNING id, number, draw_order, drawn_at`,
      [roundId]
    );

    if (!deleted.length) {
      const e = new Error('Não há números para desfazer');
      e.statusCode = 400;
      throw e;
    }

    await client.query('COMMIT');

    const row = deleted[0];
    return {
      id: row.id,
      round_id: roundId,
      event_id: round.event_id,
      round_number: round.round_number,
      number: row.number,
      draw_order: row.draw_order,
      drawn_at: row.drawn_at,
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function setRoundStatus(roundId, status) {
  if (!['pending', 'open', 'closed'].includes(status)) {
    const e = new Error('status inválido (pending, open ou closed)');
    e.statusCode = 400;
    throw e;
  }
  const { rows } = await pool.query(
    `UPDATE rounds SET status = $2 WHERE id = $1
     RETURNING id, event_id, round_number, status`,
    [roundId, status]
  );
  if (!rows.length) {
    const e = new Error('Rodada não encontrada');
    e.statusCode = 404;
    throw e;
  }
  return rows[0];
}
