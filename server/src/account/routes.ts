import { Router, type NextFunction, type Request, type Response } from 'express';
import { withTenantTransaction } from '../db.js';
import { verifyToken } from '../auth/jwt.js';

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
