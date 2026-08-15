import { Router, type NextFunction, type Request, type Response } from 'express';
import { verifyToken } from '../auth/jwt.js';
import { withTenantTransaction } from '../db.js';
import { loadBootstrapData } from './bootstrap.js';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
type AuthenticatedUser = { id: string; email: string };

const PAYMENT_METHODS = new Set(['dinheiro', 'pix', 'cartao_credito', 'cartao_debito']);
const SALE_PAYMENT_METHODS = new Set([...PAYMENT_METHODS, 'fiado']);
const ENTRY_KINDS = new Set(['produto', 'servico', 'gorjeta']);
const EXPENSE_KINDS = new Set([
  'mercadoria',
  'fornecedor',
  'aluguel',
  'energia',
  'agua',
  'internet',
  'funcionario',
  'combustivel',
  'impostos',
  'outros',
]);
const FIXED_EXPENSE_RECURRENCES = new Set(['weekly', 'monthly']);

export const businessRouter = Router();

function asyncRoute(handler: AsyncRoute) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

function authenticatedUser(req: Request): AuthenticatedUser | null {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

function requireUser(req: Request): AuthenticatedUser {
  const user = authenticatedUser(req);
  if (!user) throw Object.assign(new Error('Token inválido ou expirado.'), { status: 401 });
  return user;
}

function positiveMoney(value: unknown, field = 'valor'): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${field} deve ser maior que zero.`), { status: 400 });
  }
  return Math.round(parsed * 100) / 100;
}

function nonNegativeMoney(value: unknown, field = 'valor'): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw Object.assign(new Error(`${field} não pode ser negativo.`), { status: 400 });
  }
  return Math.round(parsed * 100) / 100;
}

function requiredText(value: unknown, field: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw Object.assign(new Error(`${field} é obrigatório.`), { status: 400 });
  return text;
}

async function currentOpenSession(client: import('pg').PoolClient, userId: string) {
  const result = await client.query(
    `SELECT id FROM cash_sessions WHERE user_id = $1 AND status = 'open' FOR SHARE`,
    [userId],
  );
  if (!result.rowCount) {
    throw Object.assign(new Error('O caixa está fechado. Abra um novo caixa para registrar movimentações.'), {
      status: 409,
      code: 'CASH_CLOSED',
    });
  }
  return result.rows[0].id as string;
}

async function responseData(user: AuthenticatedUser) {
  return loadBootstrapData({ id: user.id, email: user.email, name: null });
}

businessRouter.get('/data', asyncRoute(async (req, res) => {
  const user = requireUser(req);
  return res.json({ data: await responseData(user) });
}));

businessRouter.post('/customers', asyncRoute(async (req, res) => {
  const user = requireUser(req);
  const name = requiredText(req.body?.name, 'Nome');
  const phone = String(req.body?.phone ?? '').trim() || null;

  const customer = await withTenantTransaction(user.id, async (client) => {
    const result = await client.query(
      `INSERT INTO customers (name, phone) VALUES ($1, $2) RETURNING id, name, phone`,
      [name, phone],
    );
    return result.rows[0];
  });

  return res.status(201).json({
    customer: { id: customer.id, nome: customer.name, telefone: customer.phone ?? undefined },
    data: await responseData(user),
  });
}));

businessRouter.post('/sales', asyncRoute(async (req, res) => {
  const user = requireUser(req);
  const paymentMethod = String(req.body?.paymentMethod ?? '');
  const customerId = req.body?.customerId ? String(req.body.customerId) : null;
  const items = Array.isArray(req.body?.items) ? req.body.items : [];

  if (!SALE_PAYMENT_METHODS.has(paymentMethod)) {
    throw Object.assign(new Error('Forma de pagamento inválida.'), { status: 400 });
  }
  if (paymentMethod === 'fiado' && !customerId) {
    throw Object.assign(new Error('Selecione um cliente para registrar uma venda fiado.'), { status: 400 });
  }
  if (paymentMethod !== 'fiado' && customerId) {
    throw Object.assign(new Error('Cliente de fiado só pode ser informado quando a forma for Fiado.'), { status: 400 });
  }
  if (items.length === 0) throw Object.assign(new Error('Adicione ao menos um item.'), { status: 400 });

  await withTenantTransaction(user.id, async (client) => {
    const sessionId = await currentOpenSession(client, user.id);
    const normalizedItems: Array<{
      productId: string | null;
      description: string;
      quantity: number;
      unitPrice: number;
      unitCost: number;
    }> = [];

    for (const rawItem of items) {
      const productId = rawItem?.productId ? String(rawItem.productId) : null;
      const quantity = positiveMoney(rawItem?.quantity, 'Quantidade');
      const unitPrice = positiveMoney(rawItem?.unitPrice, 'Valor unitário');
      let description = requiredText(rawItem?.description, 'Descrição');
      let unitCost = 0;

      if (productId) {
        const productResult = await client.query(
          `SELECT id, kind, name, cost_price, stock_quantity
             FROM products WHERE user_id = $1 AND id = $2 AND active FOR UPDATE`,
          [user.id, productId],
        );
        if (!productResult.rowCount) {
          throw Object.assign(new Error(`Produto ou serviço não encontrado: ${description}.`), { status: 404 });
        }
        const product = productResult.rows[0];
        description = product.name;
        unitCost = Number(product.cost_price);
        if (product.kind === 'product') {
          const update = await client.query(
            `UPDATE products SET stock_quantity = stock_quantity - $3
             WHERE user_id = $1 AND id = $2 AND stock_quantity >= $3`,
            [user.id, productId, quantity],
          );
          if (!update.rowCount) {
            throw Object.assign(new Error(`Estoque insuficiente para ${description}.`), { status: 409 });
          }
        }
      }

      normalizedItems.push({ productId, description, quantity, unitPrice, unitCost });
    }

    const total = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const saleResult = await client.query(
      `INSERT INTO sales
        (cash_session_id, customer_id, description, payment_method, total_amount)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, sold_at`,
      [sessionId, customerId, normalizedItems.map((item) => item.description).join(', '), paymentMethod, total],
    );
    const sale = saleResult.rows[0];

    for (const item of normalizedItems) {
      await client.query(
        `INSERT INTO sale_items
          (sale_id, product_id, product_name, quantity, unit_price, unit_cost)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [sale.id, item.productId, item.description, item.quantity, item.unitPrice, item.unitCost],
      );
    }

    if (paymentMethod === 'fiado') {
      await client.query(
        `INSERT INTO credit_sales (sale_id, customer_id, amount, due_date)
         VALUES ($1, $2, $3, CURRENT_DATE)`,
        [sale.id, customerId, total],
      );
    } else {
      await client.query(
        `INSERT INTO transactions
          (cash_session_id, sale_id, type, source, payment_method, amount, description, occurred_at)
         VALUES ($1, $2, 'entrada', 'venda', $3, $4, $5, $6)`,
        [sessionId, sale.id, paymentMethod, total, `Venda: ${normalizedItems.map((item) => item.description).join(', ')}`, sale.sold_at],
      );
    }
  });

  return res.status(201).json({ data: await responseData(user) });
}));

