import type { Database } from 'better-sqlite3';
import { publicWebsite,type PublicReader } from './adminMarketingPublicWeb';
import { MarketingError } from './adminMarketing';
import { extractBusinessPage,robotsAllows } from './adminMarketingWebCollection';

const now=()=>new Date().toISOString();
type Found={email:string;source:string};
type Page={url:string;state:string;attempts:number;hops:number;next_attempt_at:string|null};
type Host={origin:string;robots_state:string;robots:string;robots_url:string;robots_hops:number;robots_attempts:number;robots_next_at:string|null;robots_at:string|null;reason:string;next_request_at:string|null;delay_ms:number};
export const MARKETING_COUNTY_WEB_SCHEMA=`
CREATE TABLE IF NOT EXISTS marketing_county_web_pages(job_id TEXT NOT NULL,website TEXT NOT NULL,url TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,hops INTEGER NOT NULL DEFAULT 0,next_attempt_at TEXT,reason TEXT NOT NULL DEFAULT '',found TEXT NOT NULL DEFAULT '[]',redirect_to TEXT NOT NULL DEFAULT '',checked_at TEXT,PRIMARY KEY(job_id,website,url));
CREATE INDEX IF NOT EXISTS marketing_county_web_pending ON marketing_county_web_pages(job_id,website,state,next_attempt_at);
CREATE TABLE IF NOT EXISTS marketing_county_web_hosts(origin TEXT PRIMARY KEY,robots_state TEXT NOT NULL DEFAULT 'pending',robots TEXT NOT NULL DEFAULT '',robots_url TEXT NOT NULL,robots_hops INTEGER NOT NULL DEFAULT 0,robots_attempts INTEGER NOT NULL DEFAULT 0,robots_next_at TEXT,robots_at TEXT,reason TEXT NOT NULL DEFAULT '',next_request_at TEXT,delay_ms INTEGER NOT NULL DEFAULT 2000);
`;
export function initializeMarketingCountyWeb(db:Database){db.exec(MARKETING_COUNTY_WEB_SCHEMA);
 db.transaction(()=>{if(!(db.prepare('PRAGMA table_info(marketing_county_web_pages)').all() as {name:string}[]).some(c=>c.name==='content_hash'))db.exec("ALTER TABLE marketing_county_web_pages ADD COLUMN content_hash TEXT NOT NULL DEFAULT ''");db.exec('CREATE INDEX IF NOT EXISTS marketing_county_web_content ON marketing_county_web_pages(job_id,website,content_hash)');}).immediate();
}
function repeatedContentAncestor(current:URL,previous:string){
 const old=new URL(previous),parts=current.pathname.split('/').filter(Boolean),seen=new Set(parts.map(p=>p.toLowerCase()));
 const prefix=old.pathname.endsWith('/')?old.pathname:old.pathname+'/';
 return current.origin===old.origin&&seen.size<parts.length&&current.pathname.length>old.pathname.length&&current.pathname.startsWith(prefix);
}
function websiteUrl(value:string,base?:string){const u=publicWebsite(base?new URL(value,base).href:value);for(const key of [...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid|msclkid)$/i.test(key))u.searchParams.delete(key);return u;}
function host(db:Database,origin:string){db.prepare('INSERT OR IGNORE INTO marketing_county_web_hosts(origin,robots_url) VALUES(?,?)').run(origin,origin+'/robots.txt');return db.prepare('SELECT * FROM marketing_county_web_hosts WHERE origin=?').get(origin) as Host;}
function requestAt(db:Database,h:Host){db.prepare('UPDATE marketing_county_web_hosts SET next_request_at=? WHERE origin=?').run(new Date(Date.now()+h.delay_ms).toISOString(),h.origin);}
function retryAt(value:string|string[]|undefined){const text=Array.isArray(value)?value[0]:value;const parsed=text&&/^\d+$/.test(text.trim())?Date.now()+Number(text.trim())*1000:Date.parse(text??'');return new Date(Number.isFinite(parsed)&&!Number.isNaN(new Date(parsed).getTime())?Math.max(Date.now()+300000,parsed):Date.now()+300000).toISOString();}
function safeReason(error:unknown){if(error instanceof MarketingError)return 'PUBLIC_DESTINATION_BLOCKED';const code=String((error as NodeJS.ErrnoException)?.code??'');return new Set(['ENOTFOUND','EAI_AGAIN','ECONNRESET','ECONNREFUSED','ETIMEDOUT','ENETUNREACH','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','ERR_TLS_CERT_ALTNAME_INVALID','ABORT_ERR']).has(code)?code:error instanceof Error&&/^PUBLIC_[A-Z_]+$/.test(error.message)?error.message:'PUBLIC_READ_FAILED';}
function retryable(reason:string){return !['CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','ERR_TLS_CERT_ALTNAME_INVALID','ENOTFOUND','PUBLIC_PAGE_TOO_LARGE','PUBLIC_DESTINATION_BLOCKED'].includes(reason);}
function redirectCycle(db:Database,jobId:string,website:string,from:string,to:string){
 const seen=new Set([from]);let target=to;
 while(target){if(seen.has(target))return true;seen.add(target);const row=db.prepare('SELECT redirect_to FROM marketing_county_web_pages WHERE job_id=? AND website=? AND url=?').get(jobId,website,target) as {redirect_to:string}|undefined;target=row?.redirect_to??'';}
 return false;
}
function due(value:string|null){return !value||value<=now();}
function pageFailure(db:Database,jobId:string,website:string,p:Page,reason:string,temporary:boolean,at=retryAt(undefined)){
 db.prepare("UPDATE marketing_county_web_pages SET state=?,attempts=attempts+1,next_attempt_at=?,reason=?,checked_at=? WHERE job_id=? AND website=? AND url=?").run(temporary&&p.attempts<2?'pending':'blocked',at,reason,now(),jobId,website,p.url);
}
/** One resumable robots request; ordinary redirects are validated without treating them as permission. */
async function robotsStep(db:Database,origin:string,reader:PublicReader,active:()=>boolean){
 const h=host(db,origin);if(!due(h.robots_next_at))return;
 let target:URL;try{target=websiteUrl(h.robots_url);}catch{db.prepare("UPDATE marketing_county_web_hosts SET robots_state='blocked',reason='ROBOTS_REDIRECT_INVALID' WHERE origin=?").run(origin);return;}
 const actual=host(db,target.origin);if(!due(actual.next_request_at))return;requestAt(db,actual);
 const fail=(reason:string,temporary:boolean,at=retryAt(undefined))=>db.prepare('UPDATE marketing_county_web_hosts SET robots_state=?,robots_attempts=robots_attempts+1,robots_next_at=?,reason=? WHERE origin=?').run(temporary&&h.robots_attempts<2?'pending':'blocked',at,reason,origin);
 try{
  const r=await reader(target.href,{redirects:false,maxBytes:100000,timeoutMs:8000});if(!active())return;
  if([301,302,303,307,308].includes(r.status)){
   if(!r.headers.location||h.robots_hops>=3){fail('ROBOTS_REDIRECT_LIMIT',false);return;}
   const next=websiteUrl(r.headers.location,target.href);if(next.href===target.href){fail('ROBOTS_REDIRECT_LOOP',false);return;}
   db.prepare('UPDATE marketing_county_web_hosts SET robots_url=?,robots_hops=robots_hops+1,robots_next_at=NULL WHERE origin=?').run(next.href,origin);return;
  }
  if(r.status!==200&&r.status!==404){fail('ROBOTS_HTTP_'+r.status,[429,503].includes(r.status)||r.status>=500,retryAt(r.headers['retry-after']));if([429,503].includes(r.status))db.prepare('UPDATE marketing_county_web_hosts SET next_request_at=? WHERE origin=?').run(retryAt(r.headers['retry-after']),actual.origin);return;}
  if(r.status===200&&/<(?:!doctype|html|body)(?:\s|>)/i.test(r.text)){fail('ROBOTS_NOT_TEXT',false);return;}
  const rules=r.status===404?'':r.text,delay=Math.max(2000,...[...rules.matchAll(/^\s*crawl-delay\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*$/gim)].map(m=>Number(m[1])*1000));
  if(!Number.isFinite(delay)||Number.isNaN(new Date(Date.now()+delay).getTime())){fail('ROBOTS_DELAY_INVALID',false);return;}
  db.prepare("UPDATE marketing_county_web_hosts SET robots_state='ready',robots=?,robots_at=?,robots_next_at=NULL,reason='',delay_ms=?,next_request_at=? WHERE origin=?").run(rules,now(),delay,new Date(Date.now()+delay).toISOString(),origin);
 }catch(error){if(active()){const reason=safeReason(error);fail('ROBOTS_'+reason,retryable(reason));}}
}
function summary(db:Database,jobId:string,website:string){
 const pages=db.prepare('SELECT state,reason,found,next_attempt_at FROM marketing_county_web_pages WHERE job_id=? AND website=?').all(jobId,website) as {state:string;reason:string;found:string;next_attempt_at:string|null}[];
 const found=new Map<string,Found>();
 const previous=db.prepare('SELECT result FROM marketing_county_sites WHERE job_id=? AND website=?').get(jobId,website) as {result:string}|undefined;
 for(const f of previous?JSON.parse(previous.result) as Found[]:[])found.set(f.email,f);
 for(const page of pages)for(const f of JSON.parse(page.found) as Found[])found.set(f.email,f);
 const pending=pages.filter(p=>p.state==='pending'),reasons=[...new Set(pages.filter(p=>p.state==='blocked').map(p=>p.reason))];
 const warning=reasons.length?'Verificarea site-ului este incompletă ['+reasons.join(', ')+'].':'';
 return {complete:pending.length===0,found:[...found.values()],warning,nextAttemptAt:pending.some(p=>due(p.next_attempt_at))?null:pending.map(p=>p.next_attempt_at).filter((v):v is string=>!!v).sort()[0]??null};
}
/** Persistent contact-page frontier. Limits bound each read/tick, never the site's or county's total. */
export async function collectMarketingCountyWebsite(db:Database,jobId:string,website:string,reader:PublicReader,active:()=>boolean){
 initializeMarketingCountyWeb(db);const root=websiteUrl(website).href;
 db.prepare('INSERT OR IGNORE INTO marketing_county_web_pages(job_id,website,url) VALUES(?,?,?)').run(jobId,website,root);
 const page=db.prepare("SELECT * FROM marketing_county_web_pages WHERE job_id=? AND website=? AND state='pending' AND (next_attempt_at IS NULL OR next_attempt_at<=?) ORDER BY attempts,url LIMIT 1").get(jobId,website,now()) as Page|undefined;
 if(!page)return summary(db,jobId,website);
 if(!active())return {...summary(db,jobId,website),complete:false};
 const url=websiteUrl(page.url),h=host(db,url.origin);
 if(h.robots_state==='ready'&&h.robots_at&&Date.parse(h.robots_at)<Date.now()-86400000)db.prepare("UPDATE marketing_county_web_hosts SET robots_state='pending',robots_url=?,robots_hops=0,robots_attempts=0,robots_next_at=NULL WHERE origin=?").run(url.origin+'/robots.txt',url.origin);
 const current=host(db,url.origin);
 if(current.robots_state==='blocked'){pageFailure(db,jobId,website,page,current.reason,false,current.robots_next_at??retryAt(undefined));return summary(db,jobId,website);}
 if(current.robots_state!=='ready'){
  await robotsStep(db,url.origin,reader,active);if(!active())return {...summary(db,jobId,website),complete:false};
  const after=host(db,url.origin),target=host(db,websiteUrl(after.robots_url).origin);
  const at=[after.robots_next_at,after.next_request_at,target.next_request_at].filter((v):v is string=>!!v&&v>now()).sort().at(-1)??null;
  db.prepare('UPDATE marketing_county_web_pages SET next_attempt_at=? WHERE job_id=? AND website=? AND url=?').run(at,jobId,website,page.url);return summary(db,jobId,website);
 }
 if(!robotsAllows(current.robots,url.pathname+url.search)){pageFailure(db,jobId,website,page,'ROBOTS_DISALLOWED',false);return summary(db,jobId,website);}
 if(!due(current.next_request_at)){db.prepare('UPDATE marketing_county_web_pages SET next_attempt_at=? WHERE job_id=? AND website=? AND url=?').run(current.next_request_at,jobId,website,page.url);return summary(db,jobId,website);}
 requestAt(db,current);
 try{
  const r=await reader(url.href,{redirects:false,maxBytes:700000,timeoutMs:8000});if(!active())return {...summary(db,jobId,website),complete:false};
  if([301,302,303,307,308].includes(r.status)){
   if(!r.headers.location||page.hops>=3){pageFailure(db,jobId,website,page,'PAGE_REDIRECT_LIMIT',false);return summary(db,jobId,website);}
   const next=websiteUrl(r.headers.location,url.href);if(next.href.length>500){pageFailure(db,jobId,website,page,'PAGE_URL_TOO_LONG',false);return summary(db,jobId,website);}if(redirectCycle(db,jobId,website,page.url,next.href)){pageFailure(db,jobId,website,page,'PAGE_REDIRECT_LOOP',false);return summary(db,jobId,website);}
   db.transaction(()=>{db.prepare('INSERT OR IGNORE INTO marketing_county_web_pages(job_id,website,url,hops) VALUES(?,?,?,?)').run(jobId,website,next.href,page.hops+1);db.prepare("UPDATE marketing_county_web_pages SET state='done',reason='PAGE_REDIRECTED',redirect_to=?,checked_at=? WHERE job_id=? AND website=? AND url=?").run(next.href,now(),jobId,website,page.url);})();
  }else if(r.status!==200){
   const at=retryAt(r.headers['retry-after']);pageFailure(db,jobId,website,page,'HTTP_'+r.status,[429,503].includes(r.status)||r.status>=500,at);
   if([429,503].includes(r.status))db.prepare('UPDATE marketing_county_web_hosts SET next_request_at=? WHERE origin=?').run(at,url.origin);
  }else if(!/text\/html|application\/xhtml/i.test(String(r.headers['content-type']??''))){pageFailure(db,jobId,website,page,'PAGE_NOT_HTML',false);}
  else{
   const extracted=extractBusinessPage(r.text,url.href,Infinity),found=extracted.emails.map(email=>({email,source:url.href}));
   const same=db.prepare("SELECT url FROM marketing_county_web_pages WHERE job_id=? AND website=? AND state='done' AND content_hash=?").all(jobId,website,extracted.fingerprint) as {url:string}[];
   const cycle=same.some(p=>repeatedContentAncestor(url,p.url));
   db.transaction(()=>{
    for(const raw of cycle?[]:extracted.links){const link=websiteUrl(raw,url.href);if(link.origin!==url.origin)continue;db.prepare('INSERT OR IGNORE INTO marketing_county_web_pages(job_id,website,url,state,reason) VALUES(?,?,?,?,?)').run(jobId,website,link.href,link.href.length>500?'blocked':'pending',link.href.length>500?'PAGE_URL_TOO_LONG':'');}
    db.prepare("UPDATE marketing_county_web_pages SET state='done',found=?,content_hash=?,reason=?,next_attempt_at=NULL,checked_at=? WHERE job_id=? AND website=? AND url=?").run(JSON.stringify(found),extracted.fingerprint,cycle?'DUPLICATE_CONTENT_CYCLE':'',now(),jobId,website,page.url);
   })();
  }
 }catch(error){if(active()){const reason=safeReason(error);pageFailure(db,jobId,website,page,reason,retryable(reason));}}
 const result=summary(db,jobId,website);
 if(result.complete&&active())db.prepare('INSERT INTO marketing_county_sites(job_id,website,result,warning) VALUES(?,?,?,?) ON CONFLICT(job_id,website) DO UPDATE SET result=excluded.result,warning=excluded.warning').run(jobId,website,JSON.stringify(result.found),result.warning);
 return result;
}
