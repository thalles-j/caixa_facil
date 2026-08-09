import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const services = [
  {
    name: 'BACK',
    port: 3000,
    args: ['run', 'dev:api'],
    url: 'http://localhost:3000/api/health',
    matches: async (response) => response.ok && (await response.json()).ok === true,
  },
  {
    name: 'FRONT',
    port: 5173,
    args: ['run', 'dev:web'],
    url: 'http://localhost:5173',
    matches: async (response) => response.ok && (await response.text()).includes('<title>CaixaFacil</title>'),
  },
];
const children = [];
let stopping = false;

function portIsAvailable(port) {
  return new Promise((resolve, reject) => {
    const tester = createServer();
    tester.unref();
    tester.once('error', (error) => {
      if (error.code === 'EADDRINUSE') return resolve(false);
      return reject(error);
    });
    // Sem fixar IPv4: detecta também serviços ligados apenas em localhost/IPv6.
    tester.listen(port, () => tester.close(() => resolve(true)));
  });
}

async function expectedServiceIsRunning(service) {
  try {
    const response = await fetch(service.url, { signal: AbortSignal.timeout(1500) });
    return await service.matches(response);
  } catch {
    return false;
  }
}

function prefixStream(stream, label, destination) {
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffer += chunk.replace(/\r/g, '');
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) destination.write(`[${label}] ${line}\n`);
    }
  });
  stream.on('end', () => {
    if (buffer.trim()) destination.write(`[${label}] ${buffer}\n`);
  });
}

const portStatus = await Promise.all(
  services.map(async (service) => ({
    service,
    available: await portIsAvailable(service.port),
  })),
);
const occupiedPorts = portStatus.filter(({ available }) => !available);
const reusableServices = new Set();
const conflictingServices = [];

for (const { service } of occupiedPorts) {
  if (await expectedServiceIsRunning(service)) reusableServices.add(service.name);
  else conflictingServices.push(service);
}

if (conflictingServices.length) {
  console.error('[DEV] Ambiente não iniciado porque existem portas ocupadas:');
  for (const service of conflictingServices) {
    console.error(`[${service.name}] Porta ${service.port} pertence a outro processo.`);
  }
  console.error('[DEV] Encerre o processo indicado e tente novamente.');
  process.exit(1);
}

for (const service of services) {
  if (reusableServices.has(service.name)) {
    console.log(`[${service.name}] Já está em execução na porta ${service.port}; reutilizando.`);
  }
}

console.log(`
CaixaFacil — ambiente de desenvolvimento
  Front-end: http://localhost:5173
  API:       http://localhost:3000
  Health:    http://localhost:3000/api/health

${reusableServices.size > 0
    ? 'Pressione Ctrl+C para encerrar os serviços iniciados neste terminal; os já ativos serão mantidos.'
    : 'Pressione Ctrl+C para encerrar os dois serviços.'}
`);

function stopAll(signal) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;

    try {
      if (process.platform === 'win32') child.kill(signal);
      else process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
}

const servicesToStart = services.filter((service) => !reusableServices.has(service.name));

if (servicesToStart.length === 0) {
  console.log('[DEV] Front-end e API já estavam ativos. Nenhum processo duplicado foi criado.');
  process.exit(0);
}

function startService(service) {
  const child = spawn(npmCommand, service.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
  children.push(child);
  prefixStream(child.stdout, service.name, process.stdout);
  prefixStream(child.stderr, service.name, process.stderr);

  child.on('error', (error) => {
    console.error(`[DEV] Não foi possível iniciar ${service.name}:`, error);
    process.exitCode = 1;
    stopAll('SIGTERM');
  });

  child.on('exit', (code, signal) => {
    if (!stopping) {
      console.error(
        `[DEV] ${service.name} encerrou inesperadamente (${signal ?? `código ${code ?? 1}`}).`,
      );
      process.exitCode = code || 1;
      stopAll('SIGTERM');
    }

    if (children.every((runningChild) => runningChild.exitCode !== null || runningChild.signalCode !== null)) {
      process.exit();
    }
  });

  return child;
}

async function waitForService(service, child, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !stopping) {
    if (await expectedServiceIsRunning(service)) return true;
    if (child.exitCode !== null || child.signalCode !== null) return false;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

for (const service of servicesToStart) {
  const child = startService(service);
  if (service.name !== 'BACK') continue;

  console.log('[DEV] Aguardando a API preparar o banco de dados...');
  if (!(await waitForService(service, child))) {
    console.error('[DEV] A API não ficou disponível a tempo; o frontend não será iniciado sem o backend.');
    process.exitCode = 1;
    stopAll('SIGTERM');
    break;
  }
  console.log('[BACK] API pronta para receber requisições.');
}

process.on('SIGINT', () => {
  process.exitCode = 130;
  stopAll('SIGINT');
});

process.on('SIGTERM', () => {
  process.exitCode = 143;
  stopAll('SIGTERM');
});