businessRouter.post('/transactions', asyncRoute(async (req, res) => {
  const user = requireUser(req);
  const type = String(req.body?.type ?? '');
  const description = requiredText(req.body?.description, 'Descrição');
  const amount = positiveMoney(req.body?.amount);
  const paymentMethod = String(req.body?.paymentMethod ?? 'dinheiro');
  const entryKind = req.body?.entryKind ? String(req.body.entryKind) : null;
  const expenseKind = req.body?.expenseKind ? String(req.body.expenseKind) : null;
  const requestedMovementKind = String(req.body?.movementKind ?? 'regular');

  if (!['entrada', 'saida'].includes(type)) throw Object.assign(new Error('Tipo de movimentação inválido.'), { status: 400 });
  if (!PAYMENT_METHODS.has(paymentMethod)) {
    throw Object.assign(new Error('Fiado não é uma forma válida para entrada manual.'), { status: 400 });
  }
  if (entryKind && !ENTRY_KINDS.has(entryKind)) throw Object.assign(new Error('Tipo de entrada inválido.'), { status: 400 });
  if (expenseKind && !EXPENSE_KINDS.has(expenseKind)) {
    throw Object.assign(new Error('Categoria de despesa inválida.'), { status: 400 });
  }
  if (type === 'entrada' && expenseKind) {
    throw Object.assign(new Error('Categoria de despesa não pode ser usada em uma entrada.'), { status: 400 });
  }
  if (type === 'saida' && entryKind) {
    throw Object.assign(new Error('Tipo de entrada não pode ser usado em uma despesa.'), { status: 400 });
  }
  if (requestedMovementKind === 'suprimento' && (type !== 'entrada' || paymentMethod !== 'dinheiro')) {
    throw Object.assign(new Error('Suprimento deve ser uma entrada em dinheiro.'), { status: 400 });
  }
  if (type === 'entrada' && requestedMovementKind !== 'suprimento' && !entryKind) {
    throw Object.assign(new Error('Selecione se a entrada é Produto, Serviço ou Gorjeta.'), { status: 400 });
  }
  const movementKind = paymentMethod === 'dinheiro' && type === 'saida'
    ? 'sangria'
    : paymentMethod === 'dinheiro' && requestedMovementKind === 'suprimento'
      ? 'suprimento'
      : 'regular';
  const pending =
    (type === 'entrada' && ['produto', 'servico'].includes(entryKind ?? '')) ||
    (type === 'saida' && !expenseKind);

  await withTenantTransaction(user.id, async (client) => {
    const sessionId = await currentOpenSession(client, user.id);
    await client.query(
      `INSERT INTO transactions
        (cash_session_id, type, source, payment_method, amount, description,
         movement_kind, entry_kind, expense_kind, identification_pending)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        sessionId,
        type,
        type === 'saida' ? 'despesa_avulsa' : 'ajuste',
        paymentMethod,
        amount,
        description,
        movementKind,
        type === 'entrada' ? entryKind : null,
        type === 'saida' ? expenseKind : null,
        pending,
      ],
    );
  });

  return res.status(201).json({ data: await responseData(user) });
}));

businessRouter.patch('/transactions/:id/identification', asyncRoute(async (req, res) => {
  const user = requireUser(req);
  const classification = String(req.body?.classification ?? '');
  const productId = req.body?.productId ? String(req.body.productId) : null;
  const requestedQuantity = req.body?.quantity === undefined ? 1 : Number(req.body.quantity);

  await withTenantTransaction(user.id, async (client) => {
    const transactionResult = await client.query(
      `SELECT id, type
       FROM transactions
       WHERE user_id = $1 AND id = $2
         AND source IN ('ajuste', 'despesa_avulsa')
         AND identification_pending
       FOR UPDATE`,
      [user.id, req.params.id],
    );
    if (!transactionResult.rowCount) {
      throw Object.assign(new Error('Pendência não encontrada ou já resolvida.'), { status: 404 });
    }

    const transaction = transactionResult.rows[0];
    if (transaction.type === 'entrada') {
      if (!ENTRY_KINDS.has(classification)) {
        throw Object.assign(new Error('Selecione Produto, Serviço ou Gorjeta.'), { status: 400 });
      }

      if (classification === 'gorjeta') {
        if (productId) {
          throw Object.assign(new Error('Gorjeta não pode ser vinculada a um produto ou serviço.'), { status: 400 });
        }
        await client.query(
          `UPDATE transactions
           SET entry_kind = 'gorjeta', identification_pending = false
           WHERE user_id = $1 AND id = $2`,
          [user.id, req.params.id],
        );
        return;
      }

      if (!productId) {
        throw Object.assign(
          new Error(`Selecione qual ${classification === 'produto' ? 'produto' : 'serviço'} originou a entrada.`),
          { status: 400 },
        );
      }

      const productResult = await client.query(
        `SELECT id, kind, name, stock_quantity
         FROM products
         WHERE user_id = $1 AND id = $2 AND active
         FOR UPDATE`,
        [user.id, productId],
      );
      if (!productResult.rowCount) {
        throw Object.assign(new Error('Produto ou serviço não encontrado no catálogo.'), { status: 404 });
      }

      const product = productResult.rows[0];
      const expectedKind = classification === 'produto' ? 'product' : 'service';
      if (product.kind !== expectedKind) {
        throw Object.assign(
          new Error(
            classification === 'produto'
              ? 'O item selecionado não é um produto.'
              : 'O item selecionado não é um serviço.',
          ),
          { status: 400 },
        );
      }

      const quantity = classification === 'produto' ? requestedQuantity : 1;
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw Object.assign(new Error('A quantidade deve ser um número inteiro maior que zero.'), { status: 400 });
      }

      if (classification === 'produto') {
        const stockUpdate = await client.query(
          `UPDATE products
           SET stock_quantity = stock_quantity - $3
           WHERE user_id = $1 AND id = $2 AND stock_quantity >= $3`,
          [user.id, productId, quantity],
        );
        if (!stockUpdate.rowCount) {
          throw Object.assign(new Error(`Estoque insuficiente para ${product.name}.`), { status: 409 });
        }
      }

      await client.query(
        `UPDATE transactions
         SET entry_kind = $3, description = $4, identification_pending = false
         WHERE user_id = $1 AND id = $2`,
        [
          user.id,
          req.params.id,
          classification,
          classification === 'produto' && quantity > 1 ? `${product.name} (${quantity} un.)` : product.name,
        ],
      );
      return;
    }

    if (productId) {
      throw Object.assign(new Error('Produto ou serviço só pode ser informado em uma entrada.'), { status: 400 });
    }

    if (!EXPENSE_KINDS.has(classification)) {
      throw Object.assign(new Error('Selecione uma categoria válida para a despesa.'), { status: 400 });
    }
    await client.query(
      `UPDATE transactions
       SET expense_kind = $3, identification_pending = false
       WHERE user_id = $1 AND id = $2`,
      [user.id, req.params.id, classification],
    );
  });

  return res.json({ data: await responseData(user) });
}));

businessRouter.post('/fixed-expenses', asyncRoute(async (req, res) => {
  const user = requireUser(req);
  const description = requiredText(req.body?.description, 'Descrição');
  const amount = positiveMoney(req.body?.amount);
  const recurrence = String(req.body?.recurrence ?? 'monthly');

  if (!FIXED_EXPENSE_RECURRENCES.has(recurrence)) {
    throw Object.assign(new Error('Recorrência inválida.'), { status: 400 });
  }

  await withTenantTransaction(user.id, async (client) => {
    await client.query(
      `INSERT INTO fixed_expenses (description, amount, recurrence, next_due_date)
       VALUES ($1, $2, $3, CURRENT_DATE)`,
      [description, amount, recurrence],
    );
  });

  return res.status(201).json({ data: await responseData(user) });
}));

businessRouter.delete('/fixed-expenses/:id', asyncRoute(async (req, res) => {
  const user = requireUser(req);

  await withTenantTransaction(user.id, async (client) => {
    const result = await client.query(
      `UPDATE fixed_expenses SET active = false
       WHERE user_id = $1 AND id = $2 AND active`,
      [user.id, req.params.id],
    );
    if (!result.rowCount) throw Object.assign(new Error('Conta fixa não encontrada.'), { status: 404 });
  });

  return res.json({ data: await responseData(user) });
}));

businessRouter.post('/credits/:id/pay', asyncRoute(async (req, res) => {
  const user = requireUser(req);
  const paymentMethod = String(req.body?.paymentMethod ?? 'dinheiro');
  if (!PAYMENT_METHODS.has(paymentMethod)) throw Object.assign(new Error('Forma de pagamento inválida.'), { status: 400 });

  await withTenantTransaction(user.id, async (client) => {
    const sessionId = await currentOpenSession(client, user.id);
    const creditResult = await client.query(
      `SELECT cs.id, cs.amount - cs.paid_amount AS outstanding, c.name
       FROM credit_sales cs
       JOIN customers c ON c.user_id = cs.user_id AND c.id = cs.customer_id
       WHERE cs.user_id = $1 AND cs.id = $2 AND cs.status <> 'pago'
       FOR UPDATE OF cs`,
      [user.id, req.params.id],
    );
    if (!creditResult.rowCount) throw Object.assign(new Error('Fiado pendente não encontrado.'), { status: 404 });
    const credit = creditResult.rows[0];
    await client.query(
      `INSERT INTO transactions
        (cash_session_id, credit_sale_id, type, source, payment_method, amount, description)
       VALUES ($1, $2, 'entrada', 'pagamento_fiado', $3, $4, $5)`,
      [sessionId, credit.id, paymentMethod, credit.outstanding, `Pagamento de fiado — ${credit.name}`],
    );
  });

  return res.json({ data: await responseData(user) });
}));

businessRouter.post('/fixed-expenses/:id/pay', asyncRoute(async (req, res) => {
  const user = requireUser(req);
  const paymentMethod = String(req.body?.paymentMethod ?? 'dinheiro');
  if (!PAYMENT_METHODS.has(paymentMethod)) throw Object.assign(new Error('Forma de pagamento inválida.'), { status: 400 });

  await withTenantTransaction(user.id, async (client) => {
    const expenseResult = await client.query(
      `SELECT id, description, amount, recurrence FROM fixed_expenses
       WHERE user_id = $1 AND id = $2 AND active FOR UPDATE`,
      [user.id, req.params.id],
    );
    if (!expenseResult.rowCount) throw Object.assign(new Error('Conta fixa não encontrada.'), { status: 404 });
    const expense = expenseResult.rows[0];
    const periodStart = expense.recurrence === 'weekly' ? 'week' : expense.recurrence === 'yearly' ? 'year' : 'month';
    const alreadyPaid = await client.query(
      `SELECT 1 FROM transactions
       WHERE user_id = $1 AND fixed_expense_id = $2 AND source = 'despesa_fixa'
         AND occurred_at >= date_trunc($3, now()) LIMIT 1`,
      [user.id, expense.id, periodStart],
    );
    if (alreadyPaid.rowCount) throw Object.assign(new Error('Esta conta fixa já foi paga no período atual.'), { status: 409 });

    const openSession = await client.query(
      `SELECT id FROM cash_sessions WHERE user_id = $1 AND status = 'open' FOR SHARE`,
      [user.id],
    );
    if (paymentMethod === 'dinheiro' && !openSession.rowCount) {
      throw Object.assign(new Error('Abra o caixa antes de pagar uma conta fixa em dinheiro.'), { status: 409 });
    }
    const movementKind = paymentMethod === 'dinheiro' ? 'sangria' : 'regular';
    await client.query(
      `INSERT INTO transactions
        (cash_session_id, fixed_expense_id, type, source, payment_method, amount, description, movement_kind)
       VALUES ($1, $2, 'saida', 'despesa_fixa', $3, $4, $5, $6)`,
      [openSession.rows[0]?.id ?? null, expense.id, paymentMethod, expense.amount, expense.description, movementKind],
    );
  });

  return res.json({ data: await responseData(user) });
}));

businessRouter.post('/cash-sessions', asyncRoute(async (req, res) => {
  const user = requireUser(req);
  const openingBalance = nonNegativeMoney(req.body?.openingBalance ?? 0, 'Valor inicial');
  const responsible = String(req.body?.responsible ?? '').trim() || user.email.split('@')[0];

  await withTenantTransaction(user.id, async (client) => {
    const open = await client.query(`SELECT 1 FROM cash_sessions WHERE user_id = $1 AND status = 'open'`, [user.id]);
    if (open.rowCount) throw Object.assign(new Error('Já existe um caixa aberto.'), { status: 409 });
    await client.query(
      `INSERT INTO cash_sessions (responsible, opening_balance) VALUES ($1, $2)`,
      [responsible, openingBalance],
    );
  });

  return res.status(201).json({ data: await responseData(user) });
}));

businessRouter.post('/cash-sessions/:id/close', asyncRoute(async (req, res) => {
  const user = requireUser(req);
  const countedCash = nonNegativeMoney(req.body?.countedCash, 'Dinheiro contado');
  const allowPending = req.body?.allowPending === true;

  await withTenantTransaction(user.id, async (client) => {
    const sessionResult = await client.query(
      `SELECT id FROM cash_sessions
       WHERE user_id = $1 AND id = $2 AND status = 'open'
       FOR UPDATE`,
      [user.id, req.params.id],
    );
    if (!sessionResult.rowCount) {
      throw Object.assign(new Error('Caixa aberto não encontrado.'), { status: 404 });
    }
    const pendingResult = await client.query(
      `SELECT COUNT(*)::integer AS count FROM transactions
       WHERE user_id = $1 AND cash_session_id = $2 AND identification_pending`,
      [user.id, req.params.id],
    );
    const pendingCount = Number(pendingResult.rows[0].count);
    if (pendingCount > 0 && !allowPending) {
      throw Object.assign(new Error(`Existem ${pendingCount} lançamentos pendentes de identificação.`), {
        status: 409,
        code: 'PENDING_IDENTIFICATION',
        pendingCount,
      });
    }
    await client.query(`SELECT close_cash_session($1, $2, now())`, [req.params.id, countedCash]);
  });

  return res.json({ data: await responseData(user) });
}));
