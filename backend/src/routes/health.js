import { Router } from 'express';
import { pool } from '../db.js';
import { config } from '../config.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      database: 'not_configured',
    });
  }
  try {
    await pool.query('SELECT 1');
    return res.json({ ok: true, database: 'up' });
  } catch (e) {
    return res.status(503).json({
      ok: false,
      database: 'down',
      message: config.nodeEnv === 'development' ? e.message : undefined,
    });
  }
});
