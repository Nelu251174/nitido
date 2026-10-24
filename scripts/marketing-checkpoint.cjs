// Test-only release checkpoint. Never calls messaging or payment services.
const fs = require('node:fs/promises');
const path = require('node:path');
const Database = require('better-sqlite3');
const { createHash } = require('node:crypto');

(async () => {
  if (process.env.NEXT_PUBLIC_SITE_URL !== 'https://sandbox.nitido.ro') throw Error('SANDBOX_REQUIRED');
  const root = '/app/data/release-checkpoints/20261024-before-marketing';
  const file = path.join(root, 'nitido.db');
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  try { await fs.access(file); throw Error('CHECKPOINT_ALREADY_EXISTS'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const source = new Database('/app/data/nitido.db', { readonly: true, fileMustExist: true });
  try { await source.backup(file); } finally { source.close(); }
  await fs.chmod(file, 0o600);
  const backup = new Database(file, { readonly: true, fileMustExist: true });
  try {
    if (backup.pragma('quick_check', { simple: true }) !== 'ok') throw Error('BACKUP_INTEGRITY_FAILED');
    if (backup.prepare("SELECT 1 FROM sqlite_master WHERE name='marketing_contacts'").get()) throw Error('UNEXPECTED_MARKETING_BASELINE');
  } finally { backup.close(); }
  const sha256 = createHash('sha256').update(await fs.readFile(file)).digest('hex');
  const result = { status: 'passed', scope: 'sandbox', createdAt: new Date().toISOString(), databaseSha256: sha256, restorePolicy: 'Return to the previous source, keeping the current data volume. Backup is for isolated investigation only; never overwrite running data.', uploadsChanged: false, emailsSent: 0 };
  await fs.writeFile(path.join(root, 'verification.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ status: 'passed', scope: 'sandbox', databaseSha256: sha256 }));
})().catch(error => { console.error(/^[A-Z_]+$/.test(error.message) ? error.message : 'CHECKPOINT_FAILED'); process.exitCode = 1; });
