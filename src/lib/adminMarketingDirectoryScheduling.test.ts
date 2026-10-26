import {afterEach,describe,expect,it,vi} from 'vitest';
import Database from 'better-sqlite3';
import {startMarketingCountyPlan} from './adminMarketingCounty';
import {initializeMarketingDirectory,nextMarketingDirectoryPage,parseDirectoryProfile,processMarketingDirectory} from './adminMarketingDirectory';
import type {PublicReader} from './adminMarketingPublicWeb';
const origin='https://www.ghidul.ro',cleaning=origin+'/firme-servicii-diverse/curatenie-servicii/bucuresti/';
function setup(){const db=new Database(':memory:');db.exec('CREATE TABLE admin_audit_log(id TEXT PRIMARY KEY,action TEXT,target_id TEXT,details TEXT)');startMarketingCountyPlan(db,'owner');const job=db.prepare("SELECT id,county_code FROM marketing_county_jobs WHERE county_code='B'").get() as {id:string;county_code:string};db.prepare("INSERT INTO marketing_directory_pages(job_id,url,kind,state) VALUES(?,?,'index','done')").run(job.id,origin+'/sumar');db.prepare('INSERT INTO marketing_directory_host(host,robots,robots_at) VALUES(?,?,?)').run(origin,'User-agent: *\nCrawl-delay: 20',new Date().toISOString());return {db,job};}
afterEach(()=>vi.useRealTimers());
describe('directory progress without category starvation',()=>{
 it('retains one unidentified profile as a visible coverage gap while allowed profiles continue',async()=>{
  vi.useFakeTimers();const {db,job}=setup();db.prepare("INSERT INTO marketing_directory_pages(job_id,url,kind) VALUES(?,?,'profile')").run(job.id,origin+'/missing/');db.prepare("INSERT INTO marketing_directory_pages(job_id,url,kind) VALUES(?,?,'profile')").run(job.id,origin+'/valid/');
  const reader=vi.fn<PublicReader>(async url=>({url,status:200,headers:{'content-type':'text/html'},text:url.endsWith('/missing/')?'<body><div id="td_continut"></div></body>':'<div id="td_continut"><span id="span_left_nume">Synthetic firm</span><p>office@synthetic.ro</p></div>'}));
  expect((await processMarketingDirectory(db,job,reader,()=>true)).blocked).toBe(false);expect(db.prepare("SELECT state FROM marketing_directory_pages WHERE url=?").get(origin+'/missing/')).toEqual({state:'needs_review'});
  vi.setSystemTime(Date.now()+20000);await processMarketingDirectory(db,job,reader,()=>true);vi.setSystemTime(Date.now()+20000);const result=await processMarketingDirectory(db,job,reader,()=>true);
  expect(result).toMatchObject({complete:false,blocked:false,exhausted:true,needsReview:1});expect(db.prepare('SELECT COUNT(*) n FROM marketing_county_items').get()).toEqual({n:1});expect(reader).toHaveBeenCalledTimes(2);db.close();
 });
 it('never turns a CAPTCHA or access refusal into a reviewable profile that would allow source collection',async()=>{
  vi.useFakeTimers();const {db,job}=setup();db.prepare("INSERT INTO marketing_directory_pages(job_id,url,kind) VALUES(?,?,'profile')").run(job.id,origin+'/challenge/');
  const reader=vi.fn<PublicReader>(async url=>({url,status:200,headers:{'content-type':'text/html'},text:'<body><form>CAPTCHA: verify you are human</form></body>'}));expect((await processMarketingDirectory(db,job,reader,()=>true)).blocked).toBe(true);expect(db.prepare("SELECT state FROM marketing_directory_pages WHERE url=?").get(origin+'/challenge/')).toEqual({state:'blocked'});db.close();
 });
 it('reads profiles while hundreds of listing pages remain and gives every frontier a persisted turn',()=>{
  const {db,job}=setup(),insert=db.prepare('INSERT INTO marketing_directory_pages(job_id,url,kind,parent) VALUES(?,?,?,?)');
  for(let n=0;n<500;n++)insert.run(job.id,origin+'/listing-'+n+'/','listing','');
  insert.run(job.id,cleaning,'listing','');insert.run(job.id,origin+'/cleaning-profile/','profile',cleaning);insert.run(job.id,origin+'/ordinary-profile/','profile','');insert.run(job.id,origin+'/category/','category','');
  const seen=[];for(let n=0;n<5;n++){initializeMarketingDirectory(db);const row=nextMarketingDirectoryPage(db,job.id)!;seen.push(row);db.prepare("UPDATE marketing_directory_pages SET state='done' WHERE job_id=? AND url=?").run(job.id,row.url);}
  expect(seen[0].url).toBe(origin+'/cleaning-profile/');expect(seen.some(r=>r.url===origin+'/ordinary-profile/')).toBe(true);expect(seen.some(r=>r.kind==='listing')).toBe(true);expect(seen.some(r=>r.kind==='category')).toBe(true);
  expect(db.prepare("SELECT COUNT(*) n FROM marketing_directory_pages WHERE kind='listing' AND state='pending'").get()).toEqual({n:499});db.close();
 });
 it('never selects a blocked page or one whose Retry-After has not elapsed',()=>{
  const {db,job}=setup();db.prepare("INSERT INTO marketing_directory_pages(job_id,url,kind,state,next_attempt_at) VALUES(?,?,'listing','pending','2099-01-01T00:00:00Z')").run(job.id,cleaning);db.prepare("INSERT INTO marketing_directory_pages(job_id,url,kind,state) VALUES(?,?,'profile','blocked')").run(job.id,origin+'/denied/');expect(nextMarketingDirectoryPage(db,job.id)).toBeUndefined();db.close();
 });
 it('classifies a generic firm name from its explicit cleaning listing, without borrowing another host category',()=>{
  const html='<div id="td_continut"><span id="span_left_nume">Synthetic Services SRL</span><p>office@synthetic.ro</p></div>';
  expect(parseDirectoryProfile(html,origin+'/firm/','B',cleaning).category).toBe('cleaning');expect(parseDirectoryProfile(html,origin+'/firm/','B','https://unrelated.ro/firme-servicii-diverse/curatenie-servicii/bucuresti/').category).toBe('business');
 });
 it('preserves cleaning provenance when a queued profile was first found under another category',async()=>{
  vi.useFakeTimers();const {db,job}=setup(),profile=origin+'/synthetic-services/';
  db.prepare("INSERT INTO marketing_directory_pages(job_id,url,kind,parent) VALUES(?,?,'profile',?)").run(job.id,profile,origin+'/firme-afaceri/administrare/bucuresti/');db.prepare("INSERT INTO marketing_directory_pages(job_id,url,kind) VALUES(?,?,'listing')").run(job.id,cleaning);
  const html=`<body>1 firme<table class="rubrica_firma"><tr><td><a class="inscriere_titlu" href="${profile}">Synthetic Services</a></td></tr><tr><td><span class="firma_txt">Firma</span></td><td>Bucuresti</td></tr></table></body>`;
  const reader=vi.fn<PublicReader>(async url=>({url,status:200,headers:{'content-type':'text/html'},text:url===cleaning?html:'<div id="td_continut"><span id="span_left_nume">Synthetic Services</span><p>office@synthetic.ro</p></div>'}));
  await processMarketingDirectory(db,job,reader,()=>true);expect(reader.mock.calls[0][0]).toBe(cleaning);await processMarketingDirectory(db,job,reader,()=>true);expect(reader).toHaveBeenCalledOnce();
  vi.setSystemTime(Date.now()+20000);await processMarketingDirectory(db,job,reader,()=>true);expect(db.prepare('SELECT category,city FROM marketing_county_items').get()).toEqual({category:'cleaning',city:'București'});db.close();
 });
 it('keeps the host Retry-After and access denial effective under the new rotation',async()=>{
  vi.useFakeTimers();const {db,job}=setup();db.prepare("INSERT INTO marketing_directory_pages(job_id,url,kind) VALUES(?,?,'listing')").run(job.id,cleaning);const reader=vi.fn<PublicReader>(async url=>({url,status:429,text:'',headers:{'retry-after':'1200','content-type':'text/html'}}));
  await processMarketingDirectory(db,job,reader,()=>true);vi.setSystemTime(Date.now()+1199000);await processMarketingDirectory(db,job,reader,()=>true);expect(reader).toHaveBeenCalledOnce();vi.setSystemTime(Date.now()+1000);reader.mockImplementation(async url=>({url,status:403,text:'',headers:{'content-type':'text/html'}}));expect((await processMarketingDirectory(db,job,reader,()=>true)).blocked).toBe(true);vi.setSystemTime(Date.now()+600000);await processMarketingDirectory(db,job,reader,()=>true);expect(reader).toHaveBeenCalledTimes(2);db.close();
 });
});
