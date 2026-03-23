import { Router } from 'express';
import { broadcastToEvent } from '../realtime.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { userOwnsCard } from '../services/eventAccess.js';
import { confirmWin, dismissWin, getCardById } from '../services/winnerService.js';
import { isUuid } from '../utils/uuid.js';

export const cardsRouter = Router();
cardsRouter.use(requireAuth);

cardsRouter.get('/:cardId', async (req, res) => {
  const { cardId } = req.params;
  if (!isUuid(cardId)) {
    return res.status(400).json({ error: 'cardId inválido' });
  }
  try {
    if (!(await userOwnsCard(req.userId, cardId))) {
      return res.status(404).json({ error: 'Cartela não encontrada' });
    }
    const card = await getCardById(cardId);
    if (!card) return res.status(404).json({ error: 'Cartela não encontrada' });
    return res.json({ card });
  } catch (e) {
    console.error('[cards] GET /:cardId', e);
    return res.status(500).json({ error: 'Erro ao buscar cartela' });
  }
});

cardsRouter.post('/:cardId/win/confirm', async (req, res) => {
  const { cardId } = req.params;
  if (!isUuid(cardId)) {
    return res.status(400).json({ error: 'cardId inválido' });
  }
  try {
    if (!(await userOwnsCard(req.userId, cardId))) {
      return res.status(404).json({ error: 'Cartela não encontrada' });
    }
    const row = await confirmWin(cardId);
    broadcastToEvent(row.event_id, {
      type: 'winner_detected',
      payload: {
        phase: 'confirmed',
        roundId: row.round_id,
        roundNumber: row.round_number,
        cardId: row.id,
        sheetId: row.sheet_id,
        sheetNumber: row.sheet_number,
        publicToken: row.public_token,
        confirmedAt: row.win_confirmed_at,
      },
    });
    return res.json({ card: row });
  } catch (e) {
    if (e.statusCode === 400) {
      return res.status(400).json({ error: e.message });
    }
    console.error('[cards] win/confirm', e);
    return res.status(500).json({ error: 'Erro ao confirmar vitória' });
  }
});

cardsRouter.post('/:cardId/win/dismiss', async (req, res) => {
  const { cardId } = req.params;
  if (!isUuid(cardId)) {
    return res.status(400).json({ error: 'cardId inválido' });
  }
  try {
    if (!(await userOwnsCard(req.userId, cardId))) {
      return res.status(404).json({ error: 'Cartela não encontrada' });
    }
    const row = await dismissWin(cardId);
    broadcastToEvent(row.event_id, {
      type: 'winner_detected',
      payload: {
        phase: 'dismissed',
        roundId: row.round_id,
        roundNumber: row.round_number,
        cardId: row.id,
        sheetId: row.sheet_id,
        sheetNumber: row.sheet_number,
        publicToken: row.public_token,
        dismissedAt: row.win_dismissed_at,
      },
    });
    return res.json({ card: row });
  } catch (e) {
    if (e.statusCode === 400) {
      return res.status(400).json({ error: e.message });
    }
    console.error('[cards] win/dismiss', e);
    return res.status(500).json({ error: 'Erro ao dispensar vitória' });
  }
});
