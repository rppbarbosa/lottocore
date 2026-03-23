import { Router } from 'express';
import { broadcastToEvent } from '../realtime.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { userOwnsRound } from '../services/eventAccess.js';
import {
  drawNumber,
  getRoundById,
  listDrawnNumbers,
  setRoundStatus,
  undoLastDraw,
} from '../services/drawService.js';
import {
  evaluateRoundForWinners,
  listWinnersForRound,
  reconcileSuggestedAfterUndo,
} from '../services/winnerService.js';
import { isUuid } from '../utils/uuid.js';

export const roundsRouter = Router();
roundsRouter.use(requireAuth);

roundsRouter.get('/:roundId/winners', async (req, res) => {
  const { roundId } = req.params;
  if (!isUuid(roundId)) {
    return res.status(400).json({ error: 'roundId inválido' });
  }
  try {
    if (!(await userOwnsRound(req.userId, roundId))) {
      return res.status(404).json({ error: 'Rodada não encontrada' });
    }
    const round = await getRoundById(roundId);
    if (!round) return res.status(404).json({ error: 'Rodada não encontrada' });
    const winners = await listWinnersForRound(roundId);
    return res.json({ round: { id: round.id, round_number: round.round_number }, winners });
  } catch (e) {
    console.error('[rounds] GET winners', e);
    return res.status(500).json({ error: 'Erro ao listar vitórias' });
  }
});

roundsRouter.get('/:roundId', async (req, res) => {
  const { roundId } = req.params;
  if (!isUuid(roundId)) {
    return res.status(400).json({ error: 'roundId inválido' });
  }
  try {
    if (!(await userOwnsRound(req.userId, roundId))) {
      return res.status(404).json({ error: 'Rodada não encontrada' });
    }
    const round = await getRoundById(roundId);
    if (!round) return res.status(404).json({ error: 'Rodada não encontrada' });
    const drawn = await listDrawnNumbers(roundId);
    return res.json({ round, drawn });
  } catch (e) {
    console.error('[rounds] GET /:roundId', e);
    return res.status(500).json({ error: 'Erro ao buscar rodada' });
  }
});

roundsRouter.patch('/:roundId/status', async (req, res) => {
  const { roundId } = req.params;
  if (!isUuid(roundId)) {
    return res.status(400).json({ error: 'roundId inválido' });
  }
  const status = req.body?.status;
  if (typeof status !== 'string') {
    return res.status(400).json({ error: 'status é obrigatório' });
  }
  try {
    if (!(await userOwnsRound(req.userId, roundId))) {
      return res.status(404).json({ error: 'Rodada não encontrada' });
    }
    const round = await setRoundStatus(roundId, status);
    broadcastToEvent(round.event_id, {
      type: 'round_status',
      payload: {
        roundId: round.id,
        roundNumber: round.round_number,
        status: round.status,
      },
    });
    return res.json({ round });
  } catch (e) {
    if (e.statusCode === 400 || e.statusCode === 404) {
      return res.status(e.statusCode).json({ error: e.message });
    }
    console.error('[rounds] PATCH status', e);
    return res.status(500).json({ error: 'Erro ao atualizar rodada' });
  }
});

roundsRouter.post('/:roundId/draw', async (req, res) => {
  const { roundId } = req.params;
  if (!isUuid(roundId)) {
    return res.status(400).json({ error: 'roundId inválido' });
  }
  const n = req.body?.number;
  const number = typeof n === 'string' ? Number.parseInt(n, 10) : Number(n);
  try {
    if (!(await userOwnsRound(req.userId, roundId))) {
      return res.status(404).json({ error: 'Rodada não encontrada' });
    }
    const result = await drawNumber(roundId, number);
    broadcastToEvent(result.event_id, {
      type: 'number_drawn',
      payload: {
        roundId: result.round_id,
        roundNumber: result.round_number,
        number: result.number,
        drawOrder: result.draw_order,
        drawnAt: result.drawn_at,
      },
    });

    let winners = [];
    try {
      const ev = await evaluateRoundForWinners(roundId);
      winners = ev.winners;
      for (const w of winners) {
        broadcastToEvent(ev.eventId, {
          type: 'winner_detected',
          payload: {
            phase: 'suggested',
            roundId: ev.roundId,
            roundNumber: ev.roundNumber,
            cardId: w.cardId,
            sheetId: w.sheetId,
            sheetNumber: w.sheetNumber,
            publicToken: w.publicToken,
            suggestedAt: w.suggestedAt,
          },
        });
      }
    } catch (we) {
      console.error('[rounds] evaluate winners', we);
    }

    return res.status(201).json({ draw: result, winners });
  } catch (e) {
    if (e.statusCode === 400 || e.statusCode === 404 || e.statusCode === 409) {
      return res.status(e.statusCode).json({ error: e.message });
    }
    console.error('[rounds] POST draw', e);
    return res.status(500).json({ error: 'Erro ao sortear' });
  }
});

roundsRouter.post('/:roundId/draw/undo', async (req, res) => {
  const { roundId } = req.params;
  if (!isUuid(roundId)) {
    return res.status(400).json({ error: 'roundId inválido' });
  }
  try {
    if (!(await userOwnsRound(req.userId, roundId))) {
      return res.status(404).json({ error: 'Rodada não encontrada' });
    }
    const result = await undoLastDraw(roundId);
    broadcastToEvent(result.event_id, {
      type: 'draw_undone',
      payload: {
        roundId: result.round_id,
        roundNumber: result.round_number,
        number: result.number,
        drawOrder: result.draw_order,
        drawnAt: result.drawn_at,
      },
    });

    let winnersCleared = [];
    try {
      const reco = await reconcileSuggestedAfterUndo(roundId);
      winnersCleared = reco.cleared;
      if (reco.eventId) {
        for (const c of winnersCleared) {
          broadcastToEvent(reco.eventId, {
            type: 'winner_detected',
            payload: {
              phase: 'cleared',
              roundId: reco.roundId,
              roundNumber: reco.roundNumber,
              cardId: c.cardId,
              sheetId: c.sheetId,
              sheetNumber: c.sheetNumber,
              publicToken: c.publicToken,
            },
          });
        }
      }
    } catch (re) {
      console.error('[rounds] reconcile winners', re);
    }

    return res.json({ undone: result, winnersCleared });
  } catch (e) {
    if (e.statusCode === 400 || e.statusCode === 404) {
      return res.status(e.statusCode).json({ error: e.message });
    }
    console.error('[rounds] POST draw/undo', e);
    return res.status(500).json({ error: 'Erro ao desfazer sorteio' });
  }
});
