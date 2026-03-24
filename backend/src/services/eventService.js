import { pool } from '../db.js';
import {
  deleteSlotFiles,
  writeSlotFromDataUrl,
} from './printSettingsFileStorage.js';

/**
 * @param {string} name
 * @param {string} ownerUserId
 */
export async function createEventWithRounds(name, ownerUserId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      rows: [event],
    } = await client.query(
      `INSERT INTO events (name, status, owner_user_id) VALUES ($1, 'draft', $2)
       RETURNING id, name, status, created_at`,
      [name, ownerUserId]
    );

    const { rows: rounds } = await client.query(
      `INSERT INTO rounds (event_id, round_number, status)
       SELECT $1::uuid, g.n, 'pending'
       FROM generate_series(1, 5) AS g(n)
       RETURNING id, round_number, status`,
      [event.id]
    );

    await client.query('COMMIT');
    return { event, rounds };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * @param {string} ownerUserId
 * @param {number} [limit]
 */
export async function listEventsForUser(ownerUserId, limit = 100) {
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const { rows } = await pool.query(
    `SELECT id, name, status, created_at FROM events
     WHERE owner_user_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [ownerUserId, cap]
  );
  return rows;
}

export async function getEventById(eventId) {
  const { rows } = await pool.query(
    `SELECT id, name, status, created_at FROM events WHERE id = $1`,
    [eventId]
  );
  return rows[0] ?? null;
}

export async function listRoundsByEventId(eventId) {
  const { rows } = await pool.query(
    `SELECT id, round_number, status, created_at
     FROM rounds WHERE event_id = $1
     ORDER BY round_number`,
    [eventId]
  );
  return rows;
}

/** Data URL completa (cabeçalho + base64); ~2,4 MB texto ≈ ~1,7 MB úteis em JPEG. */
const MAX_DATA_URL_LEN = 2_400_000;
const MAX_SUBTITLE = 200;
const MAX_FOOTER = 400;

/**
 * @param {unknown} v
 * @param {number} max
 */
function trimStr(v, max) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * @param {unknown} raw
 * @param {string} label
 */
function parseDataUrlField(raw, label) {
  if (raw == null || raw === '') return null;
  const u = String(raw);
  if (!u.startsWith('data:image/')) {
    const err = new Error(`${label}: use PNG ou JPEG (ficheiro exportado pelo navegador).`);
    err.statusCode = 400;
    throw err;
  }
  if (u.length > MAX_DATA_URL_LEN) {
    const err = new Error(
      `${label} demasiado grande após codificar (máx. ~2,3 MB). Reduza resolução ou comprima o ficheiro.`,
    );
    err.statusCode = 400;
    throw err;
  }
  return u;
}

const PRINT_SLOTS = /** @type {const} */ (['background', 'header', 'footer']);

const SLOT_FLAG = /** @type {const} */ ({
  background: 'hasBackgroundImage',
  header: 'hasHeaderImage',
  footer: 'hasFooterImage',
});

const SLOT_URL = /** @type {const} */ ({
  background: 'backgroundImageDataUrl',
  header: 'headerImageDataUrl',
  footer: 'footerImageDataUrl',
});

const SLOT_LABEL = /** @type {const} */ ({
  background: 'Imagem de fundo',
  header: 'Imagem de cabeçalho',
  footer: 'Imagem de rodapé',
});

/**
 * @param {Record<string, unknown>} prev
 * @param {'background'|'header'|'footer'} slot
 */
function inferHasStoredImage(prev, slot) {
  if (prev[SLOT_FLAG[slot]] === true) return true;
  const u = prev[SLOT_URL[slot]];
  return typeof u === 'string' && u.startsWith('data:image/');
}

/**
 * @param {Record<string, unknown>} body
 * @param {Record<string, unknown>} prev
 */
function parsePrintSettingsUpdateBody(body, prev) {
  const subtitle = trimStr(body?.subtitle, MAX_SUBTITLE);
  const footerNote = trimStr(body?.footerNote ?? body?.footer_note, MAX_FOOTER);

  let backgroundOpacity = null;
  const opRaw = body?.backgroundOpacity ?? body?.background_opacity;
  if (opRaw != null && opRaw !== '') {
    const n = Number(opRaw);
    if (!Number.isFinite(n)) {
      const err = new Error('Opacidade do fundo inválida');
      err.statusCode = 400;
      throw err;
    }
    const unit = n > 1 ? n / 100 : n;
    backgroundOpacity = Math.min(1, Math.max(0, unit));
  }

  /** @type {Record<string, { type: 'keep'|'clear'|'dataUrl'; dataUrl?: string }>} */
  const slots = {};

  const keepBg =
    body?.keepBackgroundImage === true ||
    body?.keep_background_image === true ||
    body?.keepBackgroundImage === '1';
  const keepHeader =
    body?.keepHeaderImage === true ||
    body?.keep_header_image === true ||
    body?.keepHeaderImage === '1';
  const keepFooter =
    body?.keepFooterImage === true ||
    body?.keep_footer_image === true ||
    body?.keepFooterImage === '1';
  const keepBySlot = { background: keepBg, header: keepHeader, footer: keepFooter };

  for (const slot of PRINT_SLOTS) {
    if (keepBySlot[slot]) {
      slots[slot] = { type: 'keep' };
      continue;
    }

    const raw = body?.[SLOT_URL[slot]] ?? body?.[snakeSlotUrl(slot)];
    if (raw === null || raw === '') {
      slots[slot] = { type: 'clear' };
      continue;
    }
    if (raw === undefined) {
      slots[slot] = inferHasStoredImage(prev, slot) ? { type: 'keep' } : { type: 'clear' };
      continue;
    }
    if (typeof raw === 'string' && raw.startsWith('data:image/')) {
      slots[slot] = { type: 'dataUrl', dataUrl: parseDataUrlField(raw, SLOT_LABEL[slot]) };
      continue;
    }
    const err = new Error(`${SLOT_LABEL[slot]}: formato inválido.`);
    err.statusCode = 400;
    throw err;
  }

  return { subtitle, footerNote, backgroundOpacity, slots };
}

/** @param {'background'|'header'|'footer'} slot */
function snakeSlotUrl(slot) {
  if (slot === 'background') return 'background_image_data_url';
  if (slot === 'header') return 'header_image_data_url';
  return 'footer_image_data_url';
}

/**
 * Migra imagens embutidas em JSON para ficheiros e grava metadados compactos na BD.
 * @param {string} eventId
 * @param {Record<string, unknown>} body
 * @param {Record<string, unknown>|null|undefined} previousPrintSettings
 */
export async function buildPrintSettingsForStorage(eventId, body, previousPrintSettings) {
  const prev =
    previousPrintSettings && typeof previousPrintSettings === 'object'
      ? { ...previousPrintSettings }
      : {};

  for (const slot of PRINT_SLOTS) {
    const key = SLOT_URL[slot];
    const v = prev[key];
    if (typeof v === 'string' && v.startsWith('data:image/')) {
      await writeSlotFromDataUrl(eventId, slot, parseDataUrlField(v, SLOT_LABEL[slot]));
    }
  }

  const parsed = parsePrintSettingsUpdateBody(body, prev);

  const out = {
    subtitle: parsed.subtitle,
    footerNote: parsed.footerNote,
    hasBackgroundImage: inferHasStoredImage(prev, 'background'),
    hasHeaderImage: inferHasStoredImage(prev, 'header'),
    hasFooterImage: inferHasStoredImage(prev, 'footer'),
    backgroundOpacity: parsed.backgroundOpacity,
  };

  for (const slot of PRINT_SLOTS) {
    const st = parsed.slots[slot];
    if (st.type === 'keep') continue;
    if (st.type === 'clear') {
      await deleteSlotFiles(eventId, slot);
      out[SLOT_FLAG[slot]] = false;
    } else if (st.type === 'dataUrl' && st.dataUrl) {
      await writeSlotFromDataUrl(eventId, slot, st.dataUrl);
      out[SLOT_FLAG[slot]] = true;
    }
  }

  if (!out.hasBackgroundImage) {
    out.backgroundOpacity = null;
  } else if (out.backgroundOpacity == null) {
    out.backgroundOpacity = 0.14;
  }

  return out;
}

/**
 * @param {string} eventId
 * @param {string} ownerUserId
 * @param {Record<string, unknown>} settings
 */
export async function updateEventPrintSettings(eventId, ownerUserId, settings) {
  const { rows } = await pool.query(
    `UPDATE events SET print_settings = $3::jsonb
     WHERE id = $1 AND owner_user_id = $2
     RETURNING id, print_settings`,
    [eventId, ownerUserId, JSON.stringify(settings)]
  );
  return rows[0] ?? null;
}

/**
 * Sincroniza `events.status` com o fecho das rodadas (chamar dentro da mesma transação que altera rodadas).
 *
 * Regras:
 * - Todas as rodadas `closed` → evento `draft` ou `active` passa a `archived`.
 * - Nem todas fechadas e evento estava `archived` → volta a `active` (reabertura).
 *
 * @param {import('pg').PoolClient} client
 * @param {string} eventId
 * @returns {Promise<{ id: string, status: string } | null>}
 */
export async function syncEventStatusFromRoundStates(client, eventId) {
  const { rows } = await client.query(
    `UPDATE events e
     SET status = CASE
       WHEN (
         SELECT COUNT(*)::int FROM rounds r
         WHERE r.event_id = e.id AND r.status <> 'closed'
       ) = 0 THEN
         CASE
           WHEN e.status IN ('draft', 'active') THEN 'archived'
           ELSE e.status
         END
       WHEN e.status = 'archived' THEN 'active'
       ELSE e.status
     END
     WHERE e.id = $1
     RETURNING id, status`,
    [eventId]
  );
  return rows[0] ?? null;
}
