import archiver from 'archiver';
import { PassThrough } from 'stream';
import { pool } from '../db.js';
import { getEventForUser } from './eventAccess.js';
import { generateSheetPdfBuffer, generateSheetRasterBuffer } from './sheetPdfService.js';
import { zipBufferLooksComplete } from '../utils/zipIntegrity.js';

const MAX_SHEETS_PER_ZIP = 500;

/** @typedef {'pdf' | 'jpeg' | 'png'} ExportFormat */

function padSheetNum(n) {
  return String(Math.floor(Number(n))).padStart(4, '0');
}

function safeEventSlug(name) {
  const s = String(name ?? 'evento')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\w\s-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return s || 'evento';
}

/**
 * @param {string} raw
 * @returns {ExportFormat}
 */
export function parseExportFormat(raw) {
  const f = String(raw ?? 'pdf').toLowerCase().trim();
  if (f === 'jpg') return 'jpeg';
  if (f === 'jpeg' || f === 'png' || f === 'pdf') return f;
  const e = new Error('format inválido: use pdf, jpeg ou png');
  e.statusCode = 400;
  throw e;
}

/**
 * @param {Buffer} buf
 * @param {ExportFormat} format
 * @param {number} sheetNumber
 */
function assertValidAsset(buf, format, sheetNumber) {
  if (format === 'pdf') {
    if (buf.length < 200 || buf.subarray(0, 4).toString('latin1') !== '%PDF') {
      const e = new Error(`PDF inválido para folha #${sheetNumber}`);
      e.statusCode = 500;
      throw e;
    }
    return;
  }
  if (format === 'jpeg') {
    if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
      const e = new Error(`JPEG inválido para folha #${sheetNumber}`);
      e.statusCode = 500;
      throw e;
    }
    return;
  }
  if (buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    const e = new Error(`PNG inválido para folha #${sheetNumber}`);
    e.statusCode = 500;
    throw e;
  }
}

/**
 * @param {string} sheetId
 * @param {ExportFormat} format
 * @returns {Promise<{ buffer: Buffer, sheetNumber: number, entryName: string }>}
 */
async function generateSheetAsset(sheetId, format) {
  if (format === 'pdf') {
    const { buffer, sheetNumber } = await generateSheetPdfBuffer(sheetId);
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    assertValidAsset(buf, 'pdf', sheetNumber);
    return { buffer: buf, sheetNumber, entryName: `bingo-folha-${padSheetNum(sheetNumber)}.pdf` };
  }
  const rasterFmt = format === 'png' ? 'png' : 'jpeg';
  const { buffer, sheetNumber } = await generateSheetRasterBuffer(sheetId, rasterFmt);
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  assertValidAsset(buf, format, sheetNumber);
  const ext = format === 'png' ? '.png' : '.jpg';
  return { buffer: buf, sheetNumber, entryName: `bingo-folha-${padSheetNum(sheetNumber)}${ext}` };
}

/**
 * Lista folhas do evento por intervalo de números ou todas.
 * @param {string} eventId
 * @param {{ all: boolean, from?: number, to?: number }} opts
 */
export async function listSheetIdsForExport(eventId, opts) {
  if (opts.all) {
    const { rows } = await pool.query(
      `SELECT id, sheet_number FROM sheets WHERE event_id = $1 ORDER BY sheet_number ASC`,
      [eventId],
    );
    return rows;
  }
  const from = Math.floor(Number(opts.from));
  const to = Math.floor(Number(opts.to));
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    const e = new Error('Intervalo inválido: use números inteiros em from e to');
    e.statusCode = 400;
    throw e;
  }
  let a = from;
  let b = to;
  if (a > b) [a, b] = [b, a];
  if (a < 1) {
    const e = new Error('Número de folha deve ser ≥ 1');
    e.statusCode = 400;
    throw e;
  }
  const { rows } = await pool.query(
    `SELECT id, sheet_number FROM sheets
     WHERE event_id = $1 AND sheet_number >= $2 AND sheet_number <= $3
     ORDER BY sheet_number ASC`,
    [eventId, a, b],
  );
  return rows;
}

