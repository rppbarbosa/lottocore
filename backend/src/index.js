import cors from 'cors';
import express from 'express';
import http from 'http';
import { config } from './config.js';
import { closePdfBrowser } from './pdfBrowser.js';
import { attachWebSocket } from './realtime.js';
import { authRouter } from './routes/auth.js';
import { cardsRouter } from './routes/cards.js';
import { eventsRouter } from './routes/events.js';
import { healthRouter } from './routes/health.js';
import { roundsRouter } from './routes/rounds.js';
import { publicSheetsRouter } from './routes/publicSheets.js';
import { sheetsRouter } from './routes/sheets.js';

if (config.nodeEnv === 'production' && !process.env.JWT_SECRET) {
  console.error('[LottoCore] JWT_SECRET é obrigatório em produção.');
  process.exit(1);
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '24mb' }));

app.get('/', (_req, res) => {
  res.json({
    name: 'LottoCore Bingo API',
    health: '/api/health',
    auth: 'POST /api/auth/login, /api/auth/register (JWT Bearer nas rotas /api/events, …)',
    websocket: `ws://localhost:${config.port}/ws?eventId=<uuid> (painel organizador)`,
    publicSheet: `GET /api/public/sheets/:token → folha completa (jogador)`,
  });
});

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/public/sheets', publicSheetsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/rounds', roundsRouter);
app.use('/api/cards', cardsRouter);
app.use('/api/sheets', sheetsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Não encontrado' });
});

const server = http.createServer(app);
const wss = attachWebSocket(server);

let shuttingDown = false;

function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[LottoCore] ${signal} — a libertar porta ${config.port}…`);

  const forceTimer = setTimeout(() => {
    console.error('[LottoCore] Timeout no encerramento; a sair.');
    process.exit(1);
  }, 8000);
  forceTimer.unref();

  for (const client of wss.clients) {
    try {
      client.terminate();
    } catch {
      /* ignore */
    }
  }

  wss.close(() => {
    server.close((err) => {
      clearTimeout(forceTimer);
      if (err) console.error('[LottoCore] Erro ao fechar HTTP:', err.message);
      void closePdfBrowser().finally(() => process.exit(0));
    });
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
if (process.platform === 'win32') {
  process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'));
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[LottoCore] Porta ${config.port} já está em uso.\n` +
        `  Causas comuns: (1) outro terminal com npm run dev no backend ou na raiz do repo; (2) processo Node antigo.\n` +
        `  • npm run dev   (no Windows já tenta libertar a porta antes de subir; volte a correr)\n` +
        `  • npm run dev:watch-only   — só se quiser evitar o “kill” automático no Windows\n` +
        `  • PowerShell:  Get-NetTCPConnection -LocalPort ${config.port} | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }\n` +
        `  • CMD:         netstat -ano | findstr :${config.port}   →   taskkill /PID <pid> /F`,
    );
    process.exit(1);
    return;
  }
  console.error(err);
  process.exit(1);
});

server.listen(config.port, () => {
  console.log(`API em http://localhost:${config.port}`);
  console.log(`WebSocket ws://localhost:${config.port}/ws?eventId=<uuid do evento>`);
});
