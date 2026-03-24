import QRCode from 'qrcode';
import { pool } from '../db.js';
import { config } from '../config.js';
import { getPdfBrowser } from '../pdfBrowser.js';
import { resolvePrintSettingsForPdf } from './printSettingsResolve.js';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeBaseUrl() {
  const raw = (config.publicAppUrl || 'http://localhost:5173').trim();
  return raw.replace(/\/$/, '');
}

/** Folha no PDF/UI: sempre 4 algarismos, máx. 9999. */
function formatSheetNumberPadded(n) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 0) return '0000';
  return String(Math.min(v, 9999)).padStart(4, '0');
}

/**
 * @param {unknown} grid
 * @returns {Array<Array<number|null>>|null}
 */
function parseGrid(grid) {
  if (grid == null) return null;
  if (typeof grid === 'string') {
    try {
      const p = JSON.parse(grid);
      return Array.isArray(p) ? p : null;
    } catch {
      return null;
    }
  }
  return Array.isArray(grid) ? grid : null;
}

/**
 * @param {Array<Array<number|null>>} grid
 */
function renderGridTable(grid) {
  if (!Array.isArray(grid) || grid.length !== 5) {
    return '<div class="err">Grid inválido</div>';
  }
  let html =
    '<table class="bingo-grid"><thead><tr><th>B</th><th>I</th><th>N</th><th>G</th><th>O</th></tr></thead><tbody>';
  for (let r = 0; r < 5; r++) {
    html += '<tr>';
    const row = grid[r];
    for (let c = 0; c < 5; c++) {
      const v = row?.[c];
      const text = v === null || v === undefined ? '★' : String(v);
      html += `<td>${escapeHtml(text)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

/**
 * @param {Record<string, unknown>} raw
 */
function pickPrintSettings(raw) {
  const empty = {
    headerImageDataUrl: null,
    subtitle: null,
    footerNote: null,
    footerImageDataUrl: null,
    backgroundImageDataUrl: null,
    backgroundOpacity: null,
  };
  if (!raw || typeof raw !== 'object') return empty;
  const header =
    typeof raw.headerImageDataUrl === 'string' && raw.headerImageDataUrl.startsWith('data:image/')
      ? raw.headerImageDataUrl
      : null;
  const footerImg =
    typeof raw.footerImageDataUrl === 'string' && raw.footerImageDataUrl.startsWith('data:image/')
      ? raw.footerImageDataUrl
      : null;
  const subtitle = typeof raw.subtitle === 'string' ? raw.subtitle : null;
  const footerNote = typeof raw.footerNote === 'string' ? raw.footerNote : null;
  const bg =
    typeof raw.backgroundImageDataUrl === 'string' && raw.backgroundImageDataUrl.startsWith('data:image/')
      ? raw.backgroundImageDataUrl
      : null;
  let backgroundOpacity = null;
  if (raw.backgroundOpacity != null && raw.backgroundOpacity !== '') {
    const n = Number(raw.backgroundOpacity);
    if (Number.isFinite(n)) {
      const u = n > 1 ? n / 100 : n;
      backgroundOpacity = Math.min(1, Math.max(0, u));
    }
  }
  return {
    headerImageDataUrl: header,
    subtitle,
    footerNote,
    footerImageDataUrl: footerImg,
    backgroundImageDataUrl: bg,
    backgroundOpacity: bg ? (backgroundOpacity != null ? backgroundOpacity : 0.14) : null,
  };
}

/**
 * @param {number} count
 */
function sheetBodyClassForCardCount(count) {
  if (count === 1) return 'sheet-body layout-1';
  if (count === 2) return 'sheet-body layout-2 compact';
  if (count === 3) return 'sheet-body layout-3 compact';
  if (count === 4) return 'sheet-body layout-4 compact';
  if (count === 5) return 'sheet-body layout-5 compact';
  return 'sheet-body layout-stack compact';
}

/**
 * @param {import('pg').QueryResultRow} card
 */
function renderCardSection(card) {
  const grid = parseGrid(card.grid);
  const roundLabel = escapeHtml(`Rodada ${card.round_number}`);
  return `
      <section class="card-block">
        <div class="card-panel">
          <div class="card-main">
            <div class="round-title">${roundLabel}</div>
            ${grid ? renderGridTable(grid) : '<div class="err">Sem grelha</div>'}
          </div>
        </div>
      </section>`;
}

/**
 * @param {'pdf'|'png'|'jpeg'} renderMode
 */
function buildHtml({ sheetNumber, cards, sheetQrDataUrl, printSettings, renderMode = 'pdf' }) {
  const docTitle = escapeHtml(`Folha ${sheetNumber}`);
  const sheetNumDigits = escapeHtml(formatSheetNumberPadded(sheetNumber));
  const sheetNumAria = escapeHtml(String(sheetNumber));
  const ps = pickPrintSettings(printSettings);
  const n = cards.length;
  const bodyClass = sheetBodyClassForCardCount(n);
  const modeClass =
    renderMode === 'png' ? 'mode-png' : renderMode === 'jpeg' ? 'mode-jpeg' : 'mode-pdf';

  const headerInner =
    ps.headerImageDataUrl || ps.subtitle
      ? `<div class="print-banner">
      ${ps.headerImageDataUrl ? `<img class="banner-img" src="${ps.headerImageDataUrl}" alt="" />` : ''}
      ${ps.subtitle ? `<div class="banner-subtitle">${escapeHtml(ps.subtitle)}</div>` : ''}
    </div>`
      : '';

  const footerBlock = ps.footerNote
    ? `<div class="page-footer">${escapeHtml(ps.footerNote)}</div>`
    : '';

  const footerImageBlock = ps.footerImageDataUrl
    ? `<div class="print-footer-banner"><img class="footer-banner-img" src="${ps.footerImageDataUrl}" alt="" /></div>`
    : '';

  const blocks =
    n === 5
      ? `<div class="layout-5-row layout-5-row--top">${cards
          .slice(0, 3)
          .map((card) => renderCardSection(card))
          .join('')}</div><div class="layout-5-row layout-5-row--bottom">${cards
          .slice(3, 5)
          .map((card) => renderCardSection(card))
          .join('')}</div>`
      : cards.map((card) => renderCardSection(card)).join('');
  const sheetQrBlock = sheetQrDataUrl
    ? `<div class="sheet-qr-wrap">
      <img class="sheet-qr-img" src="${sheetQrDataUrl}" alt="" />
      <p class="sheet-qr-caption">Conferir folha (telemóvel)</p>
    </div>`
    : '';

  const printFooterBlock = `<footer class="sheet-print-footer">${sheetQrBlock}${footerImageBlock}${footerBlock}</footer>`;

  const useWatermark =
    ps.backgroundImageDataUrl && (renderMode === 'pdf' || renderMode === 'jpeg' || renderMode === 'png');
  const wmOpacity =
    ps.backgroundOpacity != null && Number.isFinite(ps.backgroundOpacity)
      ? ps.backgroundOpacity
      : 0.14;
  const bgUrl = useWatermark
    ? ps.backgroundImageDataUrl.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    : '';
  const watermarkHtml = useWatermark
    ? `<div class="sheet-watermark" style="opacity:${wmOpacity};background-image:url(&quot;${bgUrl}&quot;)" aria-hidden="true"></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${docTitle}</title>
  <style>
    * { box-sizing: border-box; }
    html {
      margin: 0;
      padding: 0;
    }
    body {
      font-family: system-ui, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 0;
      color: #111;
      font-size: 9pt;
    }
    body.mode-pdf { background: #fff; }
    /* PNG/JPEG: mesmo fundo que o PDF para padronizar exportação (antes: PNG transparente destoava) */
    body.mode-png { background: #fff; }
    body.mode-jpeg { background: #fff; }

    /* PDF: sangria total da marca d'água (sem faixa branca nas bordas); conteúdo mantém recuo ~8 mm */
    @page {
      size: A4 portrait;
      margin: 0;
    }
    body.mode-pdf {
      width: 210mm;
      margin: 0;
      padding: 0;
    }

    .sheet-root { width: 100%; }
    .sheet-root--layered {
      position: relative;
    }
    .sheet-watermark {
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      background-repeat: no-repeat;
      background-position: center;
      background-size: cover;
    }
    body.mode-pdf .sheet-watermark {
      position: fixed;
      top: 0;
      left: 0;
      width: 210mm;
      height: 297mm;
      inset: auto;
      z-index: 0;
    }
    /* Raster: folha A4 lógica com marca d'água a cobrir toda a área (como no PDF) */
    body.mode-png .sheet-root--layered,
    body.mode-jpeg .sheet-root--layered {
      position: relative;
      min-height: 297mm;
    }
    body.mode-png .sheet-watermark,
    body.mode-jpeg .sheet-watermark {
      position: absolute;
      inset: 0;
      width: 100%;
      min-height: 297mm;
      background-size: cover;
      background-position: center;
    }
    .sheet-root__front {
      position: relative;
      z-index: 1;
    }
    /* PDF: sem padding vertical — cabeçalho encosta no topo, rodapé em baixo; laterais ~8 mm para cartelas */
    /* PDF: folha A4 cheia com flex — cabeçalho no topo, rodapé/imagens no fundo; zona central absorve o vazio (1–5 cartelas). layout-stack mantém fluxo natural (pode paginar). */
    body.mode-pdf .sheet-root__front {
      padding: 0 8mm 0 8mm;
      box-sizing: border-box;
    }
    body.mode-pdf .sheet-root__front:not(:has(.sheet-body.layout-stack)) {
      height: 297mm;
      min-height: 297mm;
      display: flex;
      flex-direction: column;
    }
    /* Rodapé / QR largura A4; sem padding inferior para a faixa encostar ao fundo da página */
    body.mode-pdf .sheet-root__front .sheet-print-footer {
      margin-left: -8mm;
      margin-right: -8mm;
      width: 210mm;
      max-width: none;
      box-sizing: border-box;
      margin-top: 0;
      margin-bottom: 0;
      padding-top: 0;
      padding-bottom: 0;
      flex-shrink: 0;
    }

    /* Raster: mesma largura útil que A4 retrato com margens ~8mm (210 − 16 ≈ 194mm) → layout vertical como o PDF */
    body.mode-png .sheet-root,
    body.mode-jpeg .sheet-root {
      width: 194mm;
      max-width: 194mm;
      margin: 0 auto;
      padding: 0;
    }

    /* Áreas reservadas para o organizador colar imagens (PDF) ou composição (PNG/JPEG) */
    .sheet-slot--top {
      min-height: 26mm;
      width: 100%;
    }
    .sheet-slot--bottom {
      min-height: 24mm;
      width: 100%;
      margin-top: 2mm;
    }

    .sheet-header-bar {
      width: 100%;
      margin-bottom: 1.5mm;
    }
    .sheet-header-bleed-wrap {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      justify-content: space-between;
      gap: 4mm;
      width: 100%;
    }
    .sheet-header-bar__left {
      flex: 1;
      min-width: 0;
    }
    /* PDF: cabeçalho encosta no topo da folha; sem padding/margem extra por baixo (ritmo vem do centro flex) */
    body.mode-pdf .sheet-header-bar {
      margin-top: 0;
      margin-bottom: 0;
      flex-shrink: 0;
    }
    body.mode-pdf .sheet-header-bleed-wrap {
      display: block;
      position: relative;
      width: 210mm;
      margin-left: -8mm;
      margin-right: -8mm;
      margin-top: 0;
      padding-top: 0;
      padding-bottom: 0;
    }
    body.mode-pdf .sheet-header-bleed-wrap .sheet-header-bar__left {
      width: 100%;
    }
    body.mode-pdf .sheet-header-bleed-wrap .sheet-number-badge {
      position: absolute;
      top: 7mm;
      right: 8mm;
      z-index: 3;
    }
    body.mode-pdf .sheet-header-bleed-wrap .print-banner {
      width: 100%;
      max-width: none;
      margin: 0;
      padding: 0;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    }
    body.mode-pdf .sheet-header-bleed-wrap .banner-img {
      width: 100%;
      max-width: 100%;
      max-height: 70mm;
      height: auto;
      object-fit: contain;
      object-position: center;
      display: block;
      margin: 0 auto;
    }
    body.mode-pdf .sheet-header-bleed-wrap .banner-subtitle {
      margin-top: 0.35mm;
      line-height: 1.25;
    }
    /* Raster: mesmo encarte do banner e badge absoluto que no PDF (largura útil 194mm) */
    body.mode-png .sheet-header-bar,
    body.mode-jpeg .sheet-header-bar {
      margin-top: 0;
      margin-bottom: 0;
      flex-shrink: 0;
    }
    body.mode-png .sheet-header-bleed-wrap,
    body.mode-jpeg .sheet-header-bleed-wrap {
      display: block;
      position: relative;
      width: 100%;
    }
    body.mode-png .sheet-header-bleed-wrap .sheet-header-bar__left,
    body.mode-jpeg .sheet-header-bleed-wrap .sheet-header-bar__left {
      width: 100%;
    }
    body.mode-png .sheet-header-bleed-wrap .sheet-number-badge,
    body.mode-jpeg .sheet-header-bleed-wrap .sheet-number-badge {
      position: absolute;
      top: 7mm;
      right: 0;
      z-index: 3;
    }
    body.mode-png .sheet-header-bleed-wrap .print-banner,
    body.mode-jpeg .sheet-header-bleed-wrap .print-banner {
      width: 100%;
      max-width: none;
      margin: 0;
      padding: 0;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    }
    body.mode-png .sheet-header-bleed-wrap .banner-img,
    body.mode-jpeg .sheet-header-bleed-wrap .banner-img {
      width: 100%;
      max-width: 100%;
      max-height: 70mm;
      height: auto;
      object-fit: contain;
      object-position: center;
      display: block;
      margin: 0 auto;
    }
    body.mode-png .sheet-header-bleed-wrap .banner-subtitle,
    body.mode-jpeg .sheet-header-bleed-wrap .banner-subtitle {
      margin-top: 0.35mm;
      line-height: 1.25;
    }
    .sheet-number-badge {
      flex-shrink: 0;
      align-self: flex-start;
      font-size: 9.5pt;
      font-weight: 800;
      padding: 1.15mm 3.25mm;
      border: 0.55pt solid #1a1a1a;
      border-radius: 999px;
      background: #f4f4f4;
      color: #111;
      letter-spacing: 0.06em;
      line-height: 1.2;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .sheet-number-badge .sheet-number-digits {
      color: #b91c1c;
      font-weight: 800;
      letter-spacing: 0.08em;
    }
    /* PDF: sem faixa personalizada, não reservar 26mm vazios no topo nem 24mm em baixo */
    body.mode-pdf .sheet-slot--top:empty,
    body.mode-png .sheet-slot--top:empty,
    body.mode-jpeg .sheet-slot--top:empty {
      display: none;
    }
    /* PDF: sem reserva vertical extra — a imagem define a altura */
    body.mode-pdf .sheet-slot--top:not(:empty),
    body.mode-png .sheet-slot--top:not(:empty),
    body.mode-jpeg .sheet-slot--top:not(:empty) {
      min-height: 0;
    }
    body.mode-pdf .sheet-slot--bottom,
    body.mode-png .sheet-slot--bottom,
    body.mode-jpeg .sheet-slot--bottom {
      min-height: 0;
      margin-top: 0;
      flex-shrink: 0;
    }

    .print-banner {
      text-align: center;
      margin-bottom: 2mm;
      page-break-inside: avoid;
    }
    .banner-img {
      max-height: 28mm;
      max-width: 100%;
      object-fit: contain;
      display: block;
      margin: 0 auto 1mm;
    }
    .banner-subtitle {
      font-size: 8pt;
      color: #333;
      font-weight: 500;
    }

    /* Rodapé: usar toda a largura útil; altura limitada para não comer a página — proporção preservada */
    .print-footer-banner {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 1.75mm auto 0;
      page-break-inside: avoid;
    }
    .footer-banner-img {
      display: block;
      width: auto;
      height: auto;
      max-width: 100%;
      max-height: 48mm;
      object-fit: contain;
      object-position: center;
      margin: 0 auto;
    }
    body.mode-pdf .footer-banner-img,
    body.mode-png .footer-banner-img,
    body.mode-jpeg .footer-banner-img {
      max-height: 58mm;
    }

    /* Painel da cartela: igual em PDF, PNG e JPEG (moldura e fundo #fafafa) */
    .card-panel {
      background: #fafafa;
      padding: 2.2mm 3.25mm;
      border: 0.5pt solid #d8d8d8;
      border-radius: 1.2mm;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 0;
      width: 100%;
      box-sizing: border-box;
    }

    .card-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    body.mode-pdf .sheet-body.compact .card-panel,
    body.mode-pdf .sheet-body.layout-1 .card-panel,
    body.mode-png .sheet-body.compact .card-panel,
    body.mode-png .sheet-body.layout-1 .card-panel,
    body.mode-jpeg .sheet-body.compact .card-panel,
    body.mode-jpeg .sheet-body.layout-1 .card-panel {
      align-items: center;
    }
    body.mode-pdf .sheet-body.compact .card-main,
    body.mode-pdf .sheet-body.layout-1 .card-main,
    body.mode-png .sheet-body.compact .card-main,
    body.mode-png .sheet-body.layout-1 .card-main,
    body.mode-jpeg .sheet-body.compact .card-main,
    body.mode-jpeg .sheet-body.layout-1 .card-main {
      align-items: center;
      width: 100%;
    }
    body.mode-pdf .sheet-body .bingo-grid,
    body.mode-png .sheet-body .bingo-grid,
    body.mode-jpeg .sheet-body .bingo-grid {
      flex-shrink: 0;
    }

    /* Células quadradas — mesmo tamanho em todos os modelos (1 a 5 cartelas + stack) */
    .sheet-body {
      width: 100%;
      --cell: 9.6mm;
    }

    .card-block {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      justify-content: center;
      gap: 2mm;
      margin-bottom: 0;
      page-break-inside: avoid;
    }
    .sheet-body.layout-1 .card-block {
      margin-bottom: 2mm;
      max-width: 192mm;
      margin-left: auto;
      margin-right: auto;
    }
    .sheet-body.layout-1 .card-panel {
      width: 100%;
      max-width: 54mm;
      margin-left: auto;
      margin-right: auto;
    }

    .round-title {
      margin: 0 0 1.1mm;
      font-weight: 700;
      font-size: 9pt;
      width: 100%;
      text-align: center;
      color: #2a2a2a;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .bingo-grid {
      border-collapse: collapse;
      table-layout: fixed;
      width: calc(5 * var(--cell));
      max-width: 100%;
      border: 0.5pt solid #1a1a1a;
      background: #fff;
    }
    .bingo-grid thead tr,
    .bingo-grid tbody tr {
      height: var(--cell);
    }
    .bingo-grid th,
    .bingo-grid td {
      border: 0.35pt solid #333;
      text-align: center;
      vertical-align: middle;
      width: var(--cell);
      min-width: var(--cell);
      height: var(--cell);
      min-height: var(--cell);
      max-width: var(--cell);
      max-height: var(--cell);
      font-size: 10pt;
      font-weight: 700;
      padding: 0;
      line-height: 1;
      overflow: hidden;
    }
    .bingo-grid thead th {
      background: #e8e8e8;
      color: #111;
      font-size: 9pt;
      font-weight: 800;
    }

    .sheet-body.layout-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3mm 7mm;
      align-items: stretch;
      justify-items: center;
    }
    .sheet-body.layout-3 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3mm 7mm;
      align-items: stretch;
      justify-items: center;
    }
    .sheet-body.layout-3 .card-block:nth-child(3) {
      grid-column: 1 / -1;
      justify-self: center;
      width: 100%;
      max-width: 54mm;
    }
    .sheet-body.layout-4 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: auto auto;
      gap: 3mm 7mm;
      align-items: stretch;
      justify-items: center;
    }
    /* 5 cartelas: 3 em cima + 2 em baixo (mesmo tamanho de cartela); linhas centradas */
    .sheet-body.layout-5 {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2.75mm;
      width: 100%;
      max-width: 192mm;
      margin: 0 auto;
    }
    .layout-5-row {
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      justify-content: center;
      align-items: flex-start;
      gap: 7mm;
    }
    /* PNG/JPEG: mesma coluna flex A4 que o PDF (PDF já define em .sheet-root__front acima) */
    body.mode-png .sheet-root__front:not(:has(.sheet-body.layout-stack)),
    body.mode-jpeg .sheet-root__front:not(:has(.sheet-body.layout-stack)) {
      min-height: 297mm;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      padding: 0;
    }
    body.mode-pdf .sheet-root__front:not(:has(.sheet-body.layout-stack)) .sheet-body,
    body.mode-png .sheet-root__front:not(:has(.sheet-body.layout-stack)) .sheet-body,
    body.mode-jpeg .sheet-root__front:not(:has(.sheet-body.layout-stack)) .sheet-body {
      flex: 1 1 auto;
      min-height: 0;
      align-self: stretch;
      margin-top: 0;
      margin-bottom: 0;
    }
    body.mode-pdf .sheet-root__front:not(:has(.sheet-body.layout-stack)) .sheet-body.layout-1,
    body.mode-png .sheet-root__front:not(:has(.sheet-body.layout-stack)) .sheet-body.layout-1,
    body.mode-jpeg .sheet-root__front:not(:has(.sheet-body.layout-stack)) .sheet-body.layout-1 {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }
    body.mode-pdf .sheet-root__front:not(:has(.sheet-body.layout-stack)) .sheet-body.layout-2,
    body.mode-pdf .sheet-root__front:not(:has(.sheet-body.layout-stack)) .sheet-body.layout-3,
    body.mode-pdf .sheet-root__front:not(:has(.sheet-body.layout-stack)) .sheet-body.layout-4,
    body.mode-png .sheet-root__front:not(:has(.sheet-body.layout-stack)) .sheet-body.layout-2,
    body.mode-png .sheet-root__front:not(:has(.sheet-body.layout-stack)) .sheet-body.layout-3,
    body.mode-png .sheet-root__front:not(:has(.sheet-body.layout-stack)) .sheet-body.layout-4,
    body.mode-jpeg .sheet-root__front:not(:has(.sheet-body.layout-stack)) .sheet-body.layout-2,
    body.mode-jpeg .sheet-root__front:not(:has(.sheet-body.layout-stack)) .sheet-body.layout-3,
    body.mode-jpeg .sheet-root__front:not(:has(.sheet-body.layout-stack)) .sheet-body.layout-4 {
      align-content: center;
    }
    body.mode-pdf .layout-5-row,
    body.mode-png .layout-5-row,
    body.mode-jpeg .layout-5-row {
      gap: 5mm;
    }
    body.mode-pdf .sheet-root__front:not(:has(.sheet-body.layout-stack)) .sheet-body.layout-5,
    body.mode-png .sheet-root__front:not(:has(.sheet-body.layout-stack)) .sheet-body.layout-5,
    body.mode-jpeg .sheet-root__front:not(:has(.sheet-body.layout-stack)) .sheet-body.layout-5 {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 2.5mm;
    }
    .sheet-body.layout-stack {
      display: flex;
      flex-direction: column;
      gap: 2.75mm;
      align-items: center;
    }

    .sheet-body.compact .card-block {
      flex-direction: column;
      align-items: center;
      gap: 0;
    }
    .sheet-body.compact .card-panel {
      flex-direction: column;
      align-items: center;
      width: 100%;
      max-width: 54mm;
    }

    .sheet-print-footer {
      width: 100%;
      margin-top: 1.25mm;
      padding-top: 1.5mm;
      border-top: 0.35pt solid #c8c8c8;
      page-break-inside: avoid;
      text-align: center;
    }
    body.mode-pdf .print-footer-banner,
    body.mode-png .print-footer-banner,
    body.mode-jpeg .print-footer-banner {
      margin-top: 0;
      margin-bottom: 0;
    }
    body.mode-png .sheet-root__front .sheet-print-footer,
    body.mode-jpeg .sheet-root__front .sheet-print-footer {
      flex-shrink: 0;
    }

    .sheet-qr-wrap {
      text-align: center;
      margin: 0 auto 0.5mm;
      page-break-inside: avoid;
      display: inline-block;
      background: #fff;
      padding: 1.35mm 1.5mm 1mm;
      border-radius: 1mm;
      border: 0.4pt solid #ddd;
      box-sizing: border-box;
    }
    body.mode-pdf .sheet-qr-wrap,
    body.mode-png .sheet-qr-wrap,
    body.mode-jpeg .sheet-qr-wrap {
      margin: 0 auto;
      padding: 0.65mm 1mm 0.5mm;
    }
    .sheet-qr-img {
      display: block;
      margin: 0 auto 0.35mm;
      width: 20mm;
      height: 20mm;
    }
    .sheet-qr-caption {
      margin: 0;
      font-size: 6.5pt;
      color: #444;
      font-weight: 500;
    }

    .page-footer {
      margin-top: 1.5mm;
      padding-top: 0;
      border-top: none;
      font-size: 6pt;
      color: #444;
      text-align: center;
    }
    body.mode-pdf .page-footer {
      margin-top: 1mm;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    body.mode-png .page-footer {
      background: transparent;
    }
    body.mode-jpeg .page-footer {
      background: transparent;
    }
    .err { color: #c00; font-size: 8pt; }
  </style>
</head>
<body class="${modeClass}">
  <div class="sheet-root sheet-root--layered">
    ${watermarkHtml}
    <div class="sheet-root__front">
    <header class="sheet-header-bar">
      <div class="sheet-header-bleed-wrap">
        <div class="sheet-header-bar__left">
          <div class="sheet-slot sheet-slot--top">${headerInner}</div>
        </div>
        <div class="sheet-number-badge" role="status" aria-label="Folha número ${sheetNumAria}">Nº <span class="sheet-number-digits">${sheetNumDigits}</span></div>
      </div>
    </header>
    <div class="${bodyClass}">
      ${blocks}
    </div>
    <div class="sheet-slot sheet-slot--bottom" aria-hidden="true"></div>
    ${printFooterBlock}
    </div>
  </div>
</body>
</html>`;
}

export async function loadSheetForPdf(sheetId) {
  const { rows: sheetRows } = await pool.query(
    `SELECT s.id, s.sheet_number, s.event_id, s.public_token, e.name AS event_name,
            COALESCE(e.print_settings, '{}'::jsonb) AS print_settings
     FROM sheets s
     INNER JOIN events e ON e.id = s.event_id
     WHERE s.id = $1`,
    [sheetId],
  );
  const sheet = sheetRows[0];
  if (!sheet) return null;

  const { rows: cards } = await pool.query(
    `SELECT c.grid, r.round_number
     FROM cards c
     INNER JOIN rounds r ON r.id = c.round_id
     WHERE c.sheet_id = $1
     ORDER BY r.round_number ASC`,
    [sheetId],
  );

  return { sheet, cards };
}

async function buildSheetHtmlForBrowser(sheetId, renderMode) {
  const loaded = await loadSheetForPdf(sheetId);
  if (!loaded) {
    const e = new Error('Folha não encontrada');
    e.statusCode = 404;
    throw e;
  }
  const { sheet, cards } = loaded;
  if (!cards.length) {
    const e = new Error('Folha sem cartelas');
    e.statusCode = 400;
    throw e;
  }
  if (cards.length > 5) {
    const e = new Error('Folha com demasiadas cartelas');
    e.statusCode = 400;
    throw e;
  }

  const printSettingsRaw =
    sheet.print_settings && typeof sheet.print_settings === 'object' ? sheet.print_settings : {};
  const printSettings = await resolvePrintSettingsForPdf(sheet.event_id, printSettingsRaw);

  if (!sheet.public_token) {
    const e = new Error('Folha sem token público — execute as migrações');
    e.statusCode = 500;
    throw e;
  }

  const base = normalizeBaseUrl();
  const sheetUrl = `${base}/f/${sheet.public_token}`;
  const qrOpts = {
    width: 280,
    margin: 1,
    errorCorrectionLevel: 'H',
  };
  const sheetQrDataUrl = await QRCode.toDataURL(sheetUrl, qrOpts);

  const html = buildHtml({
    sheetNumber: sheet.sheet_number,
    cards,
    sheetQrDataUrl,
    printSettings,
    renderMode,
  });

  return { html, sheetNumber: sheet.sheet_number };
}

export async function generateSheetPdfBuffer(sheetId) {
  const { html, sheetNumber } = await buildSheetHtmlForBrowser(sheetId, 'pdf');

  const browser = await getPdfBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load', timeout: 45_000 });
    await new Promise((r) => setTimeout(r, 300));
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      timeout: 60_000,
    });
    return { buffer, sheetNumber };
  } finally {
    await page.close();
  }
}

/** Largura CSS (~194mm a 96dpi) para screenshot retrato alinhado ao PDF. */
const RASTER_VIEWPORT_WIDTH_PX = 734;

/**
 * Imagem da folha (raster), retrato A4 lógico. PNG e JPEG usam o mesmo HTML/CSS que o PDF (marca d'água, painéis, tipografia).
 * @param {'png'|'jpeg'} format
 */
export async function generateSheetRasterBuffer(sheetId, format) {
  if (format !== 'png' && format !== 'jpeg') {
    const e = new Error('Formato inválido');
    e.statusCode = 400;
    throw e;
  }

  const renderMode = format === 'png' ? 'png' : 'jpeg';
  const { html, sheetNumber } = await buildSheetHtmlForBrowser(sheetId, renderMode);

  const browser = await getPdfBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({
      width: RASTER_VIEWPORT_WIDTH_PX,
      height: 1123,
      deviceScaleFactor: 2,
    });
    await page.setContent(html, { waitUntil: 'load', timeout: 45_000 });
    await new Promise((r) => setTimeout(r, 400));

    const shot =
      format === 'jpeg'
        ? await page.screenshot({
            type: 'jpeg',
            fullPage: true,
            omitBackground: false,
            quality: 92,
          })
        : await page.screenshot({
            type: 'png',
            fullPage: true,
            omitBackground: false,
          });

    const buffer = Buffer.isBuffer(shot) ? shot : Buffer.from(shot);
    return { buffer, sheetNumber, format };
  } finally {
    await page.close();
  }
}
