import { describe, expect, it } from 'vitest';
import { EnvValidationError, validateEnv } from './env.js';

const validEnv = {
  NODE_ENV: 'test',
  PORT: '4010',
  DATABASE_URL: 'postgres://user:password@localhost:5432/caixafacil_test',
  JWT_ACCESS_SECRET: 'access-secret-for-tests',
  JWT_REFRESH_SECRET: 'refresh-secret-for-tests',
  CORS_ORIGIN: 'http://localhost:5173, https://app.example.test ',
};

describe('validateEnv', () => {
  it('normaliza a configuracao explicita e aplica defaults seguros', () => {
    const env = validateEnv(validEnv);

    expect(env).toMatchObject({
      nodeEnv: 'test',
      port: 4010,
      databaseUrl: validEnv.DATABASE_URL,
      jwtAccessSecret: validEnv.JWT_ACCESS_SECRET,
      jwtAccessExpiresIn: '15m',
      jwtRefreshSecret: validEnv.JWT_REFRESH_SECRET,
      jwtRefreshExpiresIn: '30d',
      corsOrigins: ['http://localhost:5173', 'https://app.example.test'],
      dbPoolMax: 10,
      dbIdleTimeoutMs: 30_000,
      dbConnectTimeoutMs: 10_000,
      runDbMigrationsOnStartup: false,
    });
  });

  it('rejeita ambiente sem DATABASE_URL e segredos JWT', () => {
    expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(EnvValidationError);

    try {
      validateEnv({ NODE_ENV: 'production' });
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as EnvValidationError).issues).toEqual([
        'DATABASE_URL deve ser definido.',
        'JWT_ACCESS_SECRET ou JWT_SECRET deve ser definido.',
        'JWT_REFRESH_SECRET deve ser definido.',
      ]);
    }
  });

  it('rejeita valores numericos invalidos', () => {
    expect(() => validateEnv({ ...validEnv, PORT: 'zero', DB_POOL_MAX: '-1' })).toThrow(
      EnvValidationError,
    );
  });
});
