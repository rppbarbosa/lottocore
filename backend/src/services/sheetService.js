import { nanoid } from 'nanoid';
import { pool } from '../db.js';
import { parseSanitizedSaleBuyerPayload } from '../utils/buyerSaleSanitize.js';
import { parseMoneyCents } from '../utils/moneyCents.js';
import { fingerprintFromGrid, generateBingoGrid } from './bingoGrid.js';

const MAX_RETRIES_PER_CARD = 80;

/**
 * @param {import('pg').PoolClient} client
 * @param {string} eventId
 */
async function getNextSheetNumbers(client, eventId, count) {
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(sheet_number), 0) AS m FROM sheets WHERE event_id = $1`,
    [eventId]
  );
  const start = Number(rows[0].m) + 1;
  return Array.from({ length: count }, (_, i) => start + i);
}

/**
 * @param {import('pg').PoolClient} client
 * @param {string} roundId
 * @param {string} sheetId
 */
async function insertCardForRound(client, roundId, sheetId) {
  for (let attempt = 0; attempt < MAX_RETRIES_PER_CARD; attempt++) {
    const grid = generateBingoGrid();
    const grid_fingerprint = fingerprintFromGrid(grid);
    const public_token = nanoid(21);
    try {
      const { rows } = await client.query(
        `INSERT INTO cards (sheet_id, round_id, grid, grid_fingerprint, public_token)
         VALUES ($1, $2, $3::jsonb, $4, $5)
         RETURNING id, public_token`,
        [sheetId, roundId, JSON.stringify(grid), grid_fingerprint, public_token]
      );
      return rows[0];
    } catch (e) {
      if (e.code === '23505') continue;
      throw e;
    }
  }
  throw new Error('Não foi possível gerar cartela única nesta rodada após várias tentativas');
}

/**
 * Gera folhas com até 5 cartelas (1 por rodada, nas primeiras N rodadas), respeitando unicidade por rodada.
 * @param {string} eventId
 * @param {number} count — quantidade de folhas
 * @param {number} [cardsPerSheet=5] — cartelas por folha (1–5)
 */
export async function generateSheetsForEvent(eventId, count, cardsPerSheet = 5) {
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    const err = new Error('count deve ser inteiro entre 1 e 500');
    err.statusCode = 400;
    throw err;
  }
  const cpsNum = Number(cardsPerSheet);
  const cps = Number.isFinite(cpsNum) ? Math.trunc(cpsNum) : 5;
  if (cps < 1 || cps > 5) {
    const err = new Error('cardsPerSheet deve ser entre 1 e 5');
    err.statusCode = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: roundRows } = await client.query(
      `SELECT id, round_number FROM rounds WHERE event_id = $1 ORDER BY round_number`,
      [eventId]
    );
    if (roundRows.length !== 5) {
      const err = new Error('Evento sem 5 rodadas configuradas');
      err.statusCode = 400;
      throw err;
    }

    const roundsToUse = roundRows.slice(0, cps);

    const sheetNumbers = await getNextSheetNumbers(client, eventId, count);
    const created = [];

    for (const sheetNumber of sheetNumbers) {
      let sheet = null;
      for (let sAttempt = 0; sAttempt < MAX_RETRIES_PER_CARD; sAttempt++) {
        const sheetPublicToken = nanoid(21);
        try {
          const { rows: sheetRows } = await client.query(
            `INSERT INTO sheets (event_id, sheet_number, sale_status, public_token)
             VALUES ($1, $2, 'available', $3)
             RETURNING id, sheet_number`,
            [eventId, sheetNumber, sheetPublicToken]
          );
          sheet = sheetRows[0];
          break;
        } catch (e) {
          if (e.code === '23505') continue;
          throw e;
        }
      }
      if (!sheet) {
        const err = new Error('Não foi possível criar folha com token público único');
        err.statusCode = 500;
        throw err;
      }
      const cards = [];
      for (const r of roundsToUse) {
        const card = await insertCardForRound(client, r.id, sheet.id);
        cards.push({ round_number: r.round_number, ...card });
      }
      created.push({ sheet_id: sheet.id, sheet_number: sheet.sheet_number, cards });
    }

    await client.query('COMMIT');
    return { sheets: created };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function listSheetsByEvent(eventId) {
  const { rows } = await pool.query(
    `SELECT s.id, s.sheet_number, s.sale_status, s.buyer_name, s.buyer_contact, s.sold_at,
            s.buyer_email, s.buyer_whatsapp, s.buyer_address, s.buyer_cep,
            s.buyer_street, s.buyer_street_number, s.buyer_address_complement,
            s.buyer_neighborhood, s.buyer_city, s.buyer_state,
            s.seller_name,
            s.sale_price_cents, s.amount_paid_cents,
            s.public_token,
            (SELECT COUNT(*)::int FROM cards c WHERE c.sheet_id = s.id) AS card_count
     FROM sheets s
     WHERE s.event_id = $1
     ORDER BY s.sheet_number`,
    [eventId]
  );
  return rows;
}

/**
 * Cancelar folha (disponível ou vendida) ou reativar (cancelada → disponível).
 * @param {string} sheetId
 * @param {'cancelled'|'available'} next
 */
export async function patchSheetSaleStatus(sheetId, next) {
  if (next === 'cancelled') {
    const { rows } = await pool.query(
      `UPDATE sheets
       SET sale_status = 'cancelled',
           buyer_name = NULL, buyer_contact = NULL, sold_at = NULL,
           buyer_email = NULL, buyer_whatsapp = NULL, buyer_address = NULL, buyer_cep = NULL,
           buyer_street = NULL, buyer_street_number = NULL, buyer_address_complement = NULL,
           buyer_neighborhood = NULL, buyer_city = NULL, buyer_state = NULL,
           seller_name = NULL, sale_price_cents = NULL, amount_paid_cents = 0
       WHERE id = $1 AND sale_status IN ('available', 'sold')
       RETURNING id, event_id, sheet_number, sale_status, buyer_name, buyer_contact, sold_at,
                 buyer_email, buyer_whatsapp, buyer_address, buyer_cep,
                 buyer_street, buyer_street_number, buyer_address_complement,
                 buyer_neighborhood, buyer_city, buyer_state,
                 seller_name,
                 sale_price_cents, amount_paid_cents`,
      [sheetId]
    );
    if (!rows.length) {
      const e = new Error('Folha não encontrada ou já cancelada');
      e.statusCode = 400;
      throw e;
    }
    return rows[0];
  }
  if (next === 'available') {
    const { rows } = await pool.query(
      `UPDATE sheets
       SET sale_status = 'available',
           buyer_name = NULL, buyer_contact = NULL, sold_at = NULL,
           buyer_email = NULL, buyer_whatsapp = NULL, buyer_address = NULL, buyer_cep = NULL,
           buyer_street = NULL, buyer_street_number = NULL, buyer_address_complement = NULL,
           buyer_neighborhood = NULL, buyer_city = NULL, buyer_state = NULL,
           seller_name = NULL, sale_price_cents = NULL, amount_paid_cents = 0
       WHERE id = $1 AND sale_status = 'cancelled'
       RETURNING id, event_id, sheet_number, sale_status, buyer_name, buyer_contact, sold_at,
                 buyer_email, buyer_whatsapp, buyer_address, buyer_cep,
                 buyer_street, buyer_street_number, buyer_address_complement,
                 buyer_neighborhood, buyer_city, buyer_state,
                 seller_name,
                 sale_price_cents, amount_paid_cents`,
      [sheetId]
    );
    if (!rows.length) {
      const e = new Error('Folha não encontrada ou não está cancelada');
      e.statusCode = 400;
      throw e;
    }
    return rows[0];
  }
  const e = new Error('Transição inválida');
  e.statusCode = 400;
  throw e;
}

/**
 * @param {string} sheetId
 * @param {Record<string, unknown>} body — camelCase ou snake_case
 */
export async function markSheetSold(sheetId, body = {}) {
  let buyer;
  try {
    buyer = parseSanitizedSaleBuyerPayload(body);
  } catch (e) {
    if (/** @type {{ statusCode?: number }} */ (e).statusCode) throw e;
    throw e;
  }

  const priceRaw = parseMoneyCents(body.salePriceCents ?? body.sale_price_cents, {
    allowUndefined: true,
  });
  if (priceRaw === null) {
    const e = new Error('Preço da folha inválido');
    e.statusCode = 400;
    throw e;
  }
  const paidInput = body.amountPaidCents ?? body.amount_paid_cents;
  const paidRaw = parseMoneyCents(
    paidInput === '' || paidInput === undefined || paidInput === null ? 0 : paidInput,
    { allowUndefined: false }
  );
  if (paidRaw === null) {
    const e = new Error('Valor recebido inválido');
    e.statusCode = 400;
    throw e;
  }

  const sale_price_cents = priceRaw === undefined ? null : priceRaw;
  const amount_paid_cents = paidRaw;

  const contactSync = buyer.buyer_whatsapp;

  const { rows } = await pool.query(
    `UPDATE sheets
     SET sale_status = 'sold',
         buyer_name = $2,
         buyer_contact = $3,
         buyer_whatsapp = $4,
         buyer_email = $5,
         buyer_address = $6,
         buyer_cep = $7,
         seller_name = $8,
         sale_price_cents = $9,
         amount_paid_cents = $10,
         buyer_street = $11,
         buyer_street_number = $12,
         buyer_address_complement = $13,
         buyer_neighborhood = $14,
         buyer_city = $15,
         buyer_state = $16,
         sold_at = NOW()
     WHERE id = $1 AND sale_status = 'available'
     RETURNING id, event_id, sheet_number, sale_status, buyer_name, buyer_contact, sold_at,
               buyer_email, buyer_whatsapp, buyer_address, buyer_cep,
               buyer_street, buyer_street_number, buyer_address_complement,
               buyer_neighborhood, buyer_city, buyer_state,
               seller_name,
               sale_price_cents, amount_paid_cents`,
    [
      sheetId,
      buyer.buyer_name,
      contactSync,
      buyer.buyer_whatsapp,
      buyer.buyer_email,
      buyer.buyer_address,
      buyer.buyer_cep,
      buyer.seller_name,
      sale_price_cents,
      amount_paid_cents,
      buyer.buyer_street,
      buyer.buyer_street_number,
      buyer.buyer_address_complement,
      buyer.buyer_neighborhood,
      buyer.buyer_city,
      buyer.buyer_state,
    ]
  );
  if (!rows.length) {
    const e = new Error('Folha não encontrada ou já vendida');
    e.statusCode = 400;
    throw e;
  }
  return rows[0];
}

/**
 * Atualiza dados de comprador e pagamento em folha já vendida.
 * @param {string} sheetId
 * @param {Record<string, unknown>} body
 */
export async function updateSheetSaleDetails(sheetId, body) {
  let buyer;
  try {
    buyer = parseSanitizedSaleBuyerPayload(body);
  } catch (e) {
    if (/** @type {{ statusCode?: number }} */ (e).statusCode) throw e;
    throw e;
  }

  const priceRaw = parseMoneyCents(body.salePriceCents ?? body.sale_price_cents, {
    allowUndefined: true,
  });
  if (priceRaw === null) {
    const e = new Error('Preço da folha inválido');
    e.statusCode = 400;
    throw e;
  }
  const paidInput = body.amountPaidCents ?? body.amount_paid_cents;
  const paidRaw = parseMoneyCents(
    paidInput === '' || paidInput === undefined || paidInput === null ? 0 : paidInput,
    { allowUndefined: false }
  );
  if (paidRaw === null) {
    const e = new Error('Valor recebido inválido');
    e.statusCode = 400;
    throw e;
  }

  const sale_price_cents = priceRaw === undefined ? null : priceRaw;
  const amount_paid_cents = paidRaw;
  const contactSync = buyer.buyer_whatsapp;

  const { rows } = await pool.query(
    `UPDATE sheets
     SET buyer_name = $2,
         buyer_contact = $3,
         buyer_whatsapp = $4,
         buyer_email = $5,
         buyer_address = $6,
         buyer_cep = $7,
         seller_name = $8,
         sale_price_cents = $9,
         amount_paid_cents = $10,
         buyer_street = $11,
         buyer_street_number = $12,
         buyer_address_complement = $13,
         buyer_neighborhood = $14,
         buyer_city = $15,
         buyer_state = $16
     WHERE id = $1 AND sale_status = 'sold'
     RETURNING id, event_id, sheet_number, sale_status, buyer_name, buyer_contact, sold_at,
               buyer_email, buyer_whatsapp, buyer_address, buyer_cep,
               buyer_street, buyer_street_number, buyer_address_complement,
               buyer_neighborhood, buyer_city, buyer_state,
               seller_name,
               sale_price_cents, amount_paid_cents`,
    [
      sheetId,
      buyer.buyer_name,
      contactSync,
      buyer.buyer_whatsapp,
      buyer.buyer_email,
      buyer.buyer_address,
      buyer.buyer_cep,
      buyer.seller_name,
      sale_price_cents,
      amount_paid_cents,
      buyer.buyer_street,
      buyer.buyer_street_number,
      buyer.buyer_address_complement,
      buyer.buyer_neighborhood,
      buyer.buyer_city,
      buyer.buyer_state,
    ]
  );
  if (!rows.length) {
    const e = new Error('Folha não encontrada ou não está vendida');
    e.statusCode = 400;
    throw e;
  }
  return rows[0];
}
