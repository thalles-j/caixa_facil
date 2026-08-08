import { withTenantTransaction } from '../db.js';

type UserIdentity = {
  id: string;
  email: string;
  name: string | null;
};

function isoDate(value: Date | string | null): string | undefined {
  if (!value) return undefined;
  return new Date(value).toISOString().slice(0, 10);
}

export async function loadBootstrapData(user: UserIdentity) {
  return withTenantTransaction(user.id, async (client) => {
    const [productsResult, salesResult, customersResult, creditsResult, expensesResult, manualResult] =
      await Promise.all([
        client.query(`
          SELECT p.id, p.kind, p.name, p.sale_price, p.cost_price,
                 p.stock_quantity, p.minimum_quantity, p.service_duration::text,
                 c.name AS category_name
          FROM products p
          LEFT JOIN categories c ON c.user_id = p.user_id AND c.id = p.category_id
          WHERE p.user_id = $1 AND p.active
          ORDER BY p.created_at, p.name
        `, [user.id]),
        client.query(`
          SELECT si.id, si.product_id, si.product_name, si.quantity, si.unit_price,
                 s.sold_at, s.payment_method
          FROM sale_items si
          JOIN sales s ON s.user_id = si.user_id AND s.id = si.sale_id
          WHERE si.user_id = $1 AND s.status = 'completed'
          ORDER BY s.sold_at, si.created_at
        `, [user.id]),
        client.query(`
          SELECT id, name, phone
          FROM customers
          WHERE user_id = $1
          ORDER BY created_at, name
        `, [user.id]),
        client.query(`
          SELECT cs.id, cs.sale_id, cs.customer_id, cs.amount, cs.status,
                 cs.due_date, cs.paid_at, cs.created_at,
                 COALESCE(s.description, 'Venda fiado') AS description
          FROM credit_sales cs
          JOIN sales s ON s.user_id = cs.user_id AND s.id = cs.sale_id
          WHERE cs.user_id = $1
          ORDER BY cs.created_at
        `, [user.id]),
        client.query(`
          SELECT id, description, amount, recurrence
          FROM fixed_expenses
          WHERE user_id = $1 AND active AND recurrence IN ('weekly', 'monthly')
          ORDER BY created_at, description
        `, [user.id]),
        client.query(`
          SELECT id, occurred_at, type, description, amount
          FROM transactions
          WHERE user_id = $1 AND source IN ('ajuste', 'despesa_avulsa')
          ORDER BY occurred_at
        `, [user.id]),
      ]);

    const hasBusinessData =
      productsResult.rowCount || salesResult.rowCount || expensesResult.rowCount || creditsResult.rowCount;
    if (!hasBusinessData) return null;

    const fixedExpenses = expensesResult.rows.map((expense) => ({
      id: expense.id,
      nome: expense.description,
      valor: Number(expense.amount),
      recorrencia: expense.recurrence === 'weekly' ? 'semanal' : 'mensal',
    }));

    return {
      config: {
        nome: `${user.name ?? user.email.split('@')[0]} — Demonstração`,
        categoria: 'Alimentação (Mercado, Padaria...)',
        oferta: 'ambos',
        controlaEstoque: true,
        metaDiariaVendas: 500,
        despesasFixas: fixedExpenses,
        relatorio: { frequencia: 'ambos', porEmail: false },
        viewPeriod: 'day',
        onboardingConcluido: true,
      },
      produtos: productsResult.rows.map((product) => ({
        id: product.id,
        type: product.kind,
        nome: product.name,
        categoria: product.category_name ?? undefined,
        precoVenda: Number(product.sale_price),
        custo: Number(product.cost_price),
        quantidade: product.kind === 'product' ? Number(product.stock_quantity ?? 0) : undefined,
        quantidadeMinima: product.kind === 'product' ? Number(product.minimum_quantity ?? 0) : undefined,
        duracao: product.kind === 'service' ? product.service_duration ?? undefined : undefined,
      })),
      vendas: salesResult.rows.map((sale) => ({
        id: sale.id,
        data: isoDate(sale.sold_at),
        descricao: sale.product_name,
        quantidade: Number(sale.quantity),
        valorUnitario: Number(sale.unit_price),
        formaPagamento: sale.payment_method,
        produtoId: sale.product_id ?? undefined,
      })),
      clientes: customersResult.rows.map((customer) => ({
        id: customer.id,
        nome: customer.name,
        telefone: customer.phone ?? undefined,
      })),
      contas: creditsResult.rows.map((credit) => ({
        id: credit.id,
        tipo: 'receber',
        descricao: credit.description,
        valor: Number(credit.amount),
        vencimento: isoDate(credit.due_date ?? credit.created_at),
        quitado: credit.status === 'pago',
        dataQuitacao: isoDate(credit.paid_at),
        clienteId: credit.customer_id,
      })),
      lancamentosManuais: manualResult.rows.map((entry) => ({
        id: entry.id,
        data: isoDate(entry.occurred_at),
        tipo: entry.type,
        descricao: entry.description ?? 'Lançamento manual',
        valor: Number(entry.amount),
      })),
    };
  });
}