/**
 * Gera ZIP em memória, valida integridade (EOCD) e só depois envia a resposta.
 * @param {import('express').Response} res
 * @param {string} eventId
 * @param {string} userId
 * @param {{ all?: string, from?: string, to?: string, format?: string }} query
 */
export async function buildAndSendSheetsZip(res, eventId, userId, query) {
  const event = await getEventForUser(eventId, userId);
  if (!event) {
    const e = new Error('Evento não encontrado');
    e.statusCode = 404;
    throw e;
  }

  const format = parseExportFormat(query.format);

  const all =
    query.all === '1' ||
    query.all === 'true' ||
    String(query.scope ?? '').toLowerCase() === 'all';

  let rows;
  if (all) {
    rows = await listSheetIdsForExport(eventId, { all: true });
  } else {
    const from = query.from;
    const to = query.to;
    if (from === undefined || from === '' || to === undefined || to === '') {
      const e = new Error('Indique all=1 para todas as folhas, ou from e to (ex.: from=7&to=23)');
      e.statusCode = 400;
      throw e;
    }
    rows = await listSheetIdsForExport(eventId, {
      all: false,
      from: Number.parseInt(String(from), 10),
      to: Number.parseInt(String(to), 10),
    });
  }

  if (rows.length === 0) {
    const e = new Error('Nenhuma folha encontrada para os critérios indicados');
    e.statusCode = 400;
    throw e;
  }
  if (rows.length > MAX_SHEETS_PER_ZIP) {
    const e = new Error(`Máximo ${MAX_SHEETS_PER_ZIP} folhas por arquivo ZIP (pedido: ${rows.length})`);
    e.statusCode = 400;
    throw e;
  }

  const slug = safeEventSlug(event.name);
  const fmtLabel = format === 'jpeg' ? 'jpg' : format;
  const filename = `bingo-folhas-${slug}-${rows.length}folhas-${fmtLabel}.zip`;

  let firstAsset;
  try {
    firstAsset = await generateSheetAsset(rows[0].id, format);
  } catch (err) {
    const code = err.statusCode === 400 || err.statusCode === 404 ? err.statusCode : 500;
    return res.status(code).json({ error: err.message || 'Erro ao gerar ficheiro' });
  }

  const archive = archiver('zip', { zlib: { level: 6 } });
  const passthrough = new PassThrough();
  /** @type {Buffer[]} */
  const chunks = [];
  passthrough.on('data', (c) => chunks.push(c));

  const zipFinished = new Promise((resolve, reject) => {
    passthrough.on('finish', () => resolve());
    passthrough.on('error', reject);
    archive.on('error', reject);
  });

  archive.pipe(passthrough);

  try {
    archive.append(firstAsset.buffer, { name: firstAsset.entryName });

    for (let i = 1; i < rows.length; i++) {
      const asset = await generateSheetAsset(rows[i].id, format);
      archive.append(asset.buffer, { name: asset.entryName });
    }

    await archive.finalize();
    await zipFinished;

    const zipBuf = Buffer.concat(chunks);
    if (!zipBufferLooksComplete(zipBuf)) {
      const e = new Error(
        'Falha de integridade do ZIP (registo central inválido). Tente de novo; se persistir, reduza o número de folhas.',
      );
      e.statusCode = 500;
      throw e;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.setHeader('Content-Length', String(zipBuf.length));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.end(zipBuf);
  } catch (err) {
    console.error('[sheetBulkExport] ZIP', err);
    try {
      archive.abort();
    } catch {
      /* ignore */
    }
    if (!res.headersSent) {
      const code = err.statusCode === 400 || err.statusCode === 404 ? err.statusCode : 500;
      return res.status(code).json({ error: err.message || 'Erro ao gerar ZIP' });
    }
    try {
      res.end();
    } catch {
      /* ignore */
    }
  }
}
