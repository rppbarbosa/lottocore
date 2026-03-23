/**
 * Dev no Windows: liberta PORT (do .env na raiz do repo) antes do --watch,
 * para evitar EADDRINUSE quando ficam processos Node antigos ou dois backends.
 */
import { execSync, spawn } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, '..');
const rootEnv = resolve(backendRoot, '..', '.env');

dotenv.config({ path: rootEnv });

const port = Number(process.env.PORT) || 3003;

if (process.platform === 'win32') {
  const ps1 = resolve(__dirname, 'free-port.ps1');
  try {
    execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1}" ${port}`,
      { stdio: 'inherit', cwd: backendRoot },
    );
  } catch {
    // Continuar — em alguns ambientes o PowerShell pode falhar
  }
}

const child = spawn(process.execPath, ['--watch', 'src/index.js'], {
  cwd: backendRoot,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
