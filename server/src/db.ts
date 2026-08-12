import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { validateDatabaseEnv, type DatabaseEnv } from './env.js';

const schemaUrl = new URL('../sql/schema.sql', import.meta.url);
let runtimePool: Pool | null = null;
let runtimePoolKey: string | null = null;

function normalizeConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get('sslmode');
    // pg 8 trata estes modos como verify-full e avisa sobre a mudanca futura.
    // Tornar o comportamento explicito remove o warning e mantem a verificacao
    // do certificado/hostname usada atualmente.
    if (sslMode && ['prefer', 'require', 'verify-ca'].includes(sslMode)) {
      url.searchParams.set('sslmode', 'verify-full');
    }
    return url.toString();
  } catch {
    return connectionString;
  }
}

function poolKey(config: DatabaseEnv): string {
  return [
    normalizeConnectionString(config.databaseUrl),
    config.dbPoolMax,
    config.dbIdleTimeoutMs,
    config.dbConnectTimeoutMs,
  ].join('|');
}

function createPool(config: DatabaseEnv) {
  return new Pool({
    connectionString: normalizeConnectionString(config.databaseUrl),
    max: config.dbPoolMax,
    idleTimeoutMillis: config.dbIdleTimeoutMs,
    connectionTimeoutMillis: config.dbConnectTimeoutMs,
    keepAlive: true,
    application_name: 'caixafacil-api',
  });
}

export function getPool(config: DatabaseEnv = validateDatabaseEnv(process.env)) {
  const key = poolKey(config);
  if (runtimePool) {
    if (runtimePoolKey !== key) {
      throw new Error('Pool de banco ja foi inicializado com outra configuracao.');
    }
    return runtimePool;
  }

  // No Neon, DATABASE_URL deve ser a URL pooled (host contendo "-pooler").
  runtimePool = createPool(config);
  runtimePoolKey = key;
  return runtimePool;
}

export async function closePool() {
  if (!runtimePool) return;

  const pool = runtimePool;
  runtimePool = null;
  runtimePoolKey = null;
  await pool.end();
}

export async function ensureSchema(config: DatabaseEnv = validateDatabaseEnv(process.env)) {
  const schema = await readFile(schemaUrl, 'utf8');
  // Se uma URL direta existir, ela e preferida para DDL. Caso contrario, o
  // mesmo pool do runtime e usado; DATABASE_URL_UNPOOLED nao e obrigatoria.
  const migrationDatabaseUrl = config.databaseUrlUnpooled ?? config.databaseUrl;
  if (migrationDatabaseUrl === config.databaseUrl) {
    await getPool(config).query(schema);
    return;
  }

  const migrationPool = createPool({
    ...config,
    databaseUrl: migrationDatabaseUrl,
    databaseUrlUnpooled: undefined,
    dbPoolMax: 1,
  });
  try {
    await migrationPool.query(schema);
  } finally {
    await migrationPool.end();
  }
}

/**
 * Executa operacoes autenticadas com o tenant preso a uma transacao.
 * `SET LOCAL` (via set_config(..., true)) impede vazamento entre conexoes do pool.
 */
export async function withTenantTransaction<T>(
  userId: string,
  operation: (client: import('pg').PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    // neondb_owner possui BYPASSRLS. A role NOLOGIN criada pelo schema tem
    // apenas privilegios de negocio e obrigatoriamente obedece ao RLS.
    await client.query('SET LOCAL ROLE mnb_app_runtime');
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
