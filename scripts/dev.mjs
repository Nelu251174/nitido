import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Accept the supervised preview flags while preserving normal Next.js development.
const args = process.argv.slice(2).flatMap(arg => {
  if (arg === '--strictPort') return [];
  if (arg === '--host') return ['--hostname'];
  if (arg.startsWith('--host=')) return [`--hostname=${arg.slice(7)}`];
  return [arg];
});
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', ...args], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
