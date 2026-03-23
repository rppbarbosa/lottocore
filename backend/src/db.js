import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool =
  config.databaseUrl &&
  new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

export async function query(text, params) {
  if (!pool) {
    throw new Error('DATABASE_URL não configurado');
  }
  return pool.query(text, params);
}
