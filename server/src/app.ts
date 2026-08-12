import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { accountRouter } from './account/routes.js';
import { authRouter } from './auth/routes.js';
import { businessRouter } from './business/routes.js';
import { createCorsOptions } from './cors.js';
import type { ServerEnv } from './env.js';

type Logger = Pick<Console, 'error'>;

type ErrorWithMetadata = Error & {
  code?: string;
  pendingCount?: number;
  status?: number;
};

export type CreateAppOptions = {
  env: ServerEnv;
  logger?: Logger;
};

function readErrorMetadata(error: unknown): ErrorWithMetadata {
  return error instanceof Error ? error : new Error('Erro desconhecido.');
}

export function createErrorHandler(logger: Logger = console): ErrorRequestHandler {
  return (error, _req, res, _next) => {
    logger.error('Erro ao processar requisicao:', error);

    const metadata = readErrorMetadata(error);
    const code = metadata.code;
    const status = metadata.status;

    if (status && status >= 400 && status < 500) {
      return res.status(status).json({
        error: metadata.message || 'Não foi possível completar a solicitação.',
        code,
        pendingCount: metadata.pendingCount,
      });
    }

    if (code === 'CORS_ORIGIN_DENIED') {
      return res.status(403).json({ error: 'Origem não permitida pelo CORS.' });
    }
    if (code && ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', '57P01'].includes(code)) {
      return res.status(503).json({
        error: 'Banco de dados indisponível. Verifique a DATABASE_URL e a disponibilidade do PostgreSQL.',
      });
    }
    if (code === '42P01') {
      return res.status(503).json({
        error: 'Banco de dados ainda não preparado. Execute npm run db:schema no servidor.',
      });
    }

    return res.status(500).json({ error: 'Erro interno do servidor.' });
  };
}

export function createApp({ env, logger = console }: CreateAppOptions) {
  const app = express();

  app.use(cors(createCorsOptions(env)));
  app.use(express.json());

  // Liveness simples nesta etapa. Readiness com verificacao de banco deve ser um endpoint separado.
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api/account', accountRouter);
  app.use('/api/business', businessRouter);

  app.use(createErrorHandler(logger));

  return app;
}
