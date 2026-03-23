import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Pasta persistente por evento: uploads/print-settings/<eventId>/ */
export const PRINT_SETTINGS_UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads', 'print-settings');

const MAX_FILE_BYTES = 12 * 1024 * 1024;

/** @param {string} eventId */
export function eventPrintDir(eventId) {
  return path.join(PRINT_SETTINGS_UPLOAD_ROOT, eventId);
}

/**
 * @param {string} eventId
 * @param {'background'|'header'|'footer'} slot
 */
function slotBasePath(eventId, slot) {
  return path.join(eventPrintDir(eventId), slot);
}

/**
 * @param {string} eventId
 * @param {'background'|'header'|'footer'} slot
 * @param {string} dataUrl
 * @returns {Promise<void>}
 */
export async function writeSlotFromDataUrl(eventId, slot, dataUrl) {
  const m = /^data:(image\/[\w+.-]+);base64,(.*)$/s.exec(String(dataUrl));
  if (!m) {
    const err = new Error('Formato de imagem inválido');
    err.statusCode = 400;
    throw err;
  }
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_FILE_BYTES) {
    const err = new Error('Imagem demasiado grande após descodificar (máx. 12 MB por ficheiro).');
    err.statusCode = 400;
    throw err;
  }
  const mime = m[1].toLowerCase();
  let ext = 'jpg';
  if (mime.includes('png')) ext = 'png';
  else if (mime.includes('webp')) ext = 'webp';
  else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';

  await fs.mkdir(eventPrintDir(eventId), { recursive: true });
  await deleteSlotFiles(eventId, slot);
  const finalPath = `${slotBasePath(eventId, slot)}.${ext}`;
  await fs.writeFile(finalPath, buf);
}

/**
 * @param {string} eventId
 * @param {'background'|'header'|'footer'} slot
 */
export async function deleteSlotFiles(eventId, slot) {
  const base = slotBasePath(eventId, slot);
  for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
    try {
      await fs.unlink(`${base}.${ext}`);
    } catch {
      /* não existe */
    }
  }
}

/**
 * @param {string} eventId
 * @param {'background'|'header'|'footer'} slot
 * @returns {Promise<{ buffer: Buffer; mime: string } | null>}
 */
export async function readSlotFile(eventId, slot) {
  const base = slotBasePath(eventId, slot);
  for (const [ext, mime] of /** @type {const} */ [
    ['jpg', 'image/jpeg'],
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
  ]) {
    try {
      const p = `${base}.${ext}`;
      const buffer = await fs.readFile(p);
      return { buffer, mime };
    } catch {
      /* tentar próxima extensão */
    }
  }
  return null;
}
