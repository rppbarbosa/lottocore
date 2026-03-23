import { Router } from 'express';
import { getPublicSheetByToken } from '../services/publicSheetService.js';

export const publicSheetsRouter = Router();

publicSheetsRouter.get('/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const data = await getPublicSheetByToken(token);
    if (!data) {
      return res.status(404).json({ error: 'Folha não encontrada' });
    }
    return res.json(data);
  } catch (e) {
    if (e.statusCode === 400) {
      return res.status(400).json({ error: e.message });
    }
    console.error('[public/sheets]', e);
    return res.status(500).json({ error: 'Erro ao carregar folha' });
  }
});
