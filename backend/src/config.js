import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

const defaultJwtDev = 'dev_jwt_secret_altere_em_producao_min_32_chars!!';

export const config = {
  port: Number(process.env.PORT) || 3003,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  /** HS256 para sessões do painel (obrigatório em produção). */
  jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : defaultJwtDev),
  /** Base URL do site (QR e PDF). Sem barra final. */
  publicAppUrl: (process.env.PUBLIC_APP_URL || 'http://localhost:5173').trim(),
};
