import bcrypt from 'bcrypt';
import { pool } from '../db.js';

const BCRYPT_ROUNDS = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

export function validateEmail(email) {
  const e = normalizeEmail(email);
  return EMAIL_RE.test(e) && e.length <= 254 ? e : null;
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return null;
  }
  return password;
}

export async function createUser(emailRaw, passwordRaw) {
  const email = validateEmail(emailRaw);
  const password = validatePassword(passwordRaw);
  if (!email) {
    const err = new Error('Email inválido');
    err.statusCode = 400;
    throw err;
  }
  if (!password) {
    const err = new Error('Palavra-passe deve ter entre 8 e 128 caracteres');
    err.statusCode = 400;
    throw err;
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2)
       RETURNING id, email, created_at`,
      [email, passwordHash],
    );
    return rows[0];
  } catch (e) {
    if (e.code === '23505') {
      const err = new Error('Este email já está registado');
      err.statusCode = 409;
      throw err;
    }
    throw e;
  }
}

export async function verifyUserLogin(emailRaw, passwordRaw) {
  const email = validateEmail(emailRaw);
  const password = typeof passwordRaw === 'string' ? passwordRaw : '';
  if (!email) {
    const err = new Error('Credenciais inválidas');
    err.statusCode = 401;
    throw err;
  }
  const { rows } = await pool.query(
    `SELECT id, email, password_hash, created_at FROM users WHERE LOWER(email) = LOWER($1)`,
    [email],
  );
  const row = rows[0];
  if (!row) {
    const err = new Error('Credenciais inválidas');
    err.statusCode = 401;
    throw err;
  }
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    const err = new Error('Credenciais inválidas');
    err.statusCode = 401;
    throw err;
  }
  return { id: row.id, email: row.email, created_at: row.created_at };
}

export async function getUserById(userId) {
  const { rows } = await pool.query(
    `SELECT id, email, created_at FROM users WHERE id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}
