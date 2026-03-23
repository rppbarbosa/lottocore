import jwt from 'jsonwebtoken';
import { config } from '../config.js';

/** @param {{ sub: string, email: string }} payload */
export function signAccessToken(payload) {
  return jwt.sign(
    { sub: payload.sub, email: payload.email },
    config.jwtSecret,
    { expiresIn: '7d', algorithm: 'HS256' },
  );
}

/** @param {string} token */
export function verifyAccessToken(token) {
  const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('Token inválido');
  }
  const sub = /** @type {{ sub?: string; email?: string }} */ (decoded).sub;
  const email = /** @type {{ sub?: string; email?: string }} */ (decoded).email;
  if (!sub || typeof email !== 'string') {
    throw new Error('Token inválido');
  }
  return { sub, email };
}
