import { Router } from 'express';
import crypto from 'node:crypto';
import { pool } from '../db.js';
import { hashPassword, comparePassword } from './password.js';
import { signToken, verifyToken } from './jwt.js';

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

authRouter.post('/register', async (req, res) => {
  const { email, password, confirmPassword } = req.body ?? {};

  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'E-mail inválido.' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'As senhas não coincidem.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (existing.rowCount) {
    return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  await pool.query('INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)', [
    id,
    normalizedEmail,
    passwordHash,
  ]);

  const token = signToken({ sub: id, email: normalizedEmail });
  res.status(201).json({ token, user: { id, email: normalizedEmail } });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [
    normalizedEmail,
  ]);
  const user = result.rows[0];
  if (!user || !(await comparePassword(password, user.password_hash))) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  const token = signToken({ sub: user.id, email: user.email });
  res.json({ token, user: { id: user.id, email: user.email } });
});

authRouter.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Token ausente.' });
  }
  try {
    const payload = verifyToken(token);
    res.json({ user: { id: payload.sub, email: payload.email } });
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
});
