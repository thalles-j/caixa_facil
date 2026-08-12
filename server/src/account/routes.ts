import { Router, type NextFunction, type Request, type Response } from 'express';
import { getPool, withTenantTransaction } from '../db.js';
import { verifyToken } from '../auth/jwt.js';
import { comparePassword, hashPassword } from '../auth/password.js';

export const accountRouter = Router();

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

function asyncRoute(handler: AsyncRoute) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

function authenticatedUserId(req: Request): string | null {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    return verifyToken(token).sub;
  } catch {
    return null;
  }
}

accountRouter.delete('/data', asyncRoute(async (req, res) => {
  const userId = authenticatedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Token inválido ou expirado.' });

  await withTenantTransaction(userId, async (client) => {
    // Ordem determinada pelas FKs. A conta em users nao e removida, portanto
    // e-mail, hash da senha e capacidade de login permanecem intactos.
    const tables = [
      'transactions',
      'credit_sales',
      'sale_items',
      'sales',
      'cash_sessions',
      'fixed_expenses',
      'products',
      'categories',
      'customers',
    ];

    for (const table of tables) {
      await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
    }
  });

  return res.status(204).send();
}));

accountRouter.patch('/password', asyncRoute(async (req, res) => {
  const userId = authenticatedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Token inválido ou expirado.' });

  const { currentPassword, newPassword, confirmPassword } = req.body ?? {};
  if (typeof currentPassword !== 'string' || !currentPassword) {
    return res.status(400).json({ error: 'Informe sua senha atual.' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'A confirmação da nova senha não confere.' });
  }

  const result = await getPool().query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  const account = result.rows[0];
  if (!account || !(await comparePassword(currentPassword, account.password_hash))) {
    return res.status(400).json({ error: 'A senha atual está incorreta.' });
  }
  if (await comparePassword(newPassword, account.password_hash)) {
    return res.status(400).json({ error: 'A nova senha precisa ser diferente da senha atual.' });
  }

  const passwordHash = await hashPassword(newPassword);
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [passwordHash, userId]);
    await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return res.json({ message: 'Senha alterada com sucesso.' });
}));
