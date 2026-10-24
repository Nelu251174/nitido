// Read-only aggregate state. Never imports application initializers or message transports.
const scope = { 'https://nitido.ro': 'live', 'https://sandbox.nitido.ro': 'sandbox' }[process.env.NEXT_PUBLIC_SITE_URL];
if (!scope) throw Error('MARKETING_ORIGIN_GUARD');
const Database = require('better-sqlite3');
const fs = require('node:fs');
const db = new Database('/app/data/nitido.db', { readonly: true, fileMustExist: true });
try {
  const exists = table => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
  const job = exists('marketing_city_jobs') ? db.prepare(
    "SELECT id,state,total,saved,duplicates,attempts,message,next_attempt_at FROM marketing_city_jobs WHERE city_key='constanta' ORDER BY created_at DESC LIMIT 1"
  ).get() : null;
  const inventory = job && exists('marketing_city_items') ? db.prepare(
    "SELECT COUNT(*) total,COALESCE(SUM(status IN ('done','error')),0) processed,COALESCE(SUM(email<>''),0) withEmail,COALESCE(SUM(status IN ('done','error') AND email<>''),0) processedWithEmail FROM marketing_city_items WHERE job_id=?"
  ).get(job.id) : null;
  const contacts = job && exists('marketing_contacts') ? db.prepare("SELECT c.status,c.consent,COUNT(DISTINCT c.id) count,COUNT(DISTINCT CASE WHEN c.email<>'' THEN c.id END) withEmail FROM marketing_contacts c JOIN marketing_city_items i ON i.contact_id=c.id WHERE i.job_id=? GROUP BY c.status,c.consent").all(job.id) : [];
  const outbox = exists('marketing_outbox') ? db.prepare(
    'SELECT mode,status,COUNT(*) count FROM marketing_outbox GROUP BY mode,status'
  ).all() : [];
  console.log('MKT_CITY_STATUS ' + JSON.stringify({
    scope,
    buildId: fs.readFileSync('/app/.next/BUILD_ID', 'utf8').trim(),
    delivery: process.env.NITIDO_MARKETING_DELIVERY_ENABLED === 'true' ? 'enabled' : 'blocked',
    job: job ? Object.fromEntries(Object.entries(job).filter(([key]) => key !== 'id')) : null,
    collector: exists('marketing_collection_lock') && db.prepare('SELECT 1 FROM marketing_collection_lock WHERE id=1 AND until_ms>?').get(Date.now()) ? 'busy' : 'idle',
    inventory, contacts, outbox,
  }));
} finally { db.close(); }
