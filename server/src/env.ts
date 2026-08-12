export type EnvSource = Record<string, string | undefined>;

export type DatabaseEnv = {
  databaseUrl: string;
  databaseUrlUnpooled?: string;
  dbPoolMax: number;
  dbIdleTimeoutMs: number;
  dbConnectTimeoutMs: number;
};

export type JwtEnv = {
  jwtAccessSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiresIn: string;
};

export type ServerEnv = DatabaseEnv &
  JwtEnv & {
    nodeEnv: string;
    port: number;
    corsOrigins: string[];
    runDbMigrationsOnStartup: boolean;
  };

export class EnvValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super('Configuracao invalida do servidor.');
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

const DEFAULT_CORS_ORIGIN = 'http://localhost:5173';

function readTrimmed(source: EnvSource, name: string): string | undefined {
  const value = source[name]?.trim();
  return value ? value : undefined;
}

function required(source: EnvSource, name: string, issues: string[]): string {
  const value = readTrimmed(source, name);
  if (!value) {
    issues.push(`${name} deve ser definido.`);
    return '';
  }
  return value;
}

function optionalPositiveInteger(
  source: EnvSource,
  name: string,
  fallback: number,
  issues: string[],
): number {
  const value = readTrimmed(source, name);
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    issues.push(`${name} deve ser um inteiro positivo.`);
    return fallback;
  }
  return parsed;
}

function requiredAccessSecret(source: EnvSource, issues: string[]): string {
  const accessSecret = readTrimmed(source, 'JWT_ACCESS_SECRET') ?? readTrimmed(source, 'JWT_SECRET');
  if (!accessSecret) {
    issues.push('JWT_ACCESS_SECRET ou JWT_SECRET deve ser definido.');
    return '';
  }
  return accessSecret;
}

function assertValid(issues: string[]): void {
  if (issues.length > 0) throw new EnvValidationError(issues);
}

export function parseCorsOrigins(value: string | undefined): string[] {
  return (value ?? DEFAULT_CORS_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function collectDatabaseEnv(source: EnvSource, issues: string[]): DatabaseEnv {
  return {
    databaseUrl: required(source, 'DATABASE_URL', issues),
    databaseUrlUnpooled: readTrimmed(source, 'DATABASE_URL_UNPOOLED'),
    dbPoolMax: optionalPositiveInteger(source, 'DB_POOL_MAX', 10, issues),
    dbIdleTimeoutMs: optionalPositiveInteger(source, 'DB_IDLE_TIMEOUT_MS', 30_000, issues),
    dbConnectTimeoutMs: optionalPositiveInteger(source, 'DB_CONNECT_TIMEOUT_MS', 10_000, issues),
  };
}

function collectJwtEnv(source: EnvSource, issues: string[]): JwtEnv {
  return {
    jwtAccessSecret: requiredAccessSecret(source, issues),
    jwtAccessExpiresIn: readTrimmed(source, 'JWT_ACCESS_EXPIRES_IN') ?? '15m',
    jwtRefreshSecret: required(source, 'JWT_REFRESH_SECRET', issues),
    jwtRefreshExpiresIn: readTrimmed(source, 'JWT_REFRESH_EXPIRES_IN') ?? '30d',
  };
}

export function validateDatabaseEnv(source: EnvSource): DatabaseEnv {
  const issues: string[] = [];
  const env = collectDatabaseEnv(source, issues);
  assertValid(issues);
  return env;
}

export function validateJwtEnv(source: EnvSource): JwtEnv {
  const issues: string[] = [];
  const env = collectJwtEnv(source, issues);
  assertValid(issues);
  return env;
}

export function validateEnv(source: EnvSource): ServerEnv {
  const issues: string[] = [];
  const databaseEnv = collectDatabaseEnv(source, issues);
  const jwtEnv = collectJwtEnv(source, issues);
  const nodeEnv = readTrimmed(source, 'NODE_ENV') ?? 'development';
  const port = optionalPositiveInteger(source, 'PORT', 3001, issues);

  assertValid(issues);

  return {
    ...databaseEnv,
    ...jwtEnv,
    nodeEnv,
    port,
    corsOrigins: parseCorsOrigins(source.CORS_ORIGIN),
    runDbMigrationsOnStartup: source.RUN_DB_MIGRATIONS_ON_STARTUP === 'true',
  };
}
