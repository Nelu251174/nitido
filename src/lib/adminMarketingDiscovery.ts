import type { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { MarketingError } from './adminMarketing';
import { collectMarketingWeb } from './adminMarketingWebCollection';
import type { PublicReader } from './adminMarketingPublicWeb';
export const DISCOVERY_SCHEMA=`CREATE TABLE IF NOT EXISTS marketing_discovery(id TEXT PRIMARY KEY,status TEXT NOT NULL,request TEXT NOT NULL,result TEXT,completed INTEGER NOT NULL DEFAULT 0,total INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,created_by TEXT NOT NULL);`;
export function getMarketingDiscovery(db:Database,id:string) { db.exec(DISCOVERY_SCHEMA); const row=db.prepare('SELECT id,status,result,completed,total,created_at FROM marketing_discovery WHERE id=?').get(id) as {id:string;status:string;result:string|null;completed:number;total:number;created_at:string}|undefined;if(!row)throw new MarketingError('Colectarea nu există.',404);return {...row,result:row.result?JSON.parse(row.result):null}; }
export function startMarketingDiscovery(db:Database,value:unknown,actor:string) {
  const b=value as Record<string,unknown>;
  if(!b || !['business','cleaning'].includes(String(b.category)) || typeof b.city!=='string' || !b.city.trim() || b.city.length>100 || (b.websites!==undefined && (typeof b.websites!=='string' || b.websites.length>10000)) || !Number.isInteger(Number(b.limit??10)) || Number(b.limit??10)<1 || Number(b.limit??10)>20)throw new MarketingError('Localitate, categorie sau limită de colectare invalidă.');
  db.exec(DISCOVERY_SCHEMA);
  return db.transaction(()=>{
    const stale=new Date(Date.now()-10*60000).toISOString();
    db.prepare("UPDATE marketing_discovery SET status='failed',result=? WHERE status IN ('running','cancel_requested') AND updated_at<?").run(JSON.stringify({error:'Colectare întreruptă. Pornește o căutare nouă.'}),stale);
    if(db.prepare("SELECT 1 FROM marketing_discovery WHERE status IN ('pending','running','cancel_requested')").get())throw new MarketingError('Există deja o colectare în curs. Așteaptă finalizarea.',409);
    const day=new Date().toISOString().slice(0,10);
    if((db.prepare('SELECT COUNT(*) n FROM marketing_discovery WHERE created_at>=?').get(day) as {n:number}).n>=20)throw new MarketingError('Limita de 20 de căutări publice pe zi a fost atinsă.',429);
    const id=randomUUID(),now=new Date().toISOString();
    db.prepare("INSERT INTO marketing_discovery(id,status,request,created_at,updated_at,created_by) VALUES(?,'pending',?,?,?,?)").run(id,JSON.stringify(b),now,now,actor);return getMarketingDiscovery(db,id);
  }).immediate();
}
export async function processMarketingDiscovery(db:Database,reader?:PublicReader) {
  db.exec(DISCOVERY_SCHEMA);
  db.prepare("UPDATE marketing_discovery SET status='failed',result=? WHERE status IN ('running','cancel_requested') AND updated_at<?").run(JSON.stringify({error:'Colectare întreruptă. Pornește o căutare nouă.'}),new Date(Date.now()-10*60000).toISOString());
  const row=db.transaction(()=>{const job=db.prepare("SELECT id,request FROM marketing_discovery WHERE status='pending' ORDER BY created_at LIMIT 1").get() as {id:string;request:string}|undefined; if(!job)return;db.prepare("UPDATE marketing_discovery SET status='running',updated_at=? WHERE id=?").run(new Date().toISOString(),job.id);return job;}).immediate();
  if(!row)return;
  try {
    const result=await collectMarketingWeb(JSON.parse(row.request),reader,(completed,total)=>{
      const current=getMarketingDiscovery(db,row.id);if(current.status!=='running')throw new MarketingError('Colectare anulată.');
      db.prepare('UPDATE marketing_discovery SET completed=?,total=?,updated_at=? WHERE id=?').run(completed,total,new Date().toISOString(),row.id);
    });
    db.prepare("UPDATE marketing_discovery SET status='completed',result=?,updated_at=? WHERE id=? AND status='running'").run(JSON.stringify(result),new Date().toISOString(),row.id);
  } catch { db.prepare("UPDATE marketing_discovery SET status='canceled' WHERE id=? AND status='cancel_requested'").run(row.id); db.prepare("UPDATE marketing_discovery SET status='failed',result=?,updated_at=? WHERE id=? AND status='running'").run(JSON.stringify({error:'Colectarea nu a reușit. Sursa poate fi indisponibilă sau poate restricționa accesul. Reîncearcă ori introdu site-urile cunoscute.'}),new Date().toISOString(),row.id); }
}
export function cancelMarketingDiscovery(db:Database,id:string) {db.exec(DISCOVERY_SCHEMA);db.prepare("UPDATE marketing_discovery SET status=CASE WHEN status='running' THEN 'cancel_requested' ELSE 'canceled' END,updated_at=? WHERE id=? AND status IN ('pending','running')").run(new Date().toISOString(),id);return getMarketingDiscovery(db,id);}
