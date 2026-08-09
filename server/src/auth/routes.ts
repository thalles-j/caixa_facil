import { Router, type NextFunction, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { pool } from '../db.js';
import { loadBootstrapData } from '../business/bootstrap.js';
import { hashPassword, comparePassword } from './password.js';
import { signToken, verifyToken } from './jwt.js';

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

function asyncRoute(handler: AsyncRoute) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const RECOVERY_MESSAGE =
  'Se existir uma conta com este e-mail, as instruções de recuperação estarão disponíveis.';

authRouter.post('/register', asyncRoute(async (req, res) => {
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
  try {
    await pool.query('INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)', [
      id,
      normalizedEmail,
      passwordHash,
    ]);
  } catch (error) {
    // Tambem cobre dois cadastros simultaneos que passaram pelo SELECT acima.
    if (isUniqueViolation(error)) {
      return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });
    }
    throw error;
  }

  const token = signToken({ sub: id, email: normalizedEmail });
  res.status(201).json({ token, user: { id, email: normalizedEmail } });
}));

authRouter.post('/forgot-password', asyncRoute(async (req, res) => {
  const { email } = req.body ?? {};
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'E-mail inválido.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const result = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  const user = result.rows[0];
  if (!user) return res.json({ message: RECOVERY_MESSAGE });

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(token);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM password_reset_tokens
       WHERE user_id = $1 AND (used_at IS NULL OR expires_at < now())`,
      [user.id],
    );
    await client.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '30 minutes')`,
      [user.id, tokenHash],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  if (process.env.NODE_ENV !== 'production') {
    return res.json({ message: RECOVERY_MESSAGE, resetToken: token });
  }

  // Em producao, conecte aqui o provedor de e-mail e envie uma URL contendo o
  // token. A resposta continua generica para nao revelar contas cadastradas.
  return res.json({ message: RECOVERY_MESSAGE });
}));

authRouter.post('/reset-password', asyncRoute(async (req, res) => {
  const { token, password, confirmPassword } = req.body ?? {};
  if (typeof token !== 'string' || token.length < 32) {
    return res.status(400).json({ error: 'Link de recuperação inválido ou expirado.' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'As senhas não coincidem.' });
  }

  const passwordHash = await hashPassword(password);
  const tokenHash = hashResetToken(token);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tokenResult = await client.query(
      `SELECT id, user_id
       FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       FOR UPDATE`,
      [tokenHash],
    );
    const resetToken = tokenResult.rows[0];
    if (!resetToken) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Link de recuperação inválido ou expirado.' });
    }

    await client.query(
      'UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2',
      [passwordHash, resetToken.user_id],
    );
    await client.query(
      'UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
      [resetToken.user_id],
    );
    await client.query('COMMIT');
    return res.json({ message: 'Senha alterada com sucesso.' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

authRouter.post('/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const result = await pool.query('SELECT id, email, name, password_hash FROM users WHERE email = $1', [
    normalizedEmail,
  ]);
  const user = result.rows[0];
  if (!user || !(await comparePassword(password, user.password_hash))) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  const data = await loadBootstrapData({ id: user.id, email: user.email, name: user.name });
  const token = signToken({ sub: user.id, email: user.email });
  res.json({ token, user: { id: user.id, email: user.email }, data });
}));

authRouter.get('/me', asyncRoute(async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Token ausente.' });
  }
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }

  const result = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [payload.sub]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'Usuário da sessão não existe mais.' });

  const data = await loadBootstrapData({ id: user.id, email: user.email, name: user.name });
  return res.json({ user: { id: user.id, email: user.email }, data });
}));
