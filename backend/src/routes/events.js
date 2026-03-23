import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { getEventForUser } from '../services/eventAccess.js';
import {
  buildPrintSettingsForStorage,
  createEventWithRounds,
  listRoundsByEventId,
  listEventsForUser,
  updateEventPrintSettings,
} from '../services/eventService.js';
import { readSlotFile } from '../services/printSettingsFileStorage.js';
import { getEventDashboardStats } from '../services/eventDashboardService.js';
import { buildAndSendSheetsZip } from '../services/sheetBulkPdfExportService.js';
import { generateSheetsForEvent, listSheetsByEvent } from '../services/sheetService.js';
import { isUuid } from '../utils/uuid.js';

export const eventsRouter = Router();

eventsRouter.use(requireAuth);

eventsRouter.get('/', async (req, res) => {
  try {
    const events = await listEventsForUser(req.userId);
    return res.json({ events });
  } catch (e) {
    console.error('[events] GET /', e);
    return res.status(500).json({ error: 'Erro ao listar eventos' });
  }
});

eventsRouter.get('/:eventId/dashboard', async (req, res) => {
  const { eventId } = req.params;
  if (!isUuid(eventId)) {
    return res.status(400).json({ error: 'eventId inválido' });
  }
  try {
    const data = await getEventDashboardStats(eventId, req.userId);
    if (!data) return res.status(404).json({ error: 'Evento não encontrado' });
    return res.json(data);
  } catch (e) {
    console.error('[events] GET dashboard', e);
    return res.status(500).json({ error: 'Erro ao carregar indicadores' });
  }
});

eventsRouter.post('/', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > 200) {
    return res.status(400).json({ error: 'name é obrigatório (máx. 200 caracteres)' });
  }
  try {
    const { event, rounds } = await createEventWithRounds(name, req.userId);
    return res.status(201).json({ event, rounds });
  } catch (e) {
    console.error('[events] POST /', e);
    return res.status(500).json({ error: 'Erro ao criar evento' });
  }
});

eventsRouter.patch('/:eventId/print-settings', async (req, res) => {
  const { eventId } = req.params;
  if (!isUuid(eventId)) {
    return res.status(400).json({ error: 'eventId inválido' });
  }
  try {
    const existing = await getEventForUser(eventId, req.userId);
    if (!existing) return res.status(404).json({ error: 'Evento não encontrado' });
    const prev =
      existing.print_settings && typeof existing.print_settings === 'object'
        ? existing.print_settings
        : {};
    const settings = await buildPrintSettingsForStorage(eventId, req.body || {}, prev);
    const row = await updateEventPrintSettings(eventId, req.userId, settings);
    if (!row) return res.status(404).json({ error: 'Evento não encontrado' });
    return res.json({ print_settings: row.print_settings });
  } catch (e) {
    if (e.statusCode === 400) {
      return res.status(400).json({ error: e.message });
    }
    console.error('[events] PATCH print-settings', e);
    return res.status(500).json({ error: 'Erro ao guardar modelo de impressão' });
  }
});

const PRINT_FILE_SLOTS = new Set(['background', 'header', 'footer']);

eventsRouter.get('/:eventId/print-settings/file/:slot', async (req, res) => {
  const { eventId, slot } = req.params;
  if (!isUuid(eventId)) {
    return res.status(400).json({ error: 'eventId inválido' });
  }
  if (!PRINT_FILE_SLOTS.has(slot)) {
    return res.status(400).json({ error: 'slot inválido' });
  }
  try {
    const existing = await getEventForUser(eventId, req.userId);
    if (!existing) return res.status(404).json({ error: 'Evento não encontrado' });
    const ps = existing.print_settings && typeof existing.print_settings === 'object' ? existing.print_settings : {};
    const flag =
      slot === 'background'
        ? 'hasBackgroundImage'
        : slot === 'header'
          ? 'hasHeaderImage'
          : 'hasFooterImage';
    if (!ps[flag]) {
      return res.status(404).json({ error: 'Sem imagem neste slot' });
    }
    const file = await readSlotFile(eventId, slot);
    if (!file) {
      return res.status(404).json({ error: 'Ficheiro em falta — volte a carregar a imagem' });
    }
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.send(file.buffer);
  } catch (e) {
    console.error('[events] GET print-settings file', e);
    return res.status(500).json({ error: 'Erro ao ler imagem' });
  }
});

eventsRouter.get('/:eventId', async (req, res) => {
  const { eventId } = req.params;
  if (!isUuid(eventId)) {
    return res.status(400).json({ error: 'eventId inválido' });
  }
  try {
    const event = await getEventForUser(eventId, req.userId);
    if (!event) return res.status(404).json({ error: 'Evento não encontrado' });
    const rounds = await listRoundsByEventId(eventId);
    return res.json({ event, rounds });
  } catch (e) {
    console.error('[events] GET /:eventId', e);
    return res.status(500).json({ error: 'Erro ao buscar evento' });
  }
});

eventsRouter.post('/:eventId/sheets', async (req, res) => {
  const { eventId } = req.params;
  if (!isUuid(eventId)) {
    return res.status(400).json({ error: 'eventId inválido' });
  }
  const raw = req.body?.count;
  const count = raw === undefined ? 1 : parseInt(String(raw), 10);
  const cpsRaw = req.body?.cardsPerSheet ?? req.body?.cards_per_sheet ?? 5;
  const cardsPerSheet = parseInt(String(cpsRaw), 10);
  try {
    const event = await getEventForUser(eventId, req.userId);
    if (!event) return res.status(404).json({ error: 'Evento não encontrado' });
    const result = await generateSheetsForEvent(eventId, count, cardsPerSheet);
    return res.status(201).json(result);
  } catch (e) {
    if (e.statusCode === 400) {
      return res.status(400).json({ error: e.message });
    }
    console.error('[events] POST sheets', e);
    return res.status(500).json({ error: 'Erro ao gerar folhas' });
  }
});

eventsRouter.get('/:eventId/sheets', async (req, res) => {
  const { eventId } = req.params;
  if (!isUuid(eventId)) {
    return res.status(400).json({ error: 'eventId inválido' });
  }
  try {
    const event = await getEventForUser(eventId, req.userId);
    if (!event) return res.status(404).json({ error: 'Evento não encontrado' });
    const sheets = await listSheetsByEvent(eventId);
    return res.json({ sheets });
  } catch (e) {
    console.error('[events] GET sheets', e);
    return res.status(500).json({ error: 'Erro ao listar folhas' });
  }
});

/**
 * ZIP com folhas: ?all=1 ou ?from=7&to=23
 * &format=pdf (defeito) | jpeg | png — ZIP validado (EOCD) antes de enviar.
 */
eventsRouter.get('/:eventId/sheets/export-pdfs', async (req, res) => {
  const { eventId } = req.params;
  if (!isUuid(eventId)) {
    return res.status(400).json({ error: 'eventId inválido' });
  }
  try {
    await buildAndSendSheetsZip(res, eventId, req.userId, req.query);
  } catch (e) {
    if (e.statusCode === 400 || e.statusCode === 404) {
      return res.status(e.statusCode).json({ error: e.message });
    }
    console.error('[events] GET sheets/export-pdfs', e);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Erro ao gerar arquivo ZIP' });
    }
  }
});
