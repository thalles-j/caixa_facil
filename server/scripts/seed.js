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

function money(value, factor) {
  return Number((value * factor).toFixed(2));
}

async function applySchema() {
  const schema = await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
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
    await client.query(
      `
        INSERT INTO products
          (category_id, kind, name, sale_price, cost_price, service_duration)
        VALUES
          ($1, 'service', 'Entrega local', $2, 0, interval '30 minutes'),
          ($1, 'service', 'Atendimento personalizado', $3, 0, interval '1 hour')
      `,
      [servicosId, money(12, f), money(75, f)],
    );

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
    await client.query(
      `
        INSERT INTO fixed_expenses
          (description, amount, recurrence, due_day, next_due_date)
        VALUES ('Internet', $1, 'monthly', 15, $2)
      `,
      [money(120, f), daysFromNow(15)],
    );

    const previousSessionId = await insertReturningId(
      client,
      `
        INSERT INTO cash_sessions (responsible, opened_at, opening_balance, notes)
        VALUES ($1, $2, $3, 'Sessão histórica criada pela seed')
        RETURNING id
      `,
      [user.name, hoursAgo(30), money(100, f)],
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
      [previousSessionId, previousSaleTotal, hoursAgo(29)],
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
      [previousSessionId, previousSaleId, previousSaleTotal, hoursAgo(29)],
    );
    await client.query(
      `
        INSERT INTO transactions
          (cash_session_id, type, source, payment_method, amount, description, occurred_at)
        VALUES ($1, 'saida', 'despesa_avulsa', 'dinheiro', $2, 'Material de escritório', $3)
      `,
      [previousSessionId, money(5, f), hoursAgo(28)],
    );
    await client.query('SELECT close_cash_session($1, $2, $3)', [
      previousSessionId,
      money(114.5, f),
      hoursAgo(20),
    ]);

    const openSessionId = await insertReturningId(
      client,
      `
        INSERT INTO cash_sessions (responsible, opened_at, opening_balance, notes)
        VALUES ($1, $2, $3, 'Caixa atual de demonstração')
        RETURNING id
      `,
      [user.name, hoursAgo(6), money(50, f)],
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
      [openSessionId, todaySaleTotal, hoursAgo(4)],
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
      [openSessionId, todaySaleId, todaySaleTotal, hoursAgo(4)],
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
      [previousSessionId, mariaId, pendingTotal, hoursAgo(27)],
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

    // Fiado parcial: apenas a parcela recebida aparece como entrada de hoje.
    const partialTotal = money(40, f);
    const partialSaleId = await insertReturningId(
      client,
      `
        INSERT INTO sales
          (cash_session_id, customer_id, description, payment_method, total_amount, sold_at)
        VALUES ($1, $2, 'Serviço vendido fiado', 'fiado', $3, $4)
        RETURNING id
      `,
      [previousSessionId, joaoId, partialTotal, hoursAgo(26)],
    );
    await client.query(
      `
        INSERT INTO sale_items
          (sale_id, product_name, quantity, unit_price, unit_cost)
        VALUES ($1, 'Serviço personalizado', 1, $2, 0)
      `,
      [partialSaleId, partialTotal],
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
      [openSessionId, partialCreditId, money(15, f), hoursAgo(3)],
    );

    // Fiado integralmente pago: paid_at e preenchido pelo trigger.
    const paidTotal = money(25, f);
    const paidSaleId = await insertReturningId(
      client,
      `
        INSERT INTO sales
          (cash_session_id, customer_id, description, payment_method, total_amount, sold_at)
        VALUES ($1, $2, 'Fiado já quitado', 'fiado', $3, $4)
        RETURNING id
      `,
      [previousSessionId, mariaId, paidTotal, hoursAgo(25)],
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
      [openSessionId, paidCreditId, paidTotal, hoursAgo(2)],
    );

    await client.query(
      `
        INSERT INTO transactions
          (cash_session_id, fixed_expense_id, type, source, payment_method, amount, description, occurred_at)
        VALUES ($1, $2, 'saida', 'despesa_fixa', 'dinheiro', $3, 'Pagamento da limpeza', $4)
      `,
      [openSessionId, limpezaId, money(30, f), hoursAgo(1)],
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
