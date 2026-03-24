import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { userOwnsSheet } from '../services/eventAccess.js';
import { generateSheetPdfBuffer, generateSheetRasterBuffer } from '../services/sheetPdfService.js';
import {
  markSheetSold,
  patchSheetSaleStatus,
  updateSheetSaleDetails,
} from '../services/sheetService.js';
import { isUuid } from '../utils/uuid.js';

export const sheetsRouter = Router();
sheetsRouter.use(requireAuth);

const SALE_DETAIL_KEYS = new Set([
  'buyerName',
  'buyer_name',
  'buyerWhatsapp',
  'buyer_whatsapp',
  'buyerContact',
  'buyer_contact',
  'buyerEmail',
  'buyer_email',
  'buyerAddress',
  'buyer_address',
  'buyerStreet',
  'buyer_street',
  'buyerStreetNumber',
  'buyer_street_number',
  'buyerAddressComplement',
  'buyer_address_complement',
  'buyerNeighborhood',
  'buyer_neighborhood',
  'buyerCity',
  'buyer_city',
  'buyerState',
  'buyer_state',
  'buyerCep',
  'buyer_cep',
  'sellerName',
  'seller_name',
  'salePriceCents',
  'sale_price_cents',
  'amountPaidCents',
  'amount_paid_cents',
]);

function bodyHasSaleDetails(body) {
  if (!body || typeof body !== 'object') return false;
  return Object.keys(body).some((k) => SALE_DETAIL_KEYS.has(k));
}

sheetsRouter.patch('/:sheetId', async (req, res) => {
  const { sheetId } = req.params;
  if (!isUuid(sheetId)) {
    return res.status(400).json({ error: 'sheetId inválido' });
  }
  const status = req.body?.sale_status ?? req.body?.saleStatus;
  const hasStatus = status !== undefined && status !== null && status !== '';
  const hasDetails = bodyHasSaleDetails(req.body);

  if (hasStatus && hasDetails) {
    return res
      .status(400)
      .json({ error: 'Envie sale_status ou dados de venda, não ambos no mesmo pedido' });
  }

  try {
    if (!(await userOwnsSheet(req.userId, sheetId))) {
      return res.status(404).json({ error: 'Folha não encontrada' });
    }

    if (hasStatus) {
      if (status !== 'cancelled' && status !== 'available') {
        return res.status(400).json({ error: 'sale_status deve ser cancelled ou available (reativar)' });
      }
      const sheet = await patchSheetSaleStatus(sheetId, status);
      return res.json({ sheet });
    }

    if (hasDetails) {
      const sheet = await updateSheetSaleDetails(sheetId, req.body || {});
      return res.json({ sheet });
    }

    return res.status(400).json({ error: 'Indique sale_status ou dados de venda (comprador/pagamento)' });
  } catch (e) {
    if (e.statusCode === 400) {
      return res.status(400).json({ error: e.message });
    }
    console.error('[sheets] PATCH', e);
    return res.status(500).json({ error: 'Erro ao atualizar folha' });
  }
});

sheetsRouter.get('/:sheetId/export', async (req, res) => {
  const { sheetId } = req.params;
  if (!isUuid(sheetId)) {
    return res.status(400).json({ error: 'sheetId inválido' });
  }
  const raw = String(req.query.format ?? '').toLowerCase();
  const format = raw === 'jpg' ? 'jpeg' : raw;
  if (format !== 'png' && format !== 'jpeg') {
    return res.status(400).json({ error: 'Indique format=png ou format=jpeg' });
  }
  try {
    if (!(await userOwnsSheet(req.userId, sheetId))) {
      return res.status(404).json({ error: 'Folha não encontrada' });
    }
    const { buffer, sheetNumber } = await generateSheetRasterBuffer(sheetId, format);
    const bodyBuf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    if (format === 'png') {
      const ok =
        bodyBuf.length >= 24 &&
        bodyBuf[0] === 0x89 &&
        bodyBuf[1] === 0x50 &&
        bodyBuf[2] === 0x4e &&
        bodyBuf[3] === 0x47;
      if (!ok) {
        console.error('[sheets] png inválido', { len: bodyBuf.length });
        return res.status(500).json({ error: 'Falha ao gerar PNG.' });
      }
    } else {
      const ok = bodyBuf.length >= 4 && bodyBuf[0] === 0xff && bodyBuf[1] === 0xd8 && bodyBuf[2] === 0xff;
      if (!ok) {
        console.error('[sheets] jpeg inválido', { len: bodyBuf.length });
        return res.status(500).json({ error: 'Falha ao gerar JPEG.' });
      }
    }
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const filename = `bingo-folha-${sheetNumber}.${ext}`;
    res.setHeader('Content-Type', format === 'png' ? 'image/png' : 'image/jpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(bodyBuf.length));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.end(bodyBuf);
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 400) {
      return res.status(e.statusCode).json({ error: e.message });
    }
    console.error('[sheets] export image', e);
    return res.status(500).json({ error: 'Erro ao gerar imagem' });
  }
});

sheetsRouter.get('/:sheetId/pdf', async (req, res) => {
  const { sheetId } = req.params;
  if (!isUuid(sheetId)) {
    return res.status(400).json({ error: 'sheetId inválido' });
  }
  try {
    if (!(await userOwnsSheet(req.userId, sheetId))) {
      return res.status(404).json({ error: 'Folha não encontrada' });
    }
    const { buffer, sheetNumber } = await generateSheetPdfBuffer(sheetId);
    const pdf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    if (pdf.length < 200 || pdf.subarray(0, 4).toString('latin1') !== '%PDF') {
      console.error('[sheets] pdf inválido', {
        len: pdf.length,
        headHex: pdf.subarray(0, 24).toString('hex'),
      });
      return res.status(500).json({ error: 'Falha ao gerar PDF (ficheiro inválido). Tente novamente.' });
    }
    const filename = `bingo-folha-${sheetNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(pdf.length));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.end(pdf);
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 400) {
      return res.status(e.statusCode).json({ error: e.message });
    }
    console.error('[sheets] pdf', e);
    return res.status(500).json({ error: 'Erro ao gerar PDF' });
  }
});

sheetsRouter.post('/:sheetId/sell', async (req, res) => {
  const { sheetId } = req.params;
  if (!isUuid(sheetId)) {
    return res.status(400).json({ error: 'sheetId inválido' });
  }
  try {
    if (!(await userOwnsSheet(req.userId, sheetId))) {
      return res.status(404).json({ error: 'Folha não encontrada' });
    }
    const sheet = await markSheetSold(sheetId, req.body || {});
    return res.json({ sheet });
  } catch (e) {
    if (e.statusCode === 400) {
      return res.status(400).json({ error: e.message });
    }
    console.error('[sheets] sell', e);
    return res.status(500).json({ error: 'Erro ao registrar venda' });
  }
});
