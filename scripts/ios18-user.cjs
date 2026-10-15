// Run once inside the owner's production container. Only the dedicated synthetic
// App Review client can be inserted/updated; normal users/admin configuration stay intact.
function applyReviewClient(db, input) {
  const crypto = require('node:crypto');
  if (input.e !== 'apple-review-ios18@nitido.ro' || !/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(input.h)) throw Error('INVALID_REVIEW_SCOPE');
  if (input.p != null && (typeof input.p !== 'string' || input.p.length > 40)) throw Error('INVALID_REVIEW_PHONE');
    db.pragma('foreign_keys = ON');
    if (db.pragma('integrity_check', {simple: true}) !== 'ok') throw Error('PRECHECK_FAILED');
    const counts = () => ['firms','jobs','payments'].map(t => db.prepare('SELECT COUNT(*) n FROM ' + t).get().n);
    const before = JSON.stringify(counts());
    const existing = db.prepare('SELECT id,role,name FROM users WHERE email=?').get(input.e);
    if (existing && (existing.role !== 'client' || existing.name !== 'NITIDO Apple App Review')) throw Error('EXISTING_ACCOUNT_MUST_BE_PRESERVED');
    db.transaction(() => {
      if (existing) {
        db.prepare('UPDATE users SET password_hash=? WHERE id=? AND email=? AND role=? AND name=?')
          .run(input.h, existing.id, input.e, 'client', 'NITIDO Apple App Review');
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(existing.id);
      } else {
        let code;
        do { code = 'R18' + crypto.randomBytes(4).toString('hex').toUpperCase(); }
        while (db.prepare('SELECT id FROM users WHERE referral_code=?').get(code));
        db.prepare('INSERT INTO users(id,role,name,email,phone,password_hash,referral_code,credit_balance) VALUES(?,?,?,?,?,?,?,0)')
          .run('user_review_' + crypto.randomUUID(), 'client', 'NITIDO Apple App Review', input.e, input.p, input.h, code);
      }
      if (before !== JSON.stringify(counts()) || db.pragma('foreign_key_check').length) throw Error('UNEXPECTED_DATA_CHANGE');
    })();
    return {appReviewClientReady:true,created:!existing,role:'client',normalAccountsUnchanged:true};
}
module.exports = {applyReviewClient};
if (require.main === module) (async () => {
  const Database = require('better-sqlite3');
  await require('node:fs/promises').mkdir('/app/data/backups', {recursive:true,mode:0o700});
  const {verifyDatabaseBackup} = await import('file:///app/scripts/verify-database-backup.mjs');
  const backup = '/app/data/backups/ios18-review-' + Date.now();
  const verified = await verifyDatabaseBackup('/app/data/nitido.db', backup);
  if (verified.status !== 'passed') throw Error('BACKUP_NOT_VERIFIED');
  const db = new Database('/app/data/nitido.db');
  try { console.log(JSON.stringify({...applyReviewClient(db, JSON.parse(Buffer.from(process.argv[2],'base64').toString('utf8'))),backupVerified:true})); }
  finally { db.close(); }
})().catch(() => { console.error('REVIEW_CLIENT_PROVISION_FAILED'); process.exitCode=1; });
