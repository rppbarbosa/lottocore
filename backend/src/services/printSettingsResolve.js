import { readSlotFile } from './printSettingsFileStorage.js';

const SLOTS = /** @type {const} */ (['background', 'header', 'footer']);
const FLAG = /** @type {const} */ ({
  background: 'hasBackgroundImage',
  header: 'hasHeaderImage',
  footer: 'hasFooterImage',
});
const URL_KEY = /** @type {const} */ ({
  background: 'backgroundImageDataUrl',
  header: 'headerImageDataUrl',
  footer: 'footerImageDataUrl',
});

/**
 * @param {string} eventId
 * @param {Record<string, unknown>} raw
 * @returns {Promise<Record<string, unknown>>}
 */
export async function resolvePrintSettingsForPdf(eventId, raw) {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const out = { ...raw };

  for (const slot of SLOTS) {
    const k = URL_KEY[slot];
    const inline = out[k];
    if (typeof inline === 'string' && inline.startsWith('data:image/')) {
      continue;
    }
    delete out[k];
    if (!out[FLAG[slot]]) continue;
    const file = await readSlotFile(eventId, slot);
    if (file) {
      out[k] = `data:${file.mime};base64,${file.buffer.toString('base64')}`;
    } else {
      out[FLAG[slot]] = false;
    }
  }

  return out;
}
