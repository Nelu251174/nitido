import type { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { CITIES } from './cities';
import { initializeMarketing, marketingKey, MarketingError, normalizeMarketingInput, saveMarketingContacts } from './adminMarketing';
import { collectBusinessWebsite, MARKETING_PUBLIC_SOURCE, publicEmails } from './adminMarketingWebCollection';
import { processMarketingDiscovery } from './adminMarketingDiscovery';
import { publicWebsite, readPublicPage, type PublicReader } from './adminMarketingPublicWeb';
import { readMarketingCitySnapshot } from './adminMarketingCitySnapshot';
import type { MarketingCategory, MarketingInput } from './adminMarketingShared';
import type { MarketingCityItem, MarketingCityJob, MarketingCityView } from './adminMarketingCityShared';

export const MARKETING_CITY_SCHEMA=`
CREATE TABLE IF NOT EXISTS marketing_city_jobs(id TEXT PRIMARY KEY,city TEXT NOT NULL,city_key TEXT NOT NULL,state TEXT NOT NULL,total INTEGER NOT NULL DEFAULT 0,saved INTEGER NOT NULL DEFAULT 0,duplicates INTEGER NOT NULL DEFAULT 0,message TEXT NOT NULL DEFAULT '',next_attempt_at TEXT,attempts INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,created_by TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS marketing_city_items(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES marketing_city_jobs(id),name TEXT NOT NULL,category TEXT NOT NULL,email TEXT NOT NULL DEFAULT '',website TEXT NOT NULL DEFAULT '',source TEXT NOT NULL,osm_source TEXT NOT NULL,phone TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending',warning TEXT NOT NULL DEFAULT '',contact_id TEXT,UNIQUE(job_id,osm_source));
CREATE INDEX IF NOT EXISTS marketing_city_pending ON marketing_city_items(job_id,status,id);
CREATE INDEX IF NOT EXISTS marketing_city_site ON marketing_city_items(job_id,website,status);
CREATE TABLE IF NOT EXISTS marketing_city_usage(id TEXT PRIMARY KEY,created_at TEXT NOT NULL,reserved_bytes INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS marketing_collection_lock(id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT NOT NULL,until_ms INTEGER NOT NULL);
`;
const ACTIVE="('queued','discovering','collecting','waiting')";
const SOURCE_BYTES=2000000;
const now=()=>new Date().toISOString();
function sourceRetryAt(value: string|string[]|undefined){
 const earliest=Date.now()+5*60000;
 const header=Array.isArray(value)?value[0]:value;
 const requested=header&&/^\d+$/.test(header.trim())?Date.now()+Number(header.trim())*1000:Date.parse(header??'');
 const valid=Number.isFinite(requested)&&!Number.isNaN(new Date(requested).getTime());
 return new Date(valid?Math.max(earliest,requested):earliest).toISOString();
}
type JobRow={id:string;city:string;state:MarketingCityJob['state'];total:number;saved:number;duplicates:number;message:string;next_attempt_at:string|null;attempts:number;created_at:string;updated_at:string;created_by:string};
type ItemRow=MarketingCityItem & {job_id:string;phone:string;contact_id:string|null;osm_source:string};
export function initializeMarketingCity(db:Database){initializeMarketing(db);db.exec(MARKETING_CITY_SCHEMA);}
function audit(db:Database,action:string,id:string,actor:string){db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),action,id,JSON.stringify({actor}));}
export function canonicalMarketingCity(value:unknown){if(typeof value!=='string'||!value.trim()||value.length>100||/[\x00-\x1f]/.test(value))throw new MarketingError('Completează municipiul.');return CITIES.find(city=>marketingKey(city.name)===marketingKey(value))?.name??value.trim();}
export function marketingCityQuery(city:string){
 const name=JSON.stringify(canonicalMarketingCity(city));
 const area=marketingKey(city)==='bucuresti'?'rel(area.ro)["ISO3166-2"="RO-B"];':`rel(area.ro)["boundary"="administrative"]["admin_level"~"^(8|9)$"]["name"=${name}];`;
 const filters=['[office]','[shop]','[craft]','[industrial]','[company]','["tourism"~"^(hotel|guest_house|hostel|motel|apartment|camp_site)$"]','["amenity"~"^(restaurant|cafe|fast_food|bar|pub|bank|clinic|dentist|doctors|pharmacy|veterinary|hospital|car_rental|car_wash|fuel|cinema|theatre|childcare|training|driving_school|language_school)$"]','["leisure"~"^(fitness_centre|sports_centre)$"]'];
 return `[out:json][timeout:25][maxsize:33554432];area["ISO3166-1"="RO"]->.ro;${area}map_to_area->.city;.city out ids;(${filters.map(filter=>`nwr(area.city)["name"]${filter};`).join('')});out tags;`;
}
function rows(db:Database,id:string){const row=db.prepare('SELECT * FROM marketing_city_jobs WHERE id=?').get(id) as JobRow|undefined;if(!row)throw new MarketingError('Colectarea municipiului nu există.',404);return row;}
export function marketingCityView(db:Database,id?:string,page=1):MarketingCityView|null{
 initializeMarketingCity(db);
 if(!Number.isInteger(page)||page<1||page>10000)throw new MarketingError('Pagină invalidă.');
 if(!id){const latest=db.prepare('SELECT id FROM marketing_city_jobs ORDER BY created_at DESC LIMIT 1').get() as {id:string}|undefined;if(!latest)return null;id=latest.id;}
 const row=rows(db,id);
 const counts=db.prepare("SELECT COUNT(*) total,COALESCE(SUM(status IN ('done','error')),0) processed,COALESCE(SUM(status IN ('done','error') AND email<>''),0) emails,COALESCE(SUM(status IN ('done','error') AND email=''),0) withoutEmail,COALESCE(SUM(warning<>'' AND status IN ('done','error')),0) errors FROM marketing_city_items WHERE job_id=?").get(id) as {total:number;processed:number;emails:number;withoutEmail:number;errors:number};
 const items=db.prepare('SELECT * FROM marketing_city_items WHERE job_id=? ORDER BY name,id LIMIT 50 OFFSET ?').all(id,(page-1)*50) as ItemRow[];
 return {job:{id,city:row.city,state:row.state,total:row.total,processed:counts.processed,emails:counts.emails,saved:row.saved,duplicates:row.duplicates,withoutEmail:counts.withoutEmail,errors:counts.errors,createdAt:row.created_at,updatedAt:row.updated_at,message:row.message,nextAttemptAt:row.next_attempt_at},items:items.map(item=>({...item,contactId:item.contact_id})),page,pages:Math.max(1,Math.ceil(counts.total/50)),attribution:'© OpenStreetMap contributors · ODbL. Acoperire la nivelul municipiului în această sursă; nu este registrul complet al firmelor înregistrate.'};
}
export function startMarketingCity(db:Database,value:unknown,actor:string){
 const b=value as Record<string,unknown>;const city=canonicalMarketingCity(b?.city);initializeMarketingCity(db);
 return db.transaction(()=>{
  const active=db.prepare(`SELECT id,city_key FROM marketing_city_jobs WHERE state IN ${ACTIVE} LIMIT 1`).get() as {id:string;city_key:string}|undefined;
  if(active){if(active.city_key===marketingKey(city))return marketingCityView(db,active.id)!;throw new MarketingError('Există deja un municipiu în colectare. Pune-l în pauză înainte de o căutare nouă.',409);}
  const normal=db.prepare("SELECT 1 FROM sqlite_master WHERE name='marketing_discovery'").get();
  if(normal&&db.prepare("SELECT 1 FROM marketing_discovery WHERE status IN ('pending','running','cancel_requested')").get())throw new MarketingError('Așteaptă sau anulează colectarea curentă înainte de pornirea municipiului.',409);
  const id=randomUUID(),time=now();db.prepare("INSERT INTO marketing_city_jobs(id,city,city_key,state,created_at,updated_at,created_by) VALUES(?,?,?,'queued',?,?,?)").run(id,city,marketingKey(city),time,time,actor);audit(db,'marketing.city.started',id,actor);return marketingCityView(db,id)!;
 }).immediate();
}
export function setMarketingCityState(db:Database,id:string,action:string,actor:string){
 initializeMarketingCity(db);return db.transaction(()=>{
  const job=rows(db,id);
  if(action==='pause'&&['queued','discovering','collecting','waiting'].includes(job.state))db.prepare("UPDATE marketing_city_jobs SET state='paused',updated_at=? WHERE id=?").run(now(),id);
  else if(action==='cancel'&&job.state!=='completed')db.prepare("UPDATE marketing_city_jobs SET state='canceled',updated_at=? WHERE id=?").run(now(),id);
  else if(action==='resume'&&['paused','waiting'].includes(job.state)){
   if(job.next_attempt_at&&job.next_attempt_at>now())throw new MarketingError('Așteaptă expirarea pauzei sursei înainte de reluarea colectării.',409);
   if(db.prepare(`SELECT 1 FROM marketing_city_jobs WHERE id<>? AND state IN ${ACTIVE}`).get(id))throw new MarketingError('Alt municipiu este în colectare.',409);
   const normal=db.prepare("SELECT 1 FROM sqlite_master WHERE name='marketing_discovery'").get();if(normal&&db.prepare("SELECT 1 FROM marketing_discovery WHERE status IN ('pending','running','cancel_requested')").get())throw new MarketingError('Altă colectare este în curs.',409);
   db.prepare("UPDATE marketing_city_jobs SET state=?,message='',next_attempt_at=NULL,attempts=0,updated_at=? WHERE id=?").run(job.total?'collecting':'queued',now(),id);
  }else throw new MarketingError('Acțiunea nu este disponibilă pentru această stare.',409);
  audit(db,'marketing.city.'+action,id,actor);return marketingCityView(db,id)!;
 }).immediate();
}
export function reserveMarketingCitySource(db:Database){
 initializeMarketingCity(db);return db.transaction(()=>{
  const day=now().slice(0,10),normalExists=db.prepare("SELECT 1 FROM sqlite_master WHERE name='marketing_discovery'").get();
  const normal=normalExists?(db.prepare('SELECT COUNT(*) n FROM marketing_discovery WHERE created_at>=?').get(day) as {n:number}).n:0;
  const used=db.prepare('SELECT COUNT(*) n,COALESCE(SUM(reserved_bytes),0) bytes FROM marketing_city_usage WHERE created_at>=?').get(day) as {n:number;bytes:number};
  if(normal+used.n>=20||normal*250000+used.bytes+SOURCE_BYTES>8000000)return false;
  db.prepare('INSERT INTO marketing_city_usage VALUES(?,?,?)').run(randomUUID(),now(),SOURCE_BYTES);return true;
 }).immediate();
}
function publicCandidate(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;const entry=value as Record<string,unknown>;
 const tags=(entry.tags??{}) as Record<string,string>;
 if(!['node','way','relation'].includes(String(entry.type))||!Number.isSafeInteger(entry.id)||Number(entry.id)<1)return null;
 const name=String(tags.name??'').replace(/\s+/g,' ').trim().slice(0,180);if(!name)return null;
 let website=String(tags['contact:website']||tags.website||'').trim();if(website&&!/^https?:\/\//i.test(website))website='https://'+website;
 try{website=website?publicWebsite(website).href:'';if(website.length>500)website='';}catch{website='';}
 const category:MarketingCategory=tags.office==='cleaning'||tags.craft==='cleaning'||/cur[ăa][țţt]enie|cleaning/i.test(name)?'cleaning':'business';
 return {name,category,email:publicEmails(String(tags['contact:email']||tags.email||''))[0]??'',website,source:`https://www.openstreetmap.org/${entry.type}/${entry.id}`,phone:String(tags['contact:phone']||tags.phone||'').slice(0,50)};
}
function saveCityContact(db:Database,input:MarketingInput,actor:string){
 const sites=input.website?[input.website,input.website.replace(/^https:/,'http:'),input.website.replace(/\/$/,'')]:['','',''];
 const existing=db.prepare("SELECT id FROM marketing_contacts WHERE (email<>'' AND email=?) OR (website<>'' AND (website IN (?,?,?) OR rtrim(website,'/')=?)) LIMIT 1").get(input.email,...sites,input.website.replace(/\/$/,'')) as {id:string}|undefined;
 if(existing)return {created:0,duplicates:1,id:existing.id};
 const saved=saveMarketingContacts(db,[input],actor);const row=db.prepare('SELECT id FROM marketing_contacts WHERE category=? AND ((email<>\'\' AND email=?) OR (website<>\'\' AND website=?)) LIMIT 1').get(input.category,input.email,input.website) as {id:string}|undefined;
 return {...saved,id:row?.id??null};
}
async function processCity(db:Database,job:JobRow,reader:PublicReader){
 if(['queued','discovering','waiting'].includes(job.state)){
  if(job.next_attempt_at&&job.next_attempt_at>now())return;
  db.prepare("UPDATE marketing_city_jobs SET state='discovering',updated_at=? WHERE id=?").run(now(),job.id);
  try{
   const snapshot=await readMarketingCitySnapshot(job.city);
   if(rows(db,job.id).state!=='discovering')return;
   if(!snapshot&&!reserveMarketingCitySource(db)){db.prepare("UPDATE marketing_city_jobs SET state='waiting',message=?,next_attempt_at=?,updated_at=? WHERE id=?").run('Limita sursei publice pentru astăzi este atinsă. Colectarea se reia automat mâine.',new Date(Date.now()+86400000).toISOString().slice(0,10)+'T00:01:00.000Z',now(),job.id);return;}
   const response=snapshot??await reader(MARKETING_PUBLIC_SOURCE,{method:'POST',body:new URLSearchParams({data:marketingCityQuery(job.city)}).toString(),timeoutMs:30000,maxBytes:SOURCE_BYTES});
   if(response.status!==200)throw Object.assign(Error('SOURCE_HTTP_'+response.status),{
    retryAt:sourceRetryAt([429,503].includes(response.status)?response.headers['retry-after']:undefined),
   });
   let result;try{result=JSON.parse(response.text);}catch{throw Error('SOURCE_RESPONSE_INVALID');}
   if(!Array.isArray(result.elements)||result.remark)throw Error('SOURCE_QUERY_INCOMPLETE');
   if(result.elements.length>20001)throw new MarketingError('Inventarul depășește limita de protecție de 20.000 de înregistrări. Nu a fost marcat drept complet.');
   if(result.elements.filter((entry:{type?:string})=>entry?.type==='area').length!==1)throw new MarketingError('Sursa nu a identificat o singură limită administrativă pentru municipiu. Verifică numele înainte de reluare.');
   const candidates=result.elements.map(publicCandidate).filter(Boolean) as NonNullable<ReturnType<typeof publicCandidate>>[];
   db.transaction(()=>{
    if(rows(db,job.id).state!=='discovering')return;
    const insert=db.prepare('INSERT OR IGNORE INTO marketing_city_items(id,job_id,name,category,email,website,source,osm_source,phone) VALUES(?,?,?,?,?,?,?,?,?)');
    for(const item of candidates)insert.run(randomUUID(),job.id,item.name,item.category,item.email,item.website,item.source,item.source,item.phone);
    const total=(db.prepare('SELECT COUNT(*) n FROM marketing_city_items WHERE job_id=?').get(job.id) as {n:number}).n;
    db.prepare("UPDATE marketing_city_jobs SET state=?,total=?,message=?,attempts=0,next_attempt_at=NULL,updated_at=? WHERE id=?").run(total?'collecting':'completed',total,total?'Firmele disponibile în sursă au fost preluate. Urmează verificarea site-urilor.':'Sursa nu a returnat firme pentru municipiul selectat.',now(),job.id);
   }).immediate();
  }catch(error){
   if(error instanceof MarketingError){db.prepare("UPDATE marketing_city_jobs SET state='paused',message=?,next_attempt_at=NULL,updated_at=? WHERE id=? AND state='discovering'").run(error.message,now(),job.id);return;}
   const known=new Set(['SOURCE_RESPONSE_INVALID','SOURCE_QUERY_INCOMPLETE','PUBLIC_DNS_TIMEOUT','PUBLIC_PAGE_TIMEOUT','PUBLIC_PAGE_TOO_LARGE','EAI_AGAIN','ENOTFOUND','ECONNRESET','ECONNREFUSED','ENETUNREACH','ETIMEDOUT','ABORT_ERR','UNABLE_TO_VERIFY_LEAF_SIGNATURE','CERT_HAS_EXPIRED']);
   const message=error instanceof Error?error.message:'',code=typeof (error as {code?:unknown})?.code==='string'?String((error as {code:string}).code):'';
   const reason=/^SOURCE_HTTP_[1-5]\d\d$/.test(message)?message:known.has(code)?code:known.has(message)?message:'SOURCE_READ_FAILED';
   const denied=['SOURCE_HTTP_403','SOURCE_HTTP_406'].includes(reason);
   const paused=job.attempts>=2||denied;
   const retryAt=(error as {retryAt?:string})?.retryAt??sourceRetryAt(undefined);
   const messageText=paused?'Sursa publică nu a răspuns complet ['+reason+']. Colectarea este în pauză și necesită verificare înainte de reluare.':'Sursa publică nu a răspuns complet ['+reason+']. Nu este o colectare finalizată. Reîncercarea respectă pauza cerută de sursă.';
   db.prepare("UPDATE marketing_city_jobs SET state=?,attempts=attempts+1,message=?,next_attempt_at=?,updated_at=? WHERE id=? AND state='discovering'").run(paused?'paused':'waiting',messageText,denied?null:retryAt,now(),job.id);
  }
  return;
 }
 if(job.state!=='collecting')return;
 // Empty/contact-tagged records need no network request; avoid delaying a municipality by 20 rows per tick.
 // Website reads remain serial and the existing 15-second batch deadline still bounds external work.
 const batch=db.prepare("SELECT * FROM marketing_city_items WHERE job_id=? AND status='pending' ORDER BY id LIMIT 200").all(job.id) as ItemRow[];
 const deadline=Date.now()+15000;let inBatch=0;
 for(const item of batch){
  if(inBatch++>0&&Date.now()>deadline)break;
  if(rows(db,job.id).state!=='collecting')return;
  let email=item.email,source=item.source,warning='';
  if(!email&&item.website){
   const cached=db.prepare("SELECT email,source FROM marketing_city_items WHERE job_id=? AND website=? AND email<>'' AND status IN ('done','error') LIMIT 1").get(job.id,item.website) as {email:string;source:string}|undefined;
   if(cached){email=cached.email;source=cached.source;}
   else try{const page=await collectBusinessWebsite(item.website,reader);if(page.found[0]){email=page.found[0].email;source=page.found[0].source;}}catch{warning='Emailul public nu a putut fi verificat pe site. Necesită verificare manuală.';}
  }
  db.transaction(()=>{
   if(rows(db,job.id).state!=='collecting')return;
   const existing=db.prepare("SELECT status FROM marketing_city_items WHERE id=?").get(item.id) as {status:string};if(existing.status!=='pending')return;
   let saved={created:0,duplicates:0,id:null as string|null};
   if(email||item.website){
    let input:MarketingInput|undefined;
    try{input=normalizeMarketingInput({name:item.name,category:item.category,city:job.city,email,website:item.website,phone:item.phone,source,consent:'not_recorded',notes:`Colectare municipiu ${job.city}, ${now().slice(0,10)}. Sursa inițială: ${item.osm_source}. © OpenStreetMap contributors · ODbL. Localitatea și categoria necesită verificare. Emailul public nu reprezintă acord de marketing.`});}
    catch{warning='Datele firmei necesită completare manuală înainte de salvare.';}
    if(input){saved=saveCityContact(db,input,job.created_by);if(saved.created)audit(db,'marketing.city.contact.saved',saved.id??job.id,job.created_by);}
   }
   db.prepare('UPDATE marketing_city_items SET email=?,source=?,status=?,warning=?,contact_id=? WHERE id=?').run(email,source,warning?'error':'done',warning,saved.id,item.id);
   db.prepare('UPDATE marketing_city_jobs SET saved=saved+?,duplicates=duplicates+?,updated_at=? WHERE id=?').run(saved.created,saved.duplicates,now(),job.id);
  }).immediate();
 }
 if(!db.prepare("SELECT 1 FROM marketing_city_items WHERE job_id=? AND status='pending'").get(job.id)){
  db.transaction(()=>{if(rows(db,job.id).state!=='collecting')return;db.prepare("UPDATE marketing_city_jobs SET state='completed',message=?,updated_at=? WHERE id=?").run('Firmele disponibile în sursă au fost procesate. Lista nu reprezintă toate firmele înregistrate în municipiu.',now(),job.id);audit(db,'marketing.city.completed',job.id,job.created_by);}).immediate();
 }
}
/** One public collector at a time across processes; resumption uses persisted inventory. */
export async function processMarketingCollections(db:Database,reader:PublicReader=readPublicPage){
 initializeMarketingCity(db);const owner=randomUUID();
 const locked=db.transaction(()=>{
  const old=db.prepare('SELECT until_ms FROM marketing_collection_lock WHERE id=1').get() as {until_ms:number}|undefined;if(old&&old.until_ms>Date.now())return false;
  db.prepare('INSERT INTO marketing_collection_lock VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,until_ms=excluded.until_ms').run(owner,Date.now()+10*60000);return true;
 }).immediate();if(!locked)return;
 const guardedReader:PublicReader=async(url,options)=>{
  const lock=db.prepare('SELECT owner FROM marketing_collection_lock WHERE id=1').get() as {owner:string}|undefined;if(lock?.owner!==owner)throw Error('COLLECTION_LEASE_LOST');
  db.prepare('UPDATE marketing_collection_lock SET until_ms=? WHERE id=1 AND owner=?').run(Date.now()+10*60000,owner);return reader(url,options);
 };
 try{
  const job=db.prepare(`SELECT * FROM marketing_city_jobs WHERE state IN ${ACTIVE} AND (next_attempt_at IS NULL OR next_attempt_at<=?) ORDER BY created_at LIMIT 1`).get(now()) as JobRow|undefined;
  if(job)await processCity(db,job,guardedReader);else await processMarketingDiscovery(db,guardedReader);
 }finally{db.prepare('DELETE FROM marketing_collection_lock WHERE id=1 AND owner=?').run(owner);}
}
export function exportMarketingCity(db:Database,id:string){
 initializeMarketingCity(db);const job=rows(db,id);const items=db.prepare('SELECT * FROM marketing_city_items WHERE job_id=? ORDER BY name,id').all(id) as ItemRow[];
 const cell=(value:string)=>'"'+(/^[\s]*[=+\-@]/.test(value)?"'"+value:value).replaceAll('"','""')+'"';
 return '\uFEFF'+[['name','city','category','email','website','source','status','warning'],...items.map(item=>[item.name,job.city,item.category,item.email,item.website,item.source,item.status,item.warning])].map(row=>row.map(cell).join(',')).join('\r\n');
}
