import 'dotenv/config';
import { closePool, ensureSchema } from '../db.js';

try {
  await ensureSchema();
  console.log('Schema PostgreSQL aplicado com sucesso.');
} catch (error) {
  console.error('Falha ao aplicar o schema PostgreSQL:', error);
  process.exitCode = 1;
} finally {
  await closePool();
}
