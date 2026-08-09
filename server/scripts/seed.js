import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL nao foi definida em server/.env.');
}

const normalizedDatabaseUrl = new URL(databaseUrl);
if (['prefer', 'require', 'verify-ca'].includes(normalizedDatabaseUrl.searchParams.get('sslmode'))) {
  normalizedDatabaseUrl.searchParams.set('sslmode', 'verify-full');
}

const pool = new Pool({
  connectionString: normalizedDatabaseUrl.toString(),
  max: 1,
  connectionTimeoutMillis: 10_000,
  application_name: 'meu-negocio-no-bolso-seed',
});

const DEMO_PASSWORD = '123456';
const RESET_DATABASE = process.argv.includes('--reset');
const DEMO_USERS = [
  { name: 'Thalles', email: 'thalles@gmail.com', factor: 1 },
  { name: 'Gustavo', email: 'gustavo@gmail.com', factor: 1.15 },
  { name: 'Marco', email: 'marco@gmail.com', factor: 0.9 },
];

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function daysFromNow(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysAgoAt(days, hour, minute = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}

function money(value, factor) {
  return Number((value * factor).toFixed(2));
}

async function applySchema() {
  const schema = await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
}

async function resetDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // A exclusao direta de users dispara cascatas em ordem definida pelo
    // PostgreSQL. Como transactions possui um trigger que estorna fiados, a
    // limpeza precisa ser explicitamente ordenada para a divida ainda existir
    // quando cada pagamento for removido.
    const businessTables = [
      'transactions',
      'credit_sales',
      'sale_items',
      'sales',
      'cash_sessions',
      'fixed_expenses',
      'products',
      'categories',
      'customers',
      'password_reset_tokens',
    ];
    for (const table of businessTables) {
      await client.query(`DELETE FROM ${table}`);
    }
    const result = await client.query('DELETE FROM users');
    await client.query('COMMIT');
    console.log(`Banco reiniciado: ${result.rowCount ?? 0} conta(s) removida(s).`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createUser(client, user, passwordHash) {
  const result = await client.query(
    `
      INSERT INTO users (email, password_hash, name)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [user.email, passwordHash, user.name],
  );
  return result.rows[0].id;
}

async function userExists(client, email) {
  const result = await client.query('SELECT 1 FROM users WHERE email = $1', [email]);
  return Boolean(result.rowCount);
}

async function insertReturningId(client, sql, values) {
  const result = await client.query(sql, values);
  return result.rows[0].id;
}

async function seedClosedSession(client, { responsible, daysAgo, openingBalance, sales, expense, difference = 0 }) {
  const sessionId = await insertReturningId(
    client,
    `
      INSERT INTO cash_sessions (responsible, opened_at, opening_balance, notes)
      VALUES ($1, $2, $3, 'Fechamento histórico criado pela seed')
      RETURNING id
    `,
    [responsible, daysAgoAt(daysAgo, 8), openingBalance],
  );

  let expectedCash = openingBalance;
  for (const [index, sale] of sales.entries()) {
    const occurredAt = daysAgoAt(daysAgo, 9 + index);
    const total = Number((sale.quantity * sale.unitPrice).toFixed(2));
    const saleId = await insertReturningId(
      client,
      `
        INSERT INTO sales
          (cash_session_id, description, payment_method, total_amount, sold_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [sessionId, `Venda de ${sale.productName}`, sale.paymentMethod, total, occurredAt],
    );
    await client.query(
      `
        INSERT INTO sale_items
          (sale_id, product_id, product_name, quantity, unit_price, unit_cost)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [saleId, sale.productId, sale.productName, sale.quantity, sale.unitPrice, sale.unitCost],
    );
    await client.query(
      `
        INSERT INTO transactions
          (cash_session_id, sale_id, type, source, payment_method, amount, description, occurred_at)
        VALUES ($1, $2, 'entrada', 'venda', $3, $4, $5, $6)
      `,
      [sessionId, saleId, sale.paymentMethod, total, `Recebimento de ${sale.productName}`, occurredAt],
    );
    if (sale.paymentMethod === 'dinheiro') expectedCash += total;
  }

  if (expense) {
    await client.query(
      `
        INSERT INTO transactions
          (cash_session_id, type, source, payment_method, amount, description,
           movement_kind, expense_kind, occurred_at)
        VALUES ($1, 'saida', 'despesa_avulsa', $2, $3, $4,
                $5, $6, $7)
      `,
      [
        sessionId,
        expense.paymentMethod,
        expense.amount,
        expense.description,
        expense.paymentMethod === 'dinheiro' ? 'sangria' : 'regular',
        expense.kind,
        daysAgoAt(daysAgo, 16),
      ],
    );
    if (expense.paymentMethod === 'dinheiro') expectedCash -= expense.amount;
  }

  const countedCash = Number((expectedCash + difference).toFixed(2));
  await client.query('SELECT close_cash_session($1, $2, $3)', [
    sessionId,
    countedCash,
    daysAgoAt(daysAgo, 18),
  ]);
}

async function seedTenant(client, user, passwordHash) {
  const f = user.factor;

  await client.query('BEGIN');
  try {
    const userId = await createUser(client, user, passwordHash);
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);

    const bebidasId = await insertReturningId(
      client,
      'INSERT INTO categories (name) VALUES ($1) RETURNING id',
      ['Bebidas'],
    );
    const alimentosId = await insertReturningId(
      client,
      'INSERT INTO categories (name) VALUES ($1) RETURNING id',
      ['Alimentos'],
    );
    const servicosId = await insertReturningId(
      client,
      'INSERT INTO categories (name) VALUES ($1) RETURNING id',
      ['Serviços'],
    );

    const cafePrice = money(8, f);
    const aguaPrice = money(4, f);
    const paoPrice = money(6, f);

    const cafeId = await insertReturningId(
      client,
      `
        INSERT INTO products
          (category_id, kind, name, sale_price, cost_price, stock_quantity, minimum_quantity)
        VALUES ($1, 'product', 'Café 500 ml', $2, $3, 40, 10)
        RETURNING id
      `,
      [bebidasId, cafePrice, money(3.2, f)],
    );
    const aguaId = await insertReturningId(
      client,
      `
        INSERT INTO products
          (category_id, kind, name, sale_price, cost_price, stock_quantity, minimum_quantity)
        VALUES ($1, 'product', 'Água mineral', $2, $3, 80, 20)
        RETURNING id
      `,
      [bebidasId, aguaPrice, money(1.5, f)],
    );
    const paoId = await insertReturningId(
      client,
      `
        INSERT INTO products
          (category_id, kind, name, sale_price, cost_price, stock_quantity, minimum_quantity)
        VALUES ($1, 'product', 'Pão de queijo', $2, $3, 50, 15)
        RETURNING id
      `,
      [alimentosId, paoPrice, money(2.5, f)],
    );
    const servicesResult = await client.query(
      `
        INSERT INTO products
          (category_id, kind, name, sale_price, cost_price, service_duration)
        VALUES
          ($1, 'service', 'Entrega local', $2, 0, interval '30 minutes'),
          ($1, 'service', 'Atendimento personalizado', $3, 0, interval '1 hour')
        RETURNING id, name
      `,
      [servicosId, money(12, f), money(75, f)],
    );
    const atendimentoId = servicesResult.rows.find((service) => service.name === 'Atendimento personalizado').id;
    const entregaId = servicesResult.rows.find((service) => service.name === 'Entrega local').id;

    const mariaId = await insertReturningId(
      client,
      `INSERT INTO customers (name, phone, email) VALUES ($1, $2, $3) RETURNING id`,
      ['Maria Silva', '(11) 99999-1001', `maria.${user.name.toLowerCase()}@example.com`],
    );
    const joaoId = await insertReturningId(
      client,
      `INSERT INTO customers (name, phone) VALUES ($1, $2) RETURNING id`,
      ['João Santos', '(11) 99999-1002'],
    );

    const aluguelId = await insertReturningId(
      client,
      `
        INSERT INTO fixed_expenses
          (description, amount, recurrence, due_day, next_due_date)
        VALUES ('Aluguel', $1, 'monthly', 10, $2)
        RETURNING id
      `,
      [money(1200, f), daysFromNow(10)],
    );
    const limpezaId = await insertReturningId(
      client,
      `
        INSERT INTO fixed_expenses
          (description, amount, recurrence, due_day, next_due_date)
        VALUES ('Limpeza', $1, 'weekly', 1, $2)
        RETURNING id
      `,
      [money(30, f), daysFromNow(3)],
    );
    const internetId = await insertReturningId(
      client,
      `
        INSERT INTO fixed_expenses
          (description, amount, recurrence, due_day, next_due_date)
        VALUES ('Internet', $1, 'monthly', 15, $2)
        RETURNING id
      `,
      [money(120, f), daysFromNow(15)],
    );

    await seedClosedSession(client, {
      responsible: user.name,
      daysAgo: 8,
      openingBalance: money(60, f),
      sales: [
        { productId: cafeId, productName: 'Café 500 ml', quantity: 1, unitPrice: cafePrice, unitCost: money(3.2, f), paymentMethod: 'dinheiro' },
        { productId: aguaId, productName: 'Água mineral', quantity: 2, unitPrice: aguaPrice, unitCost: money(1.5, f), paymentMethod: 'pix' },
        { productId: entregaId, productName: 'Entrega local', quantity: 1, unitPrice: money(12, f), unitCost: 0, paymentMethod: 'cartao_debito' },
      ],
      expense: { amount: money(3, f), description: 'Material de limpeza', paymentMethod: 'dinheiro', kind: 'outros' },
    });

    await seedClosedSession(client, {
      responsible: user.name,
      daysAgo: 6,
      openingBalance: money(75, f),
      sales: [
        { productId: paoId, productName: 'Pão de queijo', quantity: 6, unitPrice: paoPrice, unitCost: money(2.5, f), paymentMethod: 'dinheiro' },
        { productId: cafeId, productName: 'Café 500 ml', quantity: 2, unitPrice: cafePrice, unitCost: money(3.2, f), paymentMethod: 'cartao_credito' },
        { productId: aguaId, productName: 'Água mineral', quantity: 5, unitPrice: aguaPrice, unitCost: money(1.5, f), paymentMethod: 'pix' },
      ],
      expense: { amount: money(10, f), description: 'Compra de embalagens', paymentMethod: 'dinheiro', kind: 'mercadoria' },
      difference: money(0.2, f),
    });

    await seedClosedSession(client, {
      responsible: user.name,
      daysAgo: 4,
      openingBalance: money(50, f),
      sales: [
        { productId: aguaId, productName: 'Água mineral', quantity: 8, unitPrice: aguaPrice, unitCost: money(1.5, f), paymentMethod: 'pix' },
        { productId: entregaId, productName: 'Entrega local', quantity: 3, unitPrice: money(12, f), unitCost: 0, paymentMethod: 'cartao_credito' },
        { productId: cafeId, productName: 'Café 500 ml', quantity: 4, unitPrice: cafePrice, unitCost: money(3.2, f), paymentMethod: 'dinheiro' },
      ],
      expense: { amount: money(4, f), description: 'Tarifa de entrega', paymentMethod: 'pix', kind: 'fornecedor' },
    });

    await seedClosedSession(client, {
      responsible: user.name,
      daysAgo: 2,
      openingBalance: money(90, f),
      sales: [
        { productId: cafeId, productName: 'Café 500 ml', quantity: 10, unitPrice: cafePrice, unitCost: money(3.2, f), paymentMethod: 'dinheiro' },
        { productId: paoId, productName: 'Pão de queijo', quantity: 2, unitPrice: paoPrice, unitCost: money(2.5, f), paymentMethod: 'pix' },
        { productId: atendimentoId, productName: 'Atendimento personalizado', quantity: 1, unitPrice: money(75, f), unitCost: 0, paymentMethod: 'cartao_credito' },
        { productId: aguaId, productName: 'Água mineral', quantity: 4, unitPrice: aguaPrice, unitCost: money(1.5, f), paymentMethod: 'dinheiro' },
      ],
      expense: { amount: money(18, f), description: 'Combustível de entrega', paymentMethod: 'dinheiro', kind: 'combustivel' },
      difference: money(-0.3, f),
    });

    const previousSessionId = await insertReturningId(
      client,
      `
        INSERT INTO cash_sessions (responsible, opened_at, opening_balance, notes)
        VALUES ($1, $2, $3, 'Sessão histórica criada pela seed')
        RETURNING id
      `,
      [user.name, daysAgoAt(1, 12), money(100, f)],
    );

    const previousSaleTotal = money(20, f);
    const previousSaleId = await insertReturningId(
      client,
      `
        INSERT INTO sales
          (cash_session_id, description, payment_method, total_amount, sold_at)
        VALUES ($1, 'Venda balcão', 'dinheiro', $2, $3)
        RETURNING id
      `,
      [previousSessionId, previousSaleTotal, daysAgoAt(1, 13)],
    );
    await client.query(
      `
        INSERT INTO sale_items
          (sale_id, product_id, product_name, quantity, unit_price, unit_cost)
        VALUES
          ($1, $2, 'Café 500 ml', 2, $3, $4),
          ($1, $5, 'Água mineral', 1, $6, $7)
      `,
      [
        previousSaleId,
        cafeId,
        cafePrice,
        money(3.2, f),
        aguaId,
        aguaPrice,
        money(1.5, f),
      ],
    );
    await client.query(
      `
        INSERT INTO transactions
          (cash_session_id, sale_id, type, source, payment_method, amount, description, occurred_at)
        VALUES ($1, $2, 'entrada', 'venda', 'dinheiro', $3, 'Venda à vista', $4)
      `,
      [previousSessionId, previousSaleId, previousSaleTotal, daysAgoAt(1, 13)],
    );

    const previousPixTotal = money(24, f);
    const previousPixSaleId = await insertReturningId(
      client,
      `
        INSERT INTO sales
          (cash_session_id, description, payment_method, total_amount, sold_at)
        VALUES ($1, 'Entregas recebidas por Pix', 'pix', $2, $3)
        RETURNING id
      `,
      [previousSessionId, previousPixTotal, daysAgoAt(1, 14)],
    );
    await client.query(
      `
        INSERT INTO sale_items
          (sale_id, product_id, product_name, quantity, unit_price, unit_cost)
        VALUES ($1, $2, 'Entrega local', 2, $3, 0)
      `,
      [previousPixSaleId, entregaId, money(12, f)],
    );
    await client.query(
      `
        INSERT INTO transactions
          (cash_session_id, sale_id, type, source, payment_method, amount, description, occurred_at)
        VALUES ($1, $2, 'entrada', 'venda', 'pix', $3, 'Entregas recebidas por Pix', $4)
      `,
      [previousSessionId, previousPixSaleId, previousPixTotal, daysAgoAt(1, 14)],
    );

    const previousCardTotal = money(75, f);
    const previousCardSaleId = await insertReturningId(
      client,
      `
        INSERT INTO sales
          (cash_session_id, description, payment_method, total_amount, sold_at)
        VALUES ($1, 'Atendimento no cartão', 'cartao_credito', $2, $3)
        RETURNING id
      `,
      [previousSessionId, previousCardTotal, daysAgoAt(1, 15)],
    );
    await client.query(
      `
        INSERT INTO sale_items
          (sale_id, product_id, product_name, quantity, unit_price, unit_cost)
        VALUES ($1, $2, 'Atendimento personalizado', 1, $3, 0)
      `,
      [previousCardSaleId, atendimentoId, previousCardTotal],
    );
    await client.query(
      `
        INSERT INTO transactions
          (cash_session_id, sale_id, type, source, payment_method, amount, description, occurred_at)
        VALUES ($1, $2, 'entrada', 'venda', 'cartao_credito', $3, 'Atendimento recebido no cartão', $4)
      `,
      [previousSessionId, previousCardSaleId, previousCardTotal, daysAgoAt(1, 15)],
    );

    await client.query(
      `
        INSERT INTO transactions
          (cash_session_id, type, source, payment_method, amount, description,
           movement_kind, expense_kind, occurred_at)
        VALUES ($1, 'saida', 'despesa_avulsa', 'dinheiro', $2,
                'Material de escritório', 'sangria', 'outros', $3)
      `,
      [previousSessionId, money(5, f), daysAgoAt(1, 16)],
    );
    await client.query('SELECT close_cash_session($1, $2, $3)', [
      previousSessionId,
      money(114.5, f),
      daysAgoAt(1, 20),
    ]);

    const openSessionId = await insertReturningId(
      client,
      `
        INSERT INTO cash_sessions (responsible, opened_at, opening_balance, notes)
        VALUES ($1, $2, $3, 'Caixa atual de demonstração')
        RETURNING id
      `,
      [user.name, hoursAgo(1.8), money(50, f)],
    );

    const todaySaleTotal = money(24, f);
    const todaySaleId = await insertReturningId(
      client,
      `
        INSERT INTO sales
          (cash_session_id, description, payment_method, total_amount, sold_at)
        VALUES ($1, 'Venda via Pix', 'pix', $2, $3)
        RETURNING id
      `,
      [openSessionId, todaySaleTotal, hoursAgo(1.6)],
    );
    await client.query(
      `
        INSERT INTO sale_items
          (sale_id, product_id, product_name, quantity, unit_price, unit_cost)
        VALUES ($1, $2, 'Café 500 ml', 3, $3, $4)
      `,
      [todaySaleId, cafeId, cafePrice, money(3.2, f)],
    );
    await client.query(
      `
        INSERT INTO transactions
          (cash_session_id, sale_id, type, source, payment_method, amount, description, occurred_at)
        VALUES ($1, $2, 'entrada', 'venda', 'pix', $3, 'Venda recebida por Pix', $4)
      `,
      [openSessionId, todaySaleId, todaySaleTotal, hoursAgo(1.6)],
    );

    // Entradas rápidas: produto/serviço ficam pendentes; gorjeta é direta.
    await client.query(
      `
        INSERT INTO transactions
          (cash_session_id, type, source, payment_method, amount, description,
           movement_kind, entry_kind, identification_pending, occurred_at)
        VALUES
          ($1, 'entrada', 'ajuste', 'dinheiro', $2, 'Venda rápida de balcão',
           'regular', 'produto', true, $3),
          ($1, 'entrada', 'ajuste', 'pix', $4, 'Gorjeta recebida',
           'regular', 'gorjeta', false, $5)
      `,
      [openSessionId, money(35, f), hoursAgo(1.5), money(5, f), hoursAgo(1.4)],
    );

    await client.query(
      `
        INSERT INTO transactions
          (cash_session_id, type, source, payment_method, amount, description,
           movement_kind, expense_kind, identification_pending, occurred_at)
        VALUES
          ($1, 'saida', 'despesa_avulsa', 'dinheiro', $2,
           'Retirada para cofre', 'sangria', 'outros', false, $3),
          ($1, 'saida', 'despesa_avulsa', 'pix', $4,
           'Compra de embalagens sem categoria', 'regular', NULL, true, $5)
      `,
      [openSessionId, money(20, f), hoursAgo(1.3), money(12, f), hoursAgo(1.2)],
    );

    // Fiado pendente: existe comercialmente, mas nao gera transaction.
    const pendingTotal = money(18, f);
    const pendingSaleId = await insertReturningId(
      client,
      `
        INSERT INTO sales
          (cash_session_id, customer_id, description, payment_method, total_amount, sold_at)
        VALUES ($1, $2, 'Fiado pendente', 'fiado', $3, $4)
        RETURNING id
      `,
      [previousSessionId, mariaId, pendingTotal, daysAgoAt(1, 16, 30)],
    );
    await client.query(
      `
        INSERT INTO sale_items
          (sale_id, product_id, product_name, quantity, unit_price, unit_cost)
        VALUES ($1, $2, 'Pão de queijo', 3, $3, $4)
      `,
      [pendingSaleId, paoId, paoPrice, money(2.5, f)],
    );
    await client.query(
      `
        INSERT INTO credit_sales (sale_id, customer_id, amount, due_date)
        VALUES ($1, $2, $3, $4)
      `,
      [pendingSaleId, mariaId, pendingTotal, daysFromNow(7)],
    );

    // Fiado parcial recebido no fechamento histórico. O relatório usa a
    // transaction para mostrar quem pagou, mesmo sem a dívida estar quitada.
    const partialTotal = money(40, f);
    const partialSaleId = await insertReturningId(
      client,
      `
        INSERT INTO sales
          (cash_session_id, customer_id, description, payment_method, total_amount, sold_at)
        VALUES ($1, $2, 'Serviço vendido fiado', 'fiado', $3, $4)
        RETURNING id
      `,
      [previousSessionId, joaoId, partialTotal, daysAgoAt(1, 17)],
    );
    await client.query(
      `
        INSERT INTO sale_items
          (sale_id, product_id, product_name, quantity, unit_price, unit_cost)
        VALUES ($1, $2, 'Atendimento personalizado', 1, $3, 0)
      `,
      [partialSaleId, atendimentoId, partialTotal],
    );
    const partialCreditId = await insertReturningId(
      client,
      `
        INSERT INTO credit_sales (sale_id, customer_id, amount, due_date)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [partialSaleId, joaoId, partialTotal, daysFromNow(5)],
    );
    await client.query(
      `
        INSERT INTO transactions
          (cash_session_id, credit_sale_id, type, source, payment_method, amount, description, occurred_at)
        VALUES ($1, $2, 'entrada', 'pagamento_fiado', 'pix', $3, 'Pagamento parcial de João', $4)
      `,
      [previousSessionId, partialCreditId, money(15, f), daysAgoAt(1, 18)],
    );

    // Fiado integralmente pago no mesmo fechamento: paid_at é preenchido pelo trigger.
    const paidTotal = money(25, f);
    const paidSaleId = await insertReturningId(
      client,
      `
        INSERT INTO sales
          (cash_session_id, customer_id, description, payment_method, total_amount, sold_at)
        VALUES ($1, $2, 'Fiado já quitado', 'fiado', $3, $4)
        RETURNING id
      `,
      [previousSessionId, mariaId, paidTotal, daysAgoAt(1, 17, 30)],
    );
    await client.query(
      `
        INSERT INTO sale_items
          (sale_id, product_name, quantity, unit_price, unit_cost)
        VALUES ($1, 'Encomenda', 1, $2, 0)
      `,
      [paidSaleId, paidTotal],
    );
    const paidCreditId = await insertReturningId(
      client,
      `
        INSERT INTO credit_sales (sale_id, customer_id, amount, due_date)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [paidSaleId, mariaId, paidTotal, daysFromNow(2)],
    );
    await client.query(
      `
        INSERT INTO transactions
          (cash_session_id, credit_sale_id, type, source, payment_method, amount, description, occurred_at)
        VALUES ($1, $2, 'entrada', 'pagamento_fiado', 'dinheiro', $3, 'Quitação de fiado da Maria', $4)
      `,
      [previousSessionId, paidCreditId, paidTotal, daysAgoAt(1, 18, 30)],
    );

    // Os pagamentos históricos foram inseridos depois da chamada de fechamento
    // para manter a seed legível. Atualiza o snapshot final para refletir também
    // os R$ 25 recebidos em dinheiro, preservando a quebra demonstrativa.
    await client.query(
      `
        UPDATE cash_sessions
           SET expected_balance = $2,
               closing_balance = $3
         WHERE id = $1
      `,
      [previousSessionId, money(140, f), money(139.5, f)],
    );

    await client.query(
      `
        INSERT INTO transactions
          (cash_session_id, fixed_expense_id, type, source, payment_method, amount, description, movement_kind, occurred_at)
        VALUES ($1, $2, 'saida', 'despesa_fixa', 'dinheiro', $3, 'Pagamento da limpeza', 'sangria', $4)
      `,
      [openSessionId, limpezaId, money(30, f), hoursAgo(0.4)],
    );

    // Pagamento não monetário fica registrado, sem alterar o dinheiro físico.
    await client.query(
      `
        INSERT INTO transactions
          (cash_session_id, fixed_expense_id, type, source, payment_method, amount, description, movement_kind, occurred_at)
        VALUES ($1, $2, 'saida', 'despesa_fixa', 'pix', $3, 'Pagamento da internet', 'regular', $4)
      `,
      [openSessionId, internetId, money(120, f), hoursAgo(0.2)],
    );

    // Mantem a despesa de aluguel referenciada no exemplo sem registra-la como
    // paga hoje, para ela aparecer apenas como compromisso futuro.
    void aluguelId;

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  console.log('Aplicando schema...');
  await applySchema();
  if (RESET_DATABASE) await resetDatabase();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const client = await pool.connect();
  try {
    for (const user of DEMO_USERS) {
      if (await userExists(client, user.email)) {
        console.log(`Conta ${user.email} ja existe; dados preservados, seed ignorada.`);
        continue;
      }
      await seedTenant(client, user, passwordHash);
      console.log(`Seed concluida para ${user.email}.`);
    }
  } finally {
    client.release();
  }

  console.log('Dados de demonstracao criados com sucesso.');
}

try {
  await main();
} catch (error) {
  console.error('Falha ao executar a seed:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
