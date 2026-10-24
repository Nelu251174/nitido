// Sandbox-only database checkpoint before adding ADMIN password recovery.
const fs = require('node:fs/promises');
const path = require('node:path');
const Database = require('better-sqlite3');
(async () => {
  if (process.env.NEXT_PUBLIC_SITE_URL !== 'https://sandbox.nitido.ro') throw Error('SANDBOX_REQUIRED');
  const root = '/app/data/release-checkpoints/20261024-before-admin-password-recovery';
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const file = path.join(root, 'nitido.db');
  try { await fs.access(file); throw Error('CHECKPOINT_ALREADY_EXISTS'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const source = new Database('/app/data/nitido.db', { readonly: true, fileMustExist: true });
  try { await source.backup(file); } finally { source.close(); }
  await fs.chmod(file, 0o600);
  const backup = new Database(file, { readonly: true, fileMustExist: true });
  try { if (backup.pragma('quick_check', { simple: true }) !== 'ok') throw Error('BACKUP_INTEGRITY_FAILED'); } finally { backup.close(); }
  await fs.writeFile(path.join(root, 'verification.json'), JSON.stringify({ status: 'passed', scope: 'sandbox', createdAt: new Date().toISOString(), restorePolicy: 'Isolated investigation only. Never overwrite running data or return to password-override-unaware code after real resets.' }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ status: 'passed', scope: 'sandbox' }));
})().catch(error => { console.error(/^[A-Z_]+$/.test(error.message) ? error.message : 'CHECKPOINT_FAILED'); process.exitCode = 1; });
