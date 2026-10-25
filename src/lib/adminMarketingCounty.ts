import { initializeMarketingDirectory, processMarketingDirectory, retryMarketingDirectoryListings } from './adminMarketingDirectory';
import { collectMarketingCountyWebsite,initializeMarketingCountyWeb } from './adminMarketingCountyWeb';
import type { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { linkMarketingRegion, MarketingError, normalizeMarketingInput, saveMarketingContacts } from './adminMarketing';
import { MARKETING_COUNTY_ORDER, MARKETING_REGIONS, marketingRegion } from './adminMarketingRegions';
import { readCountyManifest, readCountyPart, type CountyManifest, type CountySourceItem } from './adminMarketingCountySnapshot';
import { initializeMarketingEmailChecks, verifyMarketingEmail, type DomainReader } from './adminMarketingEmailVerification';
import { publicEmails } from './adminMarketingWebCollection';
import { publicWebsite, type PublicReader } from './adminMarketingPublicWeb';
import type { CountyState, MarketingCountyView } from './adminMarketingCountyShared';
export const MARKETING_COUNTY_SCHEMA=`
CREATE TABLE IF NOT EXISTS marketing_county_jobs(id TEXT PRIMARY KEY,county_code TEXT NOT NULL UNIQUE,position INTEGER NOT NULL,state TEXT NOT NULL DEFAULT 'queued',manifest TEXT NOT NULL DEFAULT '',part_cursor INTEGER NOT NULL DEFAULT 0,total INTEGER NOT NULL DEFAULT 0,message TEXT NOT NULL DEFAULT '',next_attempt_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,created_by TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS marketing_county_items(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES marketing_county_jobs(id),identity TEXT NOT NULL,name TEXT NOT NULL,category TEXT NOT NULL,city TEXT NOT NULL,website TEXT NOT NULL,phone TEXT NOT NULL,emails TEXT NOT NULL DEFAULT '[]',source TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',warning TEXT NOT NULL DEFAULT '',UNIQUE(job_id,identity));
CREATE INDEX IF NOT EXISTS marketing_county_pending ON marketing_county_items(job_id,status,id);
CREATE TABLE IF NOT EXISTS marketing_county_item_emails(item_id TEXT NOT NULL REFERENCES marketing_county_items(id),email TEXT NOT NULL,source TEXT NOT NULL,PRIMARY KEY(item_id,email));
CREATE INDEX IF NOT EXISTS marketing_county_email ON marketing_county_item_emails(email,item_id);
CREATE TABLE IF NOT EXISTS marketing_county_sites(job_id TEXT NOT NULL,website TEXT NOT NULL,result TEXT NOT NULL,warning TEXT NOT NULL DEFAULT '',PRIMARY KEY(job_id,website));
CREATE TABLE IF NOT EXISTS marketing_county_dispatch(job_id TEXT PRIMARY KEY REFERENCES marketing_county_jobs(id),independent INTEGER NOT NULL DEFAULT 0 CHECK(independent IN (0,1)),last_turn INTEGER NOT NULL DEFAULT 0);
`;
const time=()=>new Date().toISOString();
type Job={id:string;county_code:string;position:number;state:CountyState;manifest:string;part_cursor:number;total:number;message:string;next_attempt_at:string|null;created_at:string;updated_at:string;created_by:string};
type Item={id:string;job_id:string;identity:string;name:string;category:'business'|'cleaning';city:string;website:string;phone:string;emails:string;source:string;status:string;warning:string};
function saveCountyEvidence(db:Database,j:Job,item:Item,found:{email:string;source:string}[]){
 const unique=[...new Map(found.map(f=>[f.email,f])).values()],inputs=unique.length?unique:[{email:'',source:item.source}];let newEvidence=0;
 for(const f of inputs){
  if(!f.email&&!item.website)continue;
  const input=normalizeMarketingInput({...item,email:f.email,source:f.source,county:marketingRegion(j.county_code)!.name,consent:'not_recorded',notes:`Colectare județ ${marketingRegion(j.county_code)!.name}. Sursa inițială ${item.source}. ${item.identity.startsWith('osm:')?'© OpenStreetMap contributors · ODbL.':'Ghidul.ro · date publice de contact ale firmei.'} Emailul public nu reprezintă acord de marketing.`});
  // A shared email retains its existing consent/category; add membership instead of cloning it.
  const existing=f.email?db.prepare('SELECT id FROM marketing_contacts WHERE email=? LIMIT 1').get(f.email) as {id:string}|undefined:undefined;
  if(existing)linkMarketingRegion(db,existing.id,input);else saveMarketingContacts(db,[input],j.created_by);
  if(f.email){
   newEvidence+=db.prepare('INSERT OR IGNORE INTO marketing_county_item_emails VALUES(?,?,?)').run(item.id,f.email,f.source).changes;
   db.prepare("INSERT INTO marketing_email_checks(email,source_status) VALUES(?,'verified') ON CONFLICT(email) DO UPDATE SET source_status='verified',status=CASE WHEN source_status<>'verified' THEN 'pending' ELSE status END").run(f.email);
  }
 }
 return newEvidence;
}
function audit(db:Database,action:string,id:string,actor:string){db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),action,id,JSON.stringify({actor}));}
export function initializeMarketingCounty(db:Database){initializeMarketingEmailChecks(db);db.exec(MARKETING_COUNTY_SCHEMA);initializeMarketingDirectory(db);initializeMarketingCountyWeb(db);
 const columns=db.prepare('PRAGMA table_info(marketing_county_items)').all() as {name:string}[];
 db.transaction(()=>{
  if(!columns.some(c=>c.name==='attempted_at'))db.exec("ALTER TABLE marketing_county_items ADD COLUMN attempted_at TEXT NOT NULL DEFAULT ''");
  if(!columns.some(c=>c.name==='next_attempt_at'))db.exec('ALTER TABLE marketing_county_items ADD COLUMN next_attempt_at TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS marketing_county_retry ON marketing_county_items(job_id,status,next_attempt_at,attempted_at)');
 }).immediate();
}
export function marketingCountyView(db:Database):MarketingCountyView{
 initializeMarketingCounty(db);
 return {order:(db.prepare('SELECT county_code FROM marketing_county_jobs ORDER BY position,created_at').all() as {county_code:string}[]).map(j=>j.county_code),attribution:'© OpenStreetMap contributors · ODbL. Inventarul sursei nu reprezintă registrul complet al firmelor. Verificarea emailului confirmă sintaxa, sursa publică și domeniul de email; nu confirmă existența căsuței și nu acordă consimțământ.',counties:MARKETING_COUNTY_ORDER.map(code=>{
  const r=marketingRegion(code)!;
  const counts=db.prepare(`SELECT COUNT(DISTINCT c.id) contacts,COUNT(DISTINCT NULLIF(c.email,'')) emails,COUNT(DISTINCT CASE WHEN e.status='verified' THEN c.email END) verified,COUNT(DISTINCT CASE WHEN e.status='invalid' THEN c.email END) invalid,COUNT(DISTINCT CASE WHEN e.status='needs_review' THEN c.email END) needsReview,COUNT(DISTINCT CASE WHEN c.email<>'' AND COALESCE(e.status,'pending')='pending' THEN c.email END) pending FROM marketing_contact_regions r JOIN marketing_contacts c ON c.id=r.contact_id LEFT JOIN marketing_email_checks e ON e.email=c.email WHERE r.county_key=?`).get(r.key) as {contacts:number;emails:number;verified:number;invalid:number;needsReview:number;pending:number};
  const j=db.prepare('SELECT * FROM marketing_county_jobs WHERE county_code=?').get(code) as Job|undefined;
  const progress=j?db.prepare(`SELECT COUNT(*) total,COALESCE(SUM(status='done'),0) processed,COALESCE(SUM(status='done' AND NOT EXISTS(SELECT 1 FROM marketing_county_item_emails e WHERE e.item_id=marketing_county_items.id)),0) withoutEmail,COALESCE(SUM(warning<>''),0) warnings FROM marketing_county_items WHERE job_id=?`).get(j.id) as {total:number;processed:number;withoutEmail:number;warnings:number}:null;
  return {code,name:r.name,...counts,job:j?{id:j.id,state:j.state,startedSeparately:!!db.prepare('SELECT 1 FROM marketing_county_dispatch WHERE job_id=? AND independent=1').get(j.id),total:j.total,imported:progress!.total,processed:progress!.processed,withoutEmail:progress!.withoutEmail,warnings:progress!.warnings,message:j.message,updatedAt:j.updated_at,nextAttemptAt:j.next_attempt_at,directory:db.prepare("SELECT COUNT(*) total,COALESCE(SUM(state='done'),0) processed,COALESCE(SUM(state='blocked'),0) blocked FROM marketing_directory_pages WHERE job_id=?").get(j.id) as {total:number;processed:number;blocked:number},websites:db.prepare("SELECT COUNT(*) total,COALESCE(SUM(state='done'),0) processed,COALESCE(SUM(state='blocked'),0) blocked FROM marketing_county_web_pages WHERE job_id=?").get(j.id) as {total:number;processed:number;blocked:number}}:null};
 })};
}
/** Explicitly authorized plan; reading the dashboard never starts collection. */
export function startMarketingCountyPlan(db:Database,actor:string,codes=['CT','B']){
 if(!codes.length||codes.some(c=>!MARKETING_REGIONS.some(r=>r.code===c)))throw new MarketingError('Județe invalide.');
 initializeMarketingCounty(db);
 db.transaction(()=>{for(const code of [...new Set(codes)].sort((a,b)=>MARKETING_COUNTY_ORDER.indexOf(a)-MARKETING_COUNTY_ORDER.indexOf(b))){
  const id=randomUUID(),at=time();
  const changed=db.prepare("INSERT OR IGNORE INTO marketing_county_jobs(id,county_code,position,created_at,updated_at,created_by) VALUES(?,?,?,?,?,?)").run(id,code,MARKETING_COUNTY_ORDER.indexOf(code),at,at,actor).changes;
  if(changed)audit(db,'marketing.county.queued',id,actor);
 }}).immediate();return marketingCountyView(db);
}
export function setMarketingCountyState(db:Database,code:string,action:string,actor:string){
 initializeMarketingCounty(db);const r=marketingRegion(code);if(!r)throw new MarketingError('Județ invalid.');
 db.transaction(()=>{const j=db.prepare('SELECT * FROM marketing_county_jobs WHERE county_code=?').get(r.code) as Job|undefined;
  if(!j)throw new MarketingError('Județul nu este în coadă.',404);
  if(action==='activate'&&j.state==='queued'){
   db.prepare('INSERT INTO marketing_county_dispatch(job_id,independent) VALUES(?,1) ON CONFLICT(job_id) DO UPDATE SET independent=1').run(j.id);
   db.prepare("UPDATE marketing_county_jobs SET message='Pornire separată aprobată. Colectarea nu așteaptă finalizarea celorlalte județe.',updated_at=? WHERE id=?").run(time(),j.id);
  }else if(action==='pause'&&!['completed','review','paused'].includes(j.state))db.prepare("UPDATE marketing_county_jobs SET state='paused',updated_at=? WHERE id=?").run(time(),j.id);
  else if(action==='resume'&&j.state==='paused'){
   if(j.next_attempt_at&&j.next_attempt_at>time())throw new MarketingError('Pauza sursei nu a expirat.',409);
   const retried=retryMarketingDirectoryListings(db,j.id);
   if(retried)audit(db,'marketing.county.listing.retry',j.id,actor);
   db.prepare("UPDATE marketing_county_jobs SET state=?,message='',updated_at=? WHERE id=?").run(j.manifest?'importing':'queued',time(),j.id);
  }else if(action==='enrich'&&j.state==='review'){
   if(db.prepare("SELECT 1 FROM marketing_directory_pages WHERE job_id=? AND state<>'done'").get(j.id))throw new MarketingError('Catalogul județului nu este procesat complet.',409);
   db.prepare("UPDATE marketing_county_items SET status='pending',attempted_at='',next_attempt_at=NULL WHERE job_id=? AND website<>''").run(j.id);
   db.prepare("UPDATE marketing_email_checks SET status='pending',attempts=0,next_attempt_at=NULL WHERE source_status='verified' AND ((status='needs_review' AND domain_status='temporary') OR (status='verified' AND (email LIKE '.%' OR email LIKE '%..%@%' OR email LIKE '%.@%'))) AND EXISTS(SELECT 1 FROM marketing_county_item_emails x JOIN marketing_county_items i ON i.id=x.item_id WHERE x.email=marketing_email_checks.email AND i.job_id=?)").run(j.id);
   db.prepare("UPDATE marketing_county_jobs SET state='collecting',next_attempt_at=NULL,message='Verificarea paginilor publice de contact continuă din progresul salvat.',updated_at=? WHERE id=?").run(time(),j.id);
  }else throw new MarketingError('Acțiunea nu este disponibilă.',409);
  audit(db,'marketing.county.'+action,j.id,actor);
 }).immediate();return marketingCountyView(db);
}
export function countyCandidate(e:CountySourceItem,code:string){
 const tags=e.tags,r=marketingRegion(code)!;let website=String(tags['contact:website']||tags.website||'').trim();
 if(website&&!/^https?:\/\//i.test(website))website='https://'+website;
 try{website=website?publicWebsite(website).href:'';if(website.length>500)website='';}catch{website='';}
 const text=(v:string,max:number)=>String(v||'').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
 let city=text(tags['addr:city']||tags['addr:place']||'',100);
 if(!city)city=r.code==='B'?'București':'Localitate neprecizată';
 if(r.code==='B'&&/sector\s*[1-6]/i.test(tags['addr:suburb']||''))city='București · '+text(tags['addr:suburb'],70);
 return {identity:`osm:${e.type}/${e.id}`,name:text(tags.name,180),category:tags.office==='cleaning'||tags.craft==='cleaning'||/cur[ăa][țţt]enie|cleaning/i.test(tags.name)?'cleaning' as const:'business' as const,city,website,phone:text(tags['contact:phone']||tags.phone,50),emails:publicEmails([tags['contact:email'],tags.email].join(' ')),source:`https://www.openstreetmap.org/${e.type}/${e.id}`};
}
export async function prepareMarketingCountySource(code:string,active:()=>boolean,heartbeat:()=>void){
 const r=marketingRegion(code);if(!r)throw Error('COUNTY_INVALID');
 if(process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw new MarketingError('Trimiterea emailurilor trebuie să rămână oprită.');
 const site=process.env.NEXT_PUBLIC_SITE_URL;
 if(!['https://sandbox.nitido.ro','https://nitido.ro'].includes(site??''))throw Error('COUNTY_SOURCE_ORIGIN_GUARD');
 const args=['--max-old-space-size=384',join(process.cwd(),'scripts','marketing-osm-snapshot.cjs'),'--county='+r.code];if(site==='https://nitido.ro')args.push('--live');
 // Do not pass application credentials to the public extract preparation process.
 const env:NodeJS.ProcessEnv={NODE_ENV:'production',NEXT_PUBLIC_SITE_URL:site,NITIDO_MARKETING_DELIVERY_ENABLED:'false'};
 for(const k of ['PATH','TMPDIR','HOME','HTTPS_PROXY','HTTP_PROXY','NO_PROXY','NODE_EXTRA_CA_CERTS','SSL_CERT_FILE'])if(process.env[k])env[k]=process.env[k];
 await new Promise<void>((resolve,reject)=>{
  const child=spawn(process.execPath,args,{env,stdio:'ignore'});let stopped=false;
  const stop=()=>{stopped=true;child.kill('SIGTERM');};
  const pulse=setInterval(()=>{try{heartbeat();if(!active())stop();}catch{stop();}},5000);
  const timeout=setTimeout(stop,30*60000);
  const cleanup=()=>{clearInterval(pulse);clearTimeout(timeout);};
  child.once('error',()=>{cleanup();reject(Error('COUNTY_SOURCE_PROCESS_FAILED'));});
  child.once('exit',status=>{cleanup();if(status===0&&!stopped)resolve();else reject(Error('COUNTY_SOURCE_PREPARATION_INCOMPLETE'));});
 });
}
type Dependencies={manifest?:typeof readCountyManifest;part?:typeof readCountyPart;prepare?:typeof prepareMarketingCountySource;domain?:DomainReader;directory?:typeof processMarketingDirectory;website?:typeof collectMarketingCountyWebsite};
const progressLog=new WeakMap<Database,Map<string,{at:number;state:string}>>();
function reportCountyProgress(db:Database,j:Job){
 const entries=progressLog.get(db)??new Map<string,{at:number;state:string}>();progressLog.set(db,entries);
 const last=entries.get(j.county_code);if(last?.state===j.state&&Date.now()-last.at<5*60000)return;
 entries.set(j.county_code,{at:Date.now(),state:j.state});
 const inventory=db.prepare("SELECT COUNT(*) inventory,COALESCE(SUM(status='done'),0) processed,COALESCE(SUM(warning<>''),0) warnings FROM marketing_county_items WHERE job_id=?").get(j.id);
 const emails=db.prepare("SELECT e.status,COUNT(DISTINCT e.email) count FROM marketing_email_checks e JOIN marketing_county_item_emails x ON x.email=e.email JOIN marketing_county_items i ON i.id=x.item_id WHERE i.job_id=? GROUP BY e.status").all(j.id);
 const directory=db.prepare("SELECT COUNT(*) total,COALESCE(SUM(state='done'),0) processed,COALESCE(SUM(state='blocked'),0) blocked FROM marketing_directory_pages WHERE job_id=?").get(j.id);
 const websites=db.prepare("SELECT COUNT(*) total,COALESCE(SUM(state='done'),0) processed,COALESCE(SUM(state='blocked'),0) blocked FROM marketing_county_web_pages WHERE job_id=?").get(j.id);
 console.log('MKT_COUNTY_PROGRESS '+JSON.stringify({county:j.county_code,state:j.state,total:j.total,...inventory as object,emails,directory,websites,delivery:process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true'?'enabled':'blocked'}));
}
export async function processMarketingCounty(db:Database,reader:PublicReader,heartbeat:()=>void=()=>{},deps:Dependencies={}){
 initializeMarketingCounty(db);
 // Ordered by default. Only an explicit activation lets a later county advance independently.
 const first=db.prepare("SELECT * FROM marketing_county_jobs WHERE state<>'completed' ORDER BY position,created_at LIMIT 1").get() as Job|undefined;
 if(!first)return false;
 const j=db.prepare("SELECT j.* FROM marketing_county_jobs j LEFT JOIN marketing_county_dispatch d ON d.job_id=j.id WHERE (j.id=? OR d.independent=1) AND j.state NOT IN ('completed','paused','review') AND (j.next_attempt_at IS NULL OR j.next_attempt_at<=?) ORDER BY COALESCE(d.last_turn,0),j.position,j.created_at LIMIT 1").get(first.id,time()) as Job|undefined;
 if(!j){reportCountyProgress(db,first);return true;}
 db.prepare('INSERT INTO marketing_county_dispatch(job_id,last_turn) VALUES(?,(SELECT COALESCE(MAX(last_turn),0)+1 FROM marketing_county_dispatch)) ON CONFLICT(job_id) DO UPDATE SET last_turn=excluded.last_turn').run(j.id);
 reportCountyProgress(db,j);
 const active=()=>{heartbeat();return (db.prepare('SELECT state FROM marketing_county_jobs WHERE id=?').get(j.id) as {state:string})?.state!=='paused';};
 try{
  if(['queued','preparing'].includes(j.state)){
   let manifest=await (deps.manifest??readCountyManifest)(j.county_code);
   if(!active())return true;
   if(!manifest){db.prepare("UPDATE marketing_county_jobs SET state='preparing',updated_at=? WHERE id=?").run(time(),j.id);await (deps.prepare??prepareMarketingCountySource)(j.county_code,active,heartbeat);manifest=await (deps.manifest??readCountyManifest)(j.county_code);}
   if(!active())return true;if(!manifest)throw Error('COUNTY_MANIFEST_MISSING');
   db.prepare("UPDATE marketing_county_jobs SET state='importing',manifest=?,total=?,message='',updated_at=? WHERE id=?").run(JSON.stringify(manifest),manifest.total,time(),j.id);return true;
  }
  if(j.state==='importing'){
   const m=JSON.parse(j.manifest) as CountyManifest;
   if(j.part_cursor<m.parts.length){
    const part=await (deps.part??readCountyPart)(m,j.part_cursor);if(!active())return true;
    db.transaction(()=>{
     const insert=db.prepare('INSERT OR IGNORE INTO marketing_county_items(id,job_id,identity,name,category,city,website,phone,emails,source) VALUES(?,?,?,?,?,?,?,?,?,?)');
     for(const e of part){const c=countyCandidate(e,j.county_code);insert.run(randomUUID(),j.id,c.identity,c.name,c.category,c.city,c.website,c.phone,JSON.stringify(c.emails),c.source);}
     db.prepare('UPDATE marketing_county_jobs SET part_cursor=part_cursor+1,updated_at=? WHERE id=?').run(time(),j.id);
    }).immediate();return true;
   }
   const count=(db.prepare('SELECT COUNT(*) n FROM marketing_county_items WHERE job_id=?').get(j.id) as {n:number}).n;
   if(count!==j.total)throw new MarketingError('Inventarul nu coincide cu totalul sursei. Colectarea nu este finalizată.');
   db.prepare("UPDATE marketing_county_jobs SET state='collecting',updated_at=? WHERE id=?").run(time(),j.id);return true;
  }
  if(j.state==='collecting'){
   const source=await (deps.directory??processMarketingDirectory)(db,j,reader,active);
   if(source.blocked)throw new MarketingError('Catalogul public are pagini blocate sau incomplete. Verificarea sursei este necesară.',502);
   if(!active())return true;
   // Already captured public evidence does not wait for its website frontier or retry deadline.
   const captured=db.prepare("SELECT i.* FROM marketing_county_items i WHERE i.job_id=? AND i.status='pending' AND EXISTS(SELECT 1 FROM json_each(i.emails) t WHERE NOT EXISTS(SELECT 1 FROM marketing_county_item_emails x WHERE x.item_id=i.id AND x.email=t.value)) ORDER BY CASE WHEN i.category='cleaning' THEN 0 ELSE 1 END,i.id LIMIT 100").all(j.id) as Item[];
   db.transaction(()=>{for(const item of captured){if(!active())break;const added=saveCountyEvidence(db,j,item,(JSON.parse(item.emails) as string[]).map(email=>({email,source:item.source})));if(added){db.prepare('UPDATE marketing_county_jobs SET updated_at=? WHERE id=?').run(time(),j.id);audit(db,'marketing.county.item.evidence.saved',item.id,j.created_by);}}}).immediate();
   const early=db.prepare("SELECT e.email FROM marketing_email_checks e WHERE e.status='pending' AND (e.next_attempt_at IS NULL OR e.next_attempt_at<=?) AND EXISTS(SELECT 1 FROM marketing_county_item_emails x JOIN marketing_county_items i ON i.id=x.item_id WHERE x.email=e.email AND i.job_id=?) ORDER BY COALESCE(e.checked_at,''),e.email LIMIT 20").all(time(),j.id) as {email:string}[];
   const verificationDeadline=Date.now()+5000;
   for(const e of early){if(!active())return true;if(Date.now()>verificationDeadline)break;await verifyMarketingEmail(db,e.email,deps.domain);}

   const deadline=Date.now()+15000;
   const batch=db.prepare("SELECT i.* FROM marketing_county_items i WHERE i.job_id=? AND i.status='pending' AND (i.next_attempt_at IS NULL OR i.next_attempt_at<=?) ORDER BY CASE WHEN i.website='' THEN 0 ELSE 1 END,i.attempted_at,CASE WHEN i.category='cleaning' THEN 0 ELSE 1 END,i.id LIMIT 200").all(j.id,time()) as Item[];
   for(const item of batch){
    if(Date.now()>deadline||!active())break;
    const found=(JSON.parse(item.emails) as string[]).map(email=>({email,source:item.source}));let warning='',websitePending=false;
    if(item.website){
     const page=await (deps.website??collectMarketingCountyWebsite)(db,j.id,item.website,reader,active);
     if(!active())return true;
     db.prepare('UPDATE marketing_county_items SET attempted_at=?,next_attempt_at=? WHERE id=?').run(time(),page.nextAttemptAt,item.id);
     websitePending=!page.complete;
     found.push(...page.found);warning=page.warning;
     if(websitePending&&!found.length)continue;
    }
    if(!active())return true;
    db.transaction(()=>{
     if((db.prepare('SELECT status FROM marketing_county_items WHERE id=?').get(item.id) as {status:string}).status!=='pending')return;
     const newEvidence=saveCountyEvidence(db,j,item,found);
     db.prepare('UPDATE marketing_county_items SET status=?,warning=? WHERE id=?').run(websitePending?'pending':'done',warning,item.id);
     if(!websitePending||newEvidence)db.prepare('UPDATE marketing_county_jobs SET updated_at=? WHERE id=?').run(time(),j.id);
     if(!websitePending||newEvidence)audit(db,websitePending?'marketing.county.item.evidence.saved':'marketing.county.item.processed',item.id,j.created_by);
    }).immediate();
   }
   if(!db.prepare("SELECT 1 FROM marketing_county_items WHERE job_id=? AND status='pending'").get(j.id))db.prepare("UPDATE marketing_county_jobs SET state='verifying',next_attempt_at=NULL,updated_at=? WHERE id=?").run(time(),j.id);
   else if(!db.prepare("SELECT 1 FROM marketing_county_items WHERE job_id=? AND status='pending' AND (next_attempt_at IS NULL OR next_attempt_at<=?)").get(j.id,time())){let at=(db.prepare("SELECT MIN(next_attempt_at) at FROM marketing_county_items WHERE job_id=? AND status='pending'").get(j.id) as {at:string}).at;
    const mail=db.prepare("SELECT MIN(COALESCE(e.next_attempt_at,?)) at FROM marketing_email_checks e WHERE e.status='pending' AND EXISTS(SELECT 1 FROM marketing_county_item_emails x JOIN marketing_county_items i ON i.id=x.item_id WHERE x.email=e.email AND i.job_id=?)").get(time(),j.id) as {at:string|null};
    if(mail.at){const retry=new Date(Math.max(Date.now()+15000,Date.parse(mail.at))).toISOString();if(retry<at)at=retry;}
    db.prepare('UPDATE marketing_county_jobs SET next_attempt_at=?,updated_at=? WHERE id=?').run(at,time(),j.id);}

   return true;
  }
  if(j.state==='directory'){
   const source=await (deps.directory??processMarketingDirectory)(db,j,reader,active);
   if(source.blocked)throw new MarketingError('Catalogul public are pagini blocate sau incomplete. Județul rămâne nefinalizat; verificarea sursei este necesară.',502);
   if(source.complete)db.prepare("UPDATE marketing_county_jobs SET state='collecting',message='',updated_at=? WHERE id=?").run(time(),j.id);
   return true;
  }
  if(j.state==='verifying'){
   const batch=db.prepare("SELECT e.email FROM marketing_email_checks e WHERE e.status='pending' AND (e.next_attempt_at IS NULL OR e.next_attempt_at<=?) AND EXISTS(SELECT 1 FROM marketing_county_item_emails i JOIN marketing_county_items c ON c.id=i.item_id WHERE i.email=e.email AND c.job_id=?) LIMIT 50").all(time(),j.id) as {email:string}[];
   const deadline=Date.now()+15000;
   for(const e of batch){if(!active()||Date.now()>deadline)break;await verifyMarketingEmail(db,e.email,deps.domain);}
   if(!active())return true;
   const pending=db.prepare("SELECT 1 FROM marketing_email_checks e WHERE e.status='pending' AND EXISTS(SELECT 1 FROM marketing_county_item_emails i JOIN marketing_county_items c ON c.id=i.item_id WHERE i.email=e.email AND c.job_id=?) LIMIT 1").get(j.id);
   if(!pending){
    const directoryExists=db.prepare("SELECT 1 FROM sqlite_master WHERE name='marketing_directory_pages'").get();
    if(!directoryExists||!db.prepare("SELECT 1 FROM marketing_directory_pages WHERE job_id=? AND kind='index' AND state='done'").get(j.id)||db.prepare("SELECT 1 FROM marketing_directory_pages WHERE job_id=? AND state<>'done'").get(j.id)){db.prepare("UPDATE marketing_county_jobs SET state='directory',message='Completare din catalogul public, pe toate categoriile și paginile disponibile.',updated_at=? WHERE id=?").run(time(),j.id);return true;}
    // Completing configured sources does not establish exhaustive county coverage. Never unlock București on this alone.
    db.transaction(()=>{db.prepare("UPDATE marketing_county_jobs SET state='review',message=?,updated_at=? WHERE id=?").run('Inventarul OSM și catalogul public au fost procesate. Urmează verificarea acoperirii și a site-urilor rămase inaccesibile. Județul nu este declarat finalizat.',time(),j.id);audit(db,'marketing.county.source.processed',j.id,j.created_by);}).immediate();
   }
  }
 }catch(error){
  const message=error instanceof MarketingError?error.message:'Sursa județului nu a fost procesată complet. Verificarea și reluarea sunt necesare.';
  db.prepare("UPDATE marketing_county_jobs SET state='paused',message=?,updated_at=? WHERE id=? AND state<>'paused'").run(message,time(),j.id);
 }
 return true;
}

export function marketingCountyInventory(db:Database,code:string,page=1){
 initializeMarketingCounty(db);const r=marketingRegion(code);if(!r||!Number.isSafeInteger(page)||page<1)throw new MarketingError('Selecție invalidă.');
 const job=db.prepare('SELECT id,total FROM marketing_county_jobs WHERE county_code=?').get(r.code) as {id:string;total:number}|undefined;
 if(!job)return {items:[],total:0,page,pages:1};
 const items=db.prepare("SELECT i.id,i.name,i.category,i.city,i.website,i.source,i.status,i.warning,(SELECT json_group_array(json_object('email',x.email,'status',COALESCE(e.status,'pending'))) FROM marketing_county_item_emails x LEFT JOIN marketing_email_checks e ON e.email=x.email WHERE x.item_id=i.id) emails FROM marketing_county_items i WHERE i.job_id=? ORDER BY i.name,i.id LIMIT 50 OFFSET ?").all(job.id,(page-1)*50) as {id:string;name:string;category:string;city:string;website:string;source:string;status:string;warning:string;emails:string}[];
 return {items:items.map(i=>({...i,emails:JSON.parse(i.emails)})),total:job.total,page,pages:Math.max(1,Math.ceil(job.total/50))};
}
