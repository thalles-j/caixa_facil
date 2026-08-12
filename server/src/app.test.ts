import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateEnv } from './env.js';
import type { EnvSource } from './env.js';

const dbMock = vi.hoisted(() => ({
  closePool: vi.fn(),
  ensureSchema: vi.fn(),
  getPool: vi.fn(() => {
    throw new Error('Banco nao deveria ser usado neste teste.');
  }),
  withTenantTransaction: vi.fn(() => {
    throw new Error('Transacao de banco nao deveria ser usada neste teste.');
  }),
}));

vi.mock('./db.js', () => dbMock);

const { createApp, createErrorHandler } = await import('./app.js');

const explicitEnv: EnvSource = {
  NODE_ENV: 'test',
  PORT: '4010',
  DATABASE_URL: 'postgres://user:password@localhost:5432/caixafacil_test',
  JWT_ACCESS_SECRET: 'access-secret-for-tests',
  JWT_REFRESH_SECRET: 'refresh-secret-for-tests',
  CORS_ORIGIN: 'https://allowed.example.test',
};

function appForTest(overrides: EnvSource = {}) {
  return createApp({
    env: validateEnv({ ...explicitEnv, ...overrides }),
    logger: { error: vi.fn() },
  });
}

describe('createApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('responde health check sem usar banco', async () => {
    const response = await request(appForTest()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(dbMock.getPool).not.toHaveBeenCalled();
    expect(dbMock.withTenantTransaction).not.toHaveBeenCalled();
  });

  it('permite origem CORS configurada', async () => {
    const response = await request(appForTest())
      .get('/api/health')
      .set('Origin', 'https://allowed.example.test');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('https://allowed.example.test');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('permite requisicao sem Origin', async () => {
    const response = await request(appForTest()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('bloqueia origem CORS nao configurada com resposta segura', async () => {
    const response = await request(appForTest())
      .get('/api/health')
      .set('Origin', 'https://blocked.example.test');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Origem não permitida pelo CORS.' });
    expect(response.text).not.toContain('https://blocked.example.test');
    expect(response.text).not.toContain('stack');
  });

  it('responde preflight OPTIONS para origem permitida', async () => {
    const response = await request(appForTest())
      .options('/api/business/data')
      .set('Origin', 'https://allowed.example.test')
      .set('Access-Control-Request-Method', 'GET');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://allowed.example.test');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('retorna 401 em rota protegida sem token sem chamar banco', async () => {
    const response = await request(appForTest()).get('/api/business/data');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: 'Token inválido ou expirado.' });
    expect(dbMock.getPool).not.toHaveBeenCalled();
    expect(dbMock.withTenantTransaction).not.toHaveBeenCalled();
  });
});

describe('createErrorHandler', () => {
  it('retorna erro interno generico sem vazar detalhes', async () => {
    const logger = { error: vi.fn() };
    const app = express();
    app.get('/boom', () => {
      throw new Error('detalhe sensivel do servidor');
    });
    app.use(createErrorHandler(logger));

    const response = await request(app).get('/boom');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Erro interno do servidor.' });
    expect(response.text).not.toContain('detalhe sensivel');
    expect(response.text).not.toContain('stack');
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
