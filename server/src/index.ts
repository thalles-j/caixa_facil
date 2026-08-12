import 'dotenv/config';
import { createApp } from './app.js';
import { ensureSchema } from './db.js';
import { EnvValidationError, validateEnv } from './env.js';

function reportStartupError(message: string, error: unknown): void {
  if (error instanceof EnvValidationError) {
    console.error(`${message} ${error.issues.join(' ')}`);
    return;
  }
  console.error(message);
}

async function startServer(): Promise<void> {
  let env;
  try {
    env = validateEnv(process.env);
  } catch (error) {
    reportStartupError('Configuracao invalida do servidor.', error);
    process.exitCode = 1;
    return;
  }

  try {
    if (env.nodeEnv !== 'production' || env.runDbMigrationsOnStartup) {
      await ensureSchema(env);
    }
  } catch (error) {
    reportStartupError('Falha ao preparar o banco de dados.', error);
    process.exitCode = 1;
    return;
  }

  const app = createApp({ env });
  const server = app.listen(env.port, () => console.log(`API rodando em http://localhost:${env.port}`));
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`A porta ${env.port} ja esta em uso. Encerre a API anterior e tente novamente.`);
    } else {
      console.error('Falha ao iniciar o servidor HTTP.');
    }
    process.exitCode = 1;
  });
}

void startServer();
