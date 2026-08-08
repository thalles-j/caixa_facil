import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const services = [
  { name: 'BACK', args: ['run', 'dev:api'] },
  { name: 'FRONT', args: ['run', 'dev:web'] },
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
    tester.listen(port, () => tester.close(() => resolve(true)));
  });
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

const requiredPorts = [
  { label: 'BACK', port: 3000 },
  { label: 'FRONT', port: 5173 },
];
const portStatus = await Promise.all(
  requiredPorts.map(async (service) => ({ ...service, available: await portIsAvailable(service.port) })),
);
const occupiedPorts = portStatus.filter((service) => !service.available);

if (occupiedPorts.length) {
  console.error('[DEV] Ambiente não iniciado porque existem portas ocupadas:');
  for (const service of occupiedPorts) {
    console.error(`[${service.label}] Porta ${service.port} já está em uso.`);
  }
  console.error('[DEV] Encerre a execução anterior com Ctrl+C e tente novamente.');
  process.exit(1);
}

console.log(`
Meu Negócio no Bolso — ambiente de desenvolvimento
  Front-end: http://localhost:5173
  API:       http://localhost:3000
  Health:    http://localhost:3000/api/health

Pressione Ctrl+C para encerrar os dois serviços.
`);

function stopAll(signal) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  }
}

for (const service of services) {
  const child = spawn(npmCommand, service.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
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
}

process.on('SIGINT', () => {
  process.exitCode = 130;
  stopAll('SIGINT');
});

process.on('SIGTERM', () => {
  process.exitCode = 143;
  stopAll('SIGTERM');
});
