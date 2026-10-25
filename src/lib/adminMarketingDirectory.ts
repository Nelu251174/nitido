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
CREATE TABLE IF NOT EXISTS marketing_directory_dispatch(job_id TEXT PRIMARY KEY,turn INTEGER NOT NULL DEFAULT 0);
`);}
function cleaningListing(value:string){try{const u=directoryUrl(value);return /^\/firme-servicii-diverse\/curatenie-servicii\//.test(u.pathname);}catch{return false;}}
/** Persisted rotation gives profiles and cleaning their turn while every category/listing still advances. */
export function nextMarketingDirectoryPage(db:Database,jobId:string){
 const columns='url,kind,attempts,parent';
 const due="job_id=? AND state='pending' AND (next_attempt_at IS NULL OR next_attempt_at<=?)";
 type Row={url:string;kind:string;attempts:number;parent:string};
 const index=db.prepare(`SELECT ${columns} FROM marketing_directory_pages WHERE ${due} AND kind='index' LIMIT 1`).get(jobId,now()) as Row|undefined;
 db.prepare('INSERT OR IGNORE INTO marketing_directory_dispatch(job_id) VALUES(?)').run(jobId);
 const turn=(db.prepare('SELECT turn FROM marketing_directory_dispatch WHERE job_id=?').get(jobId) as {turn:number}).turn;
 const rotations=[['cleaning','profile','listing','category'],['profile','listing','category','cleaning'],['listing','category','profile','cleaning'],['category','profile','listing','cleaning']];
 let row=index;
 for(const kind of rotations[turn%rotations.length]){
  if(row)break;
  const filter=kind==='cleaning'?"(url LIKE 'https://www.ghidul.ro/firme-servicii-diverse/curatenie-servicii/%' OR parent LIKE 'https://www.ghidul.ro/firme-servicii-diverse/curatenie-servicii/%')":"kind=?";
  row=db.prepare(`SELECT ${columns} FROM marketing_directory_pages WHERE ${due} AND ${filter} ORDER BY CASE kind WHEN 'profile' THEN 0 WHEN 'listing' THEN 1 ELSE 2 END,rowid LIMIT 1`).get(jobId,now(),...(kind==='cleaning'?[]:[kind])) as Row|undefined;
 }
 if(row)db.prepare('UPDATE marketing_directory_dispatch SET turn=turn+1 WHERE job_id=?').run(jobId);
 return row;
}
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
 const titles=$('table.rubrica_firma a.inscriere_titlu');
 titles.each((_,node)=>{
  const anchor=$(node),name=anchor.text().replace(/\s+/g,' ').trim();
  const titleRow=anchor.closest('tr');let row=titleRow,marker=row.find('.firma_txt').first();
  // A catalog page may use one shared table for many firms. Find only this title's
  // following metadata rows; never borrow the county from the next firm's title.
  while(!marker.length){row=row.next();if(!row.length||row.find('a.inscriere_titlu').length)break;marker=row.find('.firma_txt').first();}
  // Some real listings have an empty anchor label. Its URL and county can still
  // identify a profile; the profile parser requires the firm's actual name.
  if(!marker.length)throw new MarketingError('Datele unui rând din catalog sunt incomplete. Colectarea necesită verificare.',502);
  const locality=marketingKey(marker.closest('tr').find('td').map((_,e)=>$(e).text()).get().join(' ')).replace(/\s+/g,' ');
  const matches=(key:string)=>new RegExp('(?:^|[^a-z])'+key.replace(/-/g,'[- ]')+'(?:[^a-z]|$)').test(locality);
  if(!matches(marketingRegion(code)!.key)&&!matches(slug)){
   if(!MARKETING_REGIONS.some(r=>matches(r.key)||matches(marketingDirectorySlug(r.code))))throw new MarketingError('Județul unui rând din catalog nu poate fi verificat.',502);
   return;
  }
  const u=directoryUrl(anchor.attr('href')??'',current.href);
  if(!/^\/[^/]+\/$/.test(u.pathname)||u.pathname.startsWith('/firme-'))throw new MarketingError('Profilul unui rând din catalog nu poate fi verificat.',502);
  profiles.push({url:u.href,name:name.slice(0,180)});
 });
 const pages=new Set<string>();$('.all_pages a[href]').each((_,e)=>{try{const u=directoryUrl($(e).attr('href')!,current.href);if(u.pathname.startsWith(base)&&/^pag-[1-9]\d*\/$/.test(u.pathname.slice(base.length)))pages.add(u.href);}catch{}});
 const body=marketingVisibleText($,'body').replace(/\s+/g,' '),count=Number(body.match(/\b(\d[\d.,]*)\s+firme\b/i)?.[1].replace(/[.,]/g,'')??NaN);
 if(!profiles.length&&count!==0)throw new MarketingError('Firmele catalogului nu pot fi citite complet pentru județ.',502);
 if(count>titles.length&&!pages.size)throw new MarketingError('Catalogul indică mai multe firme decât pagina primită, fără paginare verificabilă.',502);
 return {profiles,pages:[...pages]};
}
export function parseDirectoryProfile(html:string,url:string,code:string,listingUrl=''){
 const $=load(html),name=$('#span_left_nume').text().replace(/\s+/g,' ').trim().slice(0,180),content=$('#td_continut');
 if(!name||!content.length)throw new MarketingError('Profilul firmei nu poate fi identificat în catalog.',502);
 content.find('script,style,noscript,template,form,footer,.footer,#footer').remove();
 const emails=publicEmails(content.find('a[href^="mailto:"]').map((_,e)=>$(e).attr('href')?.slice(7).split('?')[0]??'').get().join(' ')+' '+marketingVisibleText($,'#td_continut'));
 const external:string[]=[];content.find('a[href]').each((_,e)=>{try{const u=publicWebsite(new URL($(e).attr('href')!,url).href);if(!/(^|\.)(ghidul\.ro|anuntul\.ro|anuntulvideo\.ro|facebook\.com|instagram\.com|youtube\.com|google\.com|google\.ro|twitter\.com|linkedin\.com|trafic\.ro)$/.test(u.hostname)&&!external.includes(u.href))external.push(u.href);}catch{}});
 // Locality is not inferred from descriptions (a firm may advertise services in another city).
 const city=code==='B'?'București':'Localitate neprecizată';
 return {identity:'ghidul:'+directoryUrl(url).pathname.split('/')[1],name,category:cleaningListing(listingUrl)||/cur[ăa][țţt]enie|cleaning/i.test(name)?'cleaning':'business',city,website:external[0]??'',phone:'',emails,source:url};
}
function retryAt(value:string|string[]|undefined){const raw=Array.isArray(value)?value[0]:value,parsed=raw&&/^\d+$/.test(raw)?Date.now()+Number(raw)*1000:Date.parse(raw??'');return new Date(Number.isFinite(parsed)?Math.max(Date.now()+300000,parsed):Date.now()+300000).toISOString();}
const listingStructureReasons=[
 'Catalogul indică mai multe firme decât pagina primită, fără paginare verificabilă.',
 'Firmele catalogului nu pot fi citite complet pentru județ.',
 'Datele unui rând din catalog sunt incomplete. Colectarea necesită verificare.',
 'Județul unui rând din catalog nu poate fi verificat.',
 'Profilul unui rând din catalog nu poate fi verificat.',
];
/** An explicit operator resume may retry HTML parsing failures, preserving source deadlines.
 * Access denials, robots restrictions and transport failures are not reset here. */
export function retryMarketingDirectoryListings(db:Database,jobId:string){
 return db.prepare(`UPDATE marketing_directory_pages SET state='pending',attempts=0,reason='' WHERE job_id=? AND kind='listing' AND state='blocked' AND reason IN (${listingStructureReasons.map(()=>'?').join(',')})`).run(jobId,...listingStructureReasons).changes;
}
/** Persisted public-source frontier: all linked categories, county pages, pagination and firm profiles. */
export async function processMarketingDirectory(db:Database,job:{id:string;county_code:string},reader:PublicReader,active:()=>boolean){
 initializeMarketingDirectory(db);
 // Keep explicit cleaning provenance if a profile was first linked from another category.
 const enqueue=db.prepare("INSERT INTO marketing_directory_pages(job_id,url,kind,parent) VALUES(?,?,?,?) ON CONFLICT(job_id,url) DO UPDATE SET parent=CASE WHEN excluded.parent LIKE 'https://www.ghidul.ro/firme-servicii-diverse/curatenie-servicii/%' THEN excluded.parent ELSE parent END");
 enqueue.run(job.id,ORIGIN+'/sumar','index','');
 db.prepare('INSERT OR IGNORE INTO marketing_directory_host(host) VALUES(?)').run(ORIGIN);
 const deadline=Date.now()+15000;
 for(let i=0;i<4&&Date.now()<deadline;i++){
  if(!active())return {complete:false,blocked:false};
  const host=db.prepare('SELECT * FROM marketing_directory_host WHERE host=?').get(ORIGIN) as {robots:string;robots_at:string|null;next_attempt_at:string|null};
  if(host.next_attempt_at&&host.next_attempt_at>now())return {complete:false,blocked:false};
  const row=nextMarketingDirectoryPage(db,job.id);
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
     const c=parseDirectoryProfile(response.text,row.url,job.county_code,row.parent);
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
