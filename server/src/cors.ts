import type { CorsOptions } from 'cors';
import type { ServerEnv } from './env.js';

type CorsEnv = Pick<ServerEnv, 'nodeEnv' | 'corsOrigins'>;

export function isAllowedDevelopmentOrigin(origin: string | undefined, nodeEnv: string): boolean {
  if (nodeEnv === 'production' || !origin) return false;

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

export function createCorsOptions(env: CorsEnv): CorsOptions {
  return {
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin) || isAllowedDevelopmentOrigin(origin, env.nodeEnv)) {
        return callback(null, true);
      }

      const error = new Error('Origem não permitida pelo CORS.') as Error & { code: string };
      error.code = 'CORS_ORIGIN_DENIED';
      return callback(error);
    },
    credentials: true,
  };
}
