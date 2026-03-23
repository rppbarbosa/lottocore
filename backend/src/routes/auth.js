import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { createUser, getUserById, verifyUserLogin } from '../services/authService.js';
import { signAccessToken } from '../utils/jwt.js';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  try {
    const user = await createUser(req.body?.email, req.body?.password);
    const token = signAccessToken({ sub: user.id, email: user.email });
    return res.status(201).json({
      token,
      user: { id: user.id, email: user.email, created_at: user.created_at },
    });
  } catch (e) {
    if (e.statusCode) {
      return res.status(e.statusCode).json({ error: e.message });
    }
    console.error('[auth] register', e);
    return res.status(500).json({ error: 'Erro ao registar' });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const user = await verifyUserLogin(req.body?.email, req.body?.password);
    const token = signAccessToken({ sub: user.id, email: user.email });
    return res.json({
      token,
      user: { id: user.id, email: user.email, created_at: user.created_at },
    });
  } catch (e) {
    if (e.statusCode) {
      return res.status(e.statusCode).json({ error: e.message });
    }
    console.error('[auth] login', e);
    return res.status(500).json({ error: 'Erro ao iniciar sessão' });
  }
});

authRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await getUserById(req.userId);
    if (!user) {
      return res.status(401).json({ error: 'Utilizador não encontrado' });
    }
    return res.json({ user: { id: user.id, email: user.email, created_at: user.created_at } });
  } catch (e) {
    console.error('[auth] me', e);
    return res.status(500).json({ error: 'Erro ao carregar perfil' });
  }
});
