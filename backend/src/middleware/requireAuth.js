import { verifyAccessToken } from '../utils/jwt.js';

/**
 * JWT em `Authorization: Bearer <token>`.
 * Define req.userId e req.userEmail.
 */
export function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const m = /^Bearer\s+(\S+)$/i.exec(header);
  if (!m) {
    return res.status(401).json({ error: 'Sessão em falta. Inicie sessão.' });
  }
  try {
    const { sub, email } = verifyAccessToken(m[1]);
    req.userId = sub;
    req.userEmail = email;
    return next();
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada' });
  }
}
