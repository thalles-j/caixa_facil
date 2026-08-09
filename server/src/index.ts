import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { ensureSchema } from './db.js';
import { authRouter } from './auth/routes.js';
import { accountRouter } from './account/routes.js';

const app = express();
const PORT = process.env.PORT ?? 3001;
const isDevelopment = process.env.NODE_ENV !== 'production';
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedDevelopmentOrigin(origin: string | undefined): boolean {
  if (!isDevelopment || !origin) return false;

  try {
    const url = new URL(origin);
    const isLocalVite =
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.port === '5173';
    const isCodespacesVite = /^[a-z0-9-]+-5173\.app\.github\.dev$/i.test(url.hostname);
    return isLocalVite || isCodespacesVite;
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      // Requisicoes sem Origin incluem health checks e clientes nao-browser.
      // Em desenvolvimento, o Codespaces usa um host HTTPS dinamico; o proxy
      // do Vite continua sendo a unica origem do browser.
      if (!origin || allowedOrigins.includes(origin) || isAllowedDevelopmentOrigin(origin)) {
        return callback(null, true);
      }
      const error = new Error('Origem não permitida pelo CORS.') as Error & { code: string };
      error.code = 'CORS_ORIGIN_DENIED';
      return callback(error);
    },
    credentials: true,
  }),
);
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/account', accountRouter);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Erro ao processar requisicao:', error);

  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : undefined;

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
});

const prepareDatabase =
  process.env.NODE_ENV !== 'production' || process.env.RUN_DB_MIGRATIONS_ON_STARTUP === 'true'
    ? ensureSchema()
    : Promise.resolve();

prepareDatabase
  .then(() => {
    const server = app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`A porta ${PORT} já está em uso. Encerre a API anterior e tente novamente.`);
      } else {
        console.error('Falha ao iniciar o servidor HTTP:', error);
      }
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error('Falha ao preparar o banco de dados:', err);
    process.exit(1);
  });
