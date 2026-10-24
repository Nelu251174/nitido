import type { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { load } from 'cheerio';
import { MarketingError,marketingKey } from './adminMarketing';
import { MARKETING_REGIONS, marketingRegion } from './adminMarketingRegions';
import { publicWebsite,type PublicReader } from './adminMarketingPublicWeb';
import { publicEmails,robotsAllows,marketingVisibleText } from './adminMarketingWebCollection';
const ORIGIN='https://www.ghidul.ro';
const now=()=>new Date().toISOString();
export function initializeMarketingDirectory(db:Database){db.exec(`
CREATE TABLE IF NOT EXISTS marketing_directory_pages(job_id TEXT NOT NULL,url TEXT NOT NULL,kind TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at TEXT,reason TEXT NOT NULL DEFAULT '',parent TEXT NOT NULL DEFAULT '',PRIMARY KEY(job_id,url));
CREATE INDEX IF NOT EXISTS marketing_directory_pending ON marketing_directory_pages(job_id,state,next_attempt_at,kind);
CREATE TABLE IF NOT EXISTS marketing_directory_host(host TEXT PRIMARY KEY,robots TEXT NOT NULL DEFAULT '',robots_at TEXT,next_attempt_at TEXT);
`);}
function directoryUrl(value:string,base=ORIGIN){const url=publicWebsite(new URL(value,base).href);if(url.origin!==ORIGIN||url.search)throw new MarketingError('Legătură de catalog invalidă.');url.hash='';return url;}
export function marketingDirectorySlug(code:string){const r=marketingRegion(code);if(!r)throw new MarketingError('Județ invalid.');return r.code==='DB'?'dimbovita':r.code==='VL'?'vilcea':r.key.replace(/ /g,'-');}
export function parseDirectoryIndex(html:string){
 const $=load(html),links=new Set<string>();$('a[href]').each((_,e)=>{try{const u=directoryUrl($(e).attr('href')!);if(/^\/firme-[a-z-]+\/[^/]+\/$/.test(u.pathname)&&!u.pathname.startsWith('/firme-servicii-publice/'))links.add(u.href);}catch{}});
 if(links.size<100)throw new MarketingError('Catalogul public nu a returnat indexul complet al categoriilor.',502);
 return [...links];
}
export function parseDirectoryCategory(html:string,url:string,code:string){
 const $=load(html),base=directoryUrl(url),slug=marketingDirectorySlug(code);let selected:string|undefined;
 const expected=base.pathname+slug+'/';let countyLinks=0;
 $('a[href]').each((_,e)=>{try{const u=directoryUrl($(e).attr('href')!,base.href);if(u.pathname===expected)selected=u.href;else if(u.pathname.startsWith(base.pathname)&&/^[-a-z]+\/$/.test(u.pathname.slice(base.pathname.length))&&MARKETING_REGIONS.some(r=>marketingDirectorySlug(r.code)===u.pathname.slice(base.pathname.length,-1)))countyLinks++;}catch{}});
 if(!selected&&!countyLinks&&!/\b0\s+firme\b/i.test($('body').text()))throw new MarketingError('Lista județelor lipsește din catalog. Nu s-a presupus că județul este gol.',502);
 return selected;
}
export function parseDirectoryListing(html:string,url:string,code:string){
 const $=load(html),current=directoryUrl(url),slug=marketingDirectorySlug(code),base=current.pathname.replace(/pag-\d+\/$/,'');
 if(!base.endsWith('/'+slug+'/'))throw new MarketingError('Catalogul nu este filtrat după județ.',502);
 const profiles:{url:string;name:string}[]=[];
 $('table.rubrica_firma').each((_,node)=>{
  const row=$(node),anchor=row.find('a.inscriere_titlu').first(),name=anchor.text().replace(/\s+/g,' ').trim();
  const locality=marketingKey(row.find('.firma_txt').first().closest('tr').find('td').map((_,e)=>$(e).text()).get().join(' ')).replace(/\s+/g,' ');
  if(!name||!new RegExp('(?:^|[^a-z])'+'(?:'+marketingRegion(code)!.key.replace(/-/g,'[- ]')+'|'+slug.replace(/-/g,'[- ]')+')'+'(?:[^a-z]|$)').test(locality))return;
  try{const u=directoryUrl(anchor.attr('href')!,current.href);if(/^\/[^/]+\/$/.test(u.pathname)&&!u.pathname.startsWith('/firme-'))profiles.push({url:u.href,name:name.slice(0,180)});}catch{}
 });
 const pages=new Set<string>();$('.all_pages a[href]').each((_,e)=>{try{const u=directoryUrl($(e).attr('href')!,current.href);if(u.pathname.startsWith(base)&&/^pag-[1-9]\d*\/$/.test(u.pathname.slice(base.length)))pages.add(u.href);}catch{}});
 const body=marketingVisibleText($,'body').replace(/\s+/g,' '),count=Number(body.match(/\b(\d[\d.,]*)\s+firme\b/i)?.[1].replace(/[.,]/g,'')??NaN);
 if(!profiles.length&&count!==0)throw new MarketingError('Firmele catalogului nu pot fi citite complet pentru județ.',502);
 if(count>profiles.length&&!pages.size)throw new MarketingError('Catalogul indică mai multe firme decât pagina primită, fără paginare verificabilă.',502);
 return {profiles,pages:[...pages]};
}
export function parseDirectoryProfile(html:string,url:string,code:string){
 const $=load(html),name=$('#span_left_nume').text().replace(/\s+/g,' ').trim().slice(0,180),content=$('#td_continut');
 if(!name||!content.length)throw new MarketingError('Profilul firmei nu poate fi identificat în catalog.',502);
 content.find('script,style,noscript,template,form,footer,.footer,#footer').remove();
 const emails=publicEmails(content.find('a[href^="mailto:"]').map((_,e)=>$(e).attr('href')?.slice(7).split('?')[0]??'').get().join(' ')+' '+marketingVisibleText($,'#td_continut'));
 const external:string[]=[];content.find('a[href]').each((_,e)=>{try{const u=publicWebsite(new URL($(e).attr('href')!,url).href);if(!/(^|\.)(ghidul\.ro|anuntul\.ro|anuntulvideo\.ro|facebook\.com|instagram\.com|youtube\.com|google\.com|google\.ro|twitter\.com|linkedin\.com|trafic\.ro)$/.test(u.hostname)&&!external.includes(u.href))external.push(u.href);}catch{}});
 // Locality is not inferred from descriptions (a firm may advertise services in another city).
 const city=code==='B'?'București':'Localitate neprecizată';
 return {identity:'ghidul:'+directoryUrl(url).pathname.split('/')[1],name,category:/cur[ăa][țţt]enie|cleaning/i.test(name)?'cleaning':'business',city,website:external[0]??'',phone:'',emails,source:url};
}
function retryAt(value:string|string[]|undefined){const raw=Array.isArray(value)?value[0]:value,parsed=raw&&/^\d+$/.test(raw)?Date.now()+Number(raw)*1000:Date.parse(raw??'');return new Date(Number.isFinite(parsed)?Math.max(Date.now()+300000,parsed):Date.now()+300000).toISOString();}
/** Persisted public-source frontier: all linked categories, county pages, pagination and firm profiles. */
export async function processMarketingDirectory(db:Database,job:{id:string;county_code:string},reader:PublicReader,active:()=>boolean){
 initializeMarketingDirectory(db);
 const enqueue=db.prepare('INSERT OR IGNORE INTO marketing_directory_pages(job_id,url,kind,parent) VALUES(?,?,?,?)');
 enqueue.run(job.id,ORIGIN+'/sumar','index','');
 db.prepare('INSERT OR IGNORE INTO marketing_directory_host(host) VALUES(?)').run(ORIGIN);
 const deadline=Date.now()+15000;
 for(let i=0;i<4&&Date.now()<deadline;i++){
  if(!active())return {complete:false,blocked:false};
  const host=db.prepare('SELECT * FROM marketing_directory_host WHERE host=?').get(ORIGIN) as {robots:string;robots_at:string|null;next_attempt_at:string|null};
  if(host.next_attempt_at&&host.next_attempt_at>now())return {complete:false,blocked:false};
  const row=db.prepare("SELECT url,kind,attempts FROM marketing_directory_pages WHERE job_id=? AND state='pending' AND (next_attempt_at IS NULL OR next_attempt_at<=?) ORDER BY CASE kind WHEN 'index' THEN 0 WHEN 'category' THEN 1 WHEN 'listing' THEN 2 ELSE 3 END,url LIMIT 1").get(job.id,now()) as {url:string;kind:string;attempts:number}|undefined;
  if(!row)break;
  const robotsFresh=host.robots_at&&Date.parse(host.robots_at)>Date.now()-86400000;
  const target=robotsFresh?row.url:ORIGIN+'/robots.txt';
  db.prepare('UPDATE marketing_directory_host SET next_attempt_at=? WHERE host=?').run(new Date(Date.now()+Math.max(3000,...[...host.robots.matchAll(/^\s*crawl-delay\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*$/gim)].map(m=>Number(m[1])*1000))).toISOString(),ORIGIN);
  try{
   if(robotsFresh&&!robotsAllows(host.robots,new URL(row.url).pathname))throw new MarketingError('Catalogul nu permite colectarea automată a acestei pagini.',403);
   const response=await reader(target,{redirects:false,maxBytes:1500000,timeoutMs:10000});
   if(!active())return {complete:false,blocked:false};
   if(!robotsFresh){
    if(response.status!==404&&(response.status!==200||/<(?:!doctype|html)/i.test(response.text)))throw Object.assign(Error('DIRECTORY_ROBOTS_UNAVAILABLE'),{retry:retryAt(response.headers['retry-after']),denied:[403,406].includes(response.status)});
    db.prepare('UPDATE marketing_directory_host SET robots=?,robots_at=? WHERE host=?').run(response.status===404?'':response.text,now(),ORIGIN);return {complete:false,blocked:false};
   }
   if(response.status!==200)throw Object.assign(Error('DIRECTORY_HTTP_'+response.status),{retry:retryAt(response.headers['retry-after']),denied:[403,406].includes(response.status)});
   if(new URL(response.url).origin!==ORIGIN||!robotsAllows(host.robots,new URL(response.url).pathname)||!/text\/html|application\/xhtml/i.test(String(response.headers['content-type']??'')))throw new MarketingError('Răspunsul catalogului nu poate fi validat.',502);
   db.transaction(()=>{
    if(row.kind==='index')for(const url of parseDirectoryIndex(response.text))enqueue.run(job.id,url,'category',row.url);
    else if(row.kind==='category'){const selected=parseDirectoryCategory(response.text,row.url,job.county_code);if(selected)enqueue.run(job.id,selected,'listing',row.url);}
    else if(row.kind==='listing'){const result=parseDirectoryListing(response.text,row.url,job.county_code);for(const url of result.pages)enqueue.run(job.id,url,'listing',row.url);for(const p of result.profiles)enqueue.run(job.id,p.url,'profile',row.url);}
    else{
     const c=parseDirectoryProfile(response.text,row.url,job.county_code);
     db.prepare('INSERT OR IGNORE INTO marketing_county_items(id,job_id,identity,name,category,city,website,phone,emails,source) VALUES(?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),job.id,c.identity,c.name,c.category,c.city,c.website,c.phone,JSON.stringify(c.emails),c.source);
     db.prepare('UPDATE marketing_county_jobs SET total=(SELECT COUNT(*) FROM marketing_county_items WHERE job_id=?),updated_at=? WHERE id=?').run(job.id,now(),job.id);
    }
    db.prepare("UPDATE marketing_directory_pages SET state='done',reason='' WHERE job_id=? AND url=?").run(job.id,row.url);
   }).immediate();
  }catch(error){
   const err=error as {denied?:boolean;retry?:string};const denied=err.denied||error instanceof MarketingError&&error.status===403,blocked=denied||row.attempts>=2||error instanceof MarketingError;
   const at=err.retry??retryAt(undefined);
   db.prepare("UPDATE marketing_directory_pages SET state=?,attempts=attempts+1,next_attempt_at=?,reason=? WHERE job_id=? AND url=?").run(blocked?'blocked':'pending',at,error instanceof MarketingError?error.message:'Sursa publică nu a răspuns complet.',job.id,row.url);
   db.prepare('UPDATE marketing_directory_host SET next_attempt_at=? WHERE host=?').run(at,ORIGIN);
   return {complete:false,blocked};
  }
  // Requests remain serial, including the source's Crawl-delay. Yield longer waits to the scheduler.
  const next=(db.prepare('SELECT next_attempt_at FROM marketing_directory_host WHERE host=?').get(ORIGIN) as {next_attempt_at:string}).next_attempt_at;
  const delay=Math.max(0,Date.parse(next)-Date.now());
  if(delay>3000||Date.now()+delay>=deadline)return {complete:false,blocked:false};
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
 }
 const counts=db.prepare("SELECT COALESCE(SUM(state='pending'),0) pending,COALESCE(SUM(state='blocked'),0) blocked FROM marketing_directory_pages WHERE job_id=?").get(job.id) as {pending:number;blocked:number};
 return {complete:!counts.pending&&!counts.blocked,blocked:!!counts.blocked};
}
