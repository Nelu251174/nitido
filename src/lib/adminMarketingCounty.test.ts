import {describe,it,expect,vi,afterEach} from 'vitest';
import Database from 'better-sqlite3';
import {startMarketingCountyPlan,processMarketingCounty,marketingCountyView,setMarketingCountyState} from './adminMarketingCounty';
import {listMarketingContacts,saveMarketingContacts} from './adminMarketing';
import type {CountyManifest,CountySourceItem} from './adminMarketingCountySnapshot';
import type {PublicReader} from './adminMarketingPublicWeb';
import type {collectMarketingCountyWebsite} from './adminMarketingCountyWeb';
const manifest={schemaVersion:2,scope:'county',countyCode:'CT',generation:'fixture',total:2,parts:[{count:2}]} as CountyManifest;
const page=(url:string,text:string)=>({url,status:200,text,headers:{'content-type':'text/html'}});
function fixture(){const db=new Database(':memory:');db.exec('CREATE TABLE admin_audit_log(id TEXT PRIMARY KEY,action TEXT,target_id TEXT,details TEXT)');startMarketingCountyPlan(db,'owner');return db;}
const domain=vi.fn(async()=>({state:'mx' as const,reason:'PUBLIC_MX_PRESENT'}));
const data:CountySourceItem[]=[{type:'node' as const,id:1,tags:{name:'County business',email:'office@business.ro;info@business.ro','addr:city':'Mangalia'}},{type:'way' as const,id:2,tags:{name:'Without email','addr:city':'Năvodari'}}];
afterEach(()=>vi.useRealTimers());
const deps={manifest:vi.fn(async()=>manifest),part:vi.fn(async()=>data),domain,directory:async()=>({complete:false,blocked:false})};
describe('county worker: persistent batches, all emails, correct county order',()=>{
 it('finishes permitted work with explicit profile coverage gaps while keeping the county in review and later counties queued',async()=>{
  const db=fixture(),id=(db.prepare("SELECT id FROM marketing_county_jobs WHERE county_code='CT'").get() as {id:string}).id;
  db.prepare("UPDATE marketing_county_jobs SET state='directory' WHERE id=?").run(id);db.prepare("INSERT INTO marketing_directory_pages(job_id,url,kind,state) VALUES(?,'https://www.ghidul.ro/sumar','index','done')").run(id);db.prepare("INSERT INTO marketing_directory_pages(job_id,url,kind,state,reason) VALUES(?,'https://www.ghidul.ro/missing/','profile','needs_review','Profilul firmei nu poate fi identificat în catalog.')").run(id);
  const directory=async()=>({complete:false,blocked:false,exhausted:true,needsReview:1});for(let n=0;n<3;n++)await processMarketingCounty(db,vi.fn(),()=>{},{...deps,directory});
  const view=marketingCountyView(db);expect(view.counties.find(c=>c.code==='CT')?.job).toMatchObject({state:'review',directory:{needsReview:1}});expect(view.counties.find(c=>c.code==='B')?.job?.state).toBe('queued');expect(db.prepare("SELECT state FROM marketing_directory_pages WHERE kind='profile'").get()).toEqual({state:'needs_review'});db.close();
 });
 it('saves captured source emails before website retry deadlines, prioritizes cleaning, and preserves existing categories and opt-outs',async()=>{
  vi.useFakeTimers();const db=fixture(),id=(db.prepare("SELECT id FROM marketing_county_jobs WHERE county_code='CT'").get() as {id:string}).id;db.prepare("UPDATE marketing_county_jobs SET state='collecting' WHERE id=?").run(id);
  saveMarketingContacts(db,[{name:'Existing business',category:'business',email:'shared@captured.ro',city:'Cluj-Napoca',county:'CJ',source:'Manual',consent:'withdrawn'}],'owner');
  const insert=db.prepare("INSERT INTO marketing_county_items(id,job_id,identity,name,category,city,website,phone,emails,source,next_attempt_at) VALUES(?,?,?,'Synthetic',?,'Mangalia','https://captured.ro/','',?,'https://www.openstreetmap.org/node/1','2099-01-01T00:00:00.000Z')");
  for(let n=0;n<102;n++)insert.run(String(n),id,'osm:node/'+n,n===101?'cleaning':'business',JSON.stringify([n===101?'shared@captured.ro':`source${n}@captured.ro`]));
  const website=vi.fn<typeof collectMarketingCountyWebsite>(),dns=vi.fn(async()=>({state:'mx' as const,reason:'PUBLIC_MX_PRESENT'}));await processMarketingCounty(db,vi.fn(),()=>{},{...deps,domain:dns,website});
  expect(website).not.toHaveBeenCalled();expect(db.prepare('SELECT COUNT(*) n FROM marketing_county_item_emails').get()).toEqual({n:100});expect(db.prepare("SELECT COUNT(*) n FROM marketing_county_item_emails WHERE item_id='101'").get()).toEqual({n:1});
  expect(listMarketingContacts(db,new URLSearchParams({county:'CT',search:'shared@captured.ro'})).contacts[0]).toMatchObject({category:'business',consent:'withdrawn',status:'do_not_contact'});expect(db.prepare("SELECT COUNT(*) n FROM marketing_county_items WHERE status='done'").get()).toEqual({n:0});
  vi.setSystemTime(Date.now()+20000);await processMarketingCounty(db,vi.fn(),()=>{},{...deps,domain:dns,website});expect(db.prepare('SELECT COUNT(*) n FROM marketing_county_item_emails').get()).toEqual({n:102});expect(db.prepare("SELECT COUNT(*) n FROM marketing_contacts WHERE consent='granted'").get()).toEqual({n:0});expect(dns).toHaveBeenCalledOnce();db.close();
 });
 it('bounds early DNS work by time while checking more than three cached or fast addresses',async()=>{
  vi.useFakeTimers();const db=fixture(),id=(db.prepare("SELECT id FROM marketing_county_jobs WHERE county_code='CT'").get() as {id:string}).id;db.prepare("UPDATE marketing_county_jobs SET state='collecting' WHERE id=?").run(id);
  const insert=db.prepare("INSERT INTO marketing_county_items(id,job_id,identity,name,category,city,website,phone,emails,source,next_attempt_at) VALUES(?,?,?,'Synthetic','business','Mangalia','https://captured.ro/','',?,'https://www.openstreetmap.org/node/1','2099-01-01T00:00:00.000Z')");for(let n=0;n<25;n++)insert.run(String(n),id,'osm:node/'+n,JSON.stringify([`office@source${n}.ro`]));
  const dns=vi.fn(async()=>{vi.setSystemTime(Date.now()+6000);return {state:'mx' as const,reason:'PUBLIC_MX_PRESENT'};});await processMarketingCounty(db,vi.fn(),()=>{},{...deps,domain:dns});expect(dns).toHaveBeenCalledOnce();expect(db.prepare("SELECT COUNT(*) n FROM marketing_email_checks WHERE status='verified'").get()).toEqual({n:1});db.close();
 });
 it('starts a fresh cleaning website before revisiting an already attempted deep business frontier',async()=>{
  vi.useFakeTimers();const db=fixture(),id=(db.prepare("SELECT id FROM marketing_county_jobs WHERE county_code='CT'").get() as {id:string}).id;db.prepare("UPDATE marketing_county_jobs SET state='collecting' WHERE id=?").run(id);
  const insert=db.prepare("INSERT INTO marketing_county_items(id,job_id,identity,name,category,city,website,phone,source,attempted_at) VALUES(?,?,?,'Synthetic',?,'Mangalia',?,'','Public',?)");insert.run('old',id,'old','business','https://deep.ro/',new Date().toISOString());insert.run('new',id,'new','cleaning','https://cleaning.ro/','');
  const website=vi.fn<typeof collectMarketingCountyWebsite>(async()=>{vi.setSystemTime(Date.now()+16000);return {complete:false,found:[],warning:'',nextAttemptAt:null};});await processMarketingCounty(db,vi.fn(),()=>{},{...deps,website});expect(website).toHaveBeenCalledOnce();expect(website.mock.calls[0][2]).toBe('https://cleaning.ro/');db.close();
 });
 it('saves and verifies public email evidence before a website frontier finishes, preserving withdrawn consent',async()=>{
  vi.useFakeTimers();const db=fixture(),id=(db.prepare("SELECT id FROM marketing_county_jobs WHERE county_code='CT'").get() as {id:string}).id;
  saveMarketingContacts(db,[{name:'Protected',category:'business',email:'office@partial.ro',city:'Mangalia',county:'CT',source:'Manual',consent:'withdrawn'}],'owner');
  db.prepare("UPDATE marketing_county_jobs SET state='collecting' WHERE id=?").run(id);
  db.prepare("INSERT INTO marketing_county_items(id,job_id,identity,name,category,city,website,phone,source) VALUES('partial',?,'partial','Partial','business','Mangalia','https://partial.ro/','','Public')").run(id);
  const website=vi.fn<typeof collectMarketingCountyWebsite>(async()=>({complete:false,found:[{email:'office@partial.ro',source:'https://partial.ro/contact'}],warning:'',nextAttemptAt:new Date(Date.now()+3600000).toISOString()}));
  await processMarketingCounty(db,vi.fn(),()=>{},{...deps,website});expect(db.prepare("SELECT status FROM marketing_county_items WHERE id='partial'").get()).toEqual({status:'pending'});
  expect(db.prepare('SELECT COUNT(*) n FROM marketing_county_item_emails').get()).toEqual({n:1});vi.setSystemTime(Date.now()+20000);await processMarketingCounty(db,vi.fn(),()=>{},{...deps,website});
  expect(listMarketingContacts(db,new URLSearchParams({county:'CT'})).contacts[0]).toMatchObject({consent:'withdrawn',status:'do_not_contact',emailVerification:'verified'});
  expect(db.prepare("SELECT COUNT(*) n FROM admin_audit_log WHERE action='marketing.county.item.processed'").get()).toEqual({n:0});expect(website).toHaveBeenCalledOnce();db.close();
 });

 it('keeps prepared Brașov and Ilfov waiting until both Constanța and București are completed',async()=>{
  const db=fixture(),reader:PublicReader=vi.fn();startMarketingCountyPlan(db,'owner',['BV','IF']);
  db.prepare("UPDATE marketing_county_jobs SET state='review' WHERE county_code IN ('CT','B')").run();
  const manifestReader=vi.fn(async(code:string)=>({...manifest,countyCode:code} as CountyManifest));
  await processMarketingCounty(db,reader,()=>{},{...deps,manifest:manifestReader});expect(manifestReader).not.toHaveBeenCalled();
  db.prepare("UPDATE marketing_county_jobs SET state='completed' WHERE county_code='CT'").run();
  await processMarketingCounty(db,reader,()=>{},{...deps,manifest:manifestReader});expect(manifestReader).not.toHaveBeenCalled();
  for(const code of ['BV','IF'])expect(marketingCountyView(db).counties.find(c=>c.code===code)?.job).toMatchObject({state:'queued',imported:0,startedSeparately:false});
  db.prepare("UPDATE marketing_county_jobs SET state='completed' WHERE county_code='B'").run();
  await processMarketingCounty(db,reader,()=>{},{...deps,manifest:manifestReader});expect(manifestReader).toHaveBeenCalledWith('BV');
  expect(marketingCountyView(db).counties.find(c=>c.code==='IF')?.job?.state).toBe('queued');db.close();
 });

 it('starts București only after explicit activation while preserving unfinished Constanța and excluding Ilfov',async()=>{
  const db=fixture(),reader:PublicReader=vi.fn();db.prepare("UPDATE marketing_county_jobs SET state='review' WHERE county_code='CT'").run();
  await processMarketingCounty(db,reader,()=>{},deps);expect(marketingCountyView(db).counties.find(c=>c.code==='B')?.job?.state).toBe('queued');
  setMarketingCountyState(db,'B','activate','owner');const manifestReader=vi.fn(async(code:string)=>({...manifest,countyCode:code} as CountyManifest));
  await processMarketingCounty(db,reader,()=>{},{...deps,manifest:manifestReader});
  expect(manifestReader).toHaveBeenCalledWith('B');expect(marketingCountyView(db).counties.find(c=>c.code==='B')?.job).toMatchObject({state:'importing',startedSeparately:true,imported:0});
  await processMarketingCounty(db,reader,()=>{},deps);expect(marketingCountyView(db).counties.find(c=>c.code==='B')?.job).toMatchObject({state:'importing',total:2,imported:2,processed:0});
  expect(marketingCountyView(db).counties.find(c=>c.code==='CT')?.job?.state).toBe('review');expect(marketingCountyView(db).counties.find(c=>c.code==='IF')?.job).toBeNull();
  expect(db.prepare("SELECT COUNT(*) n FROM admin_audit_log WHERE action='marketing.county.activate'").get()).toEqual({n:1});db.close();
 });
 it('alternates explicitly activated counties using persisted turns without overriding either source deadline or pause',async()=>{
  const db=fixture(),reader:PublicReader=vi.fn();setMarketingCountyState(db,'B','activate','owner');
  const seen:string[]=[];const manifestReader=async(code:string)=>{seen.push(code);return {...manifest,countyCode:code} as CountyManifest;};
  await processMarketingCounty(db,reader,()=>{},{...deps,manifest:manifestReader});await processMarketingCounty(db,reader,()=>{},{...deps,manifest:manifestReader});expect(seen).toEqual(['CT','B']);
  db.prepare("UPDATE marketing_county_jobs SET state='queued' WHERE county_code='CT'").run();db.prepare("UPDATE marketing_county_jobs SET state='queued',next_attempt_at='2099-01-01T00:00:00.000Z' WHERE county_code='B'").run();
  await processMarketingCounty(db,reader,()=>{},{...deps,manifest:manifestReader});expect(seen).toEqual(['CT','B','CT']);
  setMarketingCountyState(db,'CT','pause','owner');await processMarketingCounty(db,reader,()=>{},{...deps,manifest:manifestReader});expect(seen).toHaveLength(3);
  db.prepare("UPDATE marketing_county_jobs SET next_attempt_at=NULL WHERE county_code='B'").run();await processMarketingCounty(db,reader,()=>{},{...deps,manifest:manifestReader});expect(seen).toEqual(['CT','B','CT','B']);expect(marketingCountyView(db).counties[0].job?.state).toBe('paused');db.close();
 });
 it('saves every public address and keeps inventory without email, preserving consent and waiting for coverage review',async()=>{
  const db=fixture(),reader:PublicReader=vi.fn();saveMarketingContacts(db,[{name:'Protected',category:'business',email:'office@business.ro',city:'București',source:'Manual',consent:'withdrawn'}],'owner');
  for(let i=0;i<5;i++)await processMarketingCounty(db,reader,()=>{},deps);
  const view=marketingCountyView(db),ct=view.counties.find(r=>r.code==='CT')!,b=view.counties.find(r=>r.code==='B')!;
  expect(ct.job).toMatchObject({state:'directory',total:2,processed:2,withoutEmail:1});expect(ct).toMatchObject({emails:2,verified:2});expect(b.job?.state).toBe('queued');
  expect(listMarketingContacts(db,new URLSearchParams({county:'CT'})).contacts.find(c=>c.email==='office@business.ro')).toMatchObject({name:'Protected',consent:'withdrawn',status:'do_not_contact'});
  expect(reader).not.toHaveBeenCalled();expect(db.prepare("SELECT COUNT(*) n FROM marketing_contacts WHERE consent='granted'").get()).toEqual({n:0});db.close();
 });
 it('does not proceed to București when Constanța is paused or has an invalid source part',async()=>{
  const db=fixture(),reader:PublicReader=vi.fn();setMarketingCountyState(db,'CT','pause','owner');await processMarketingCounty(db,reader,()=>{},deps);expect(marketingCountyView(db).counties.find(r=>r.code==='B')?.job?.state).toBe('queued');
  setMarketingCountyState(db,'CT','resume','owner');await processMarketingCounty(db,reader,()=>{},deps);await processMarketingCounty(db,reader,()=>{},{...deps,part:async()=>{throw Error('corrupt');}});expect(marketingCountyView(db).counties[0].job?.state).toBe('paused');expect(db.prepare('SELECT COUNT(*) n FROM marketing_county_items').get()).toEqual({n:0});db.close();
 });
 it('reads contact pages even when the home page already exposes another email',async()=>{
  vi.useFakeTimers();const db=fixture();const reader:PublicReader=vi.fn(async url=>page(url,url.endsWith('robots.txt')?'User-agent: *\nAllow: /':url.endsWith('/contact')?'info@business.ro':'office@business.ro<a href="/contact">Contact</a>'));
  const d={...deps,part:async()=>[{...data[0],tags:{name:'Website firm',website:'https://business.ro','addr:city':'Mangalia'}},data[1]]};for(let i=0;i<30;i++){await processMarketingCounty(db,reader,()=>{},d);vi.setSystemTime(Date.now()+3000);}
  expect(listMarketingContacts(db,new URLSearchParams({county:'CT'})).total).toBe(2);expect(reader).toHaveBeenCalledWith('https://business.ro/contact',expect.objectContaining({redirects:false}));db.close();
 });
 it('stops without saving when paused during a site request',async()=>{
  vi.useFakeTimers();const db=fixture();const reader:PublicReader=vi.fn(async url=>{if(!url.endsWith('robots.txt'))setMarketingCountyState(db,'CT','pause','owner');return page(url,url.endsWith('robots.txt')?'':'office@business.ro');});const d={...deps,part:async()=>[{...data[0],tags:{name:'Website firm',website:'https://business.ro'}},data[1]]};for(let i=0;i<12;i++){await processMarketingCounty(db,reader,()=>{},d);vi.setSystemTime(Date.now()+3000);}expect(listMarketingContacts(db,new URLSearchParams({county:'CT'})).total).toBe(0);db.close();
 });
 it('retries only listing structure errors on explicit resume, preserving source pauses and access refusals',()=>{
  const db=fixture(),id=(db.prepare("SELECT id FROM marketing_county_jobs WHERE county_code='CT'").get() as {id:string}).id;
  const deadline='2099-01-01T00:00:00.000Z';
  const insert=db.prepare("INSERT INTO marketing_directory_pages(job_id,url,kind,state,reason,next_attempt_at) VALUES(?,?,'listing','blocked',?,?)");
  insert.run(id,'https://www.ghidul.ro/firme-afaceri/audit-contabili/constanta/','Catalogul indică mai multe firme decât pagina primită, fără paginare verificabilă.',deadline);
  insert.run(id,'https://www.ghidul.ro/firme-afaceri/other/constanta/','Catalogul nu permite colectarea automată a acestei pagini.',deadline);
  setMarketingCountyState(db,'CT','pause','owner');setMarketingCountyState(db,'CT','resume','owner');
  expect(db.prepare('SELECT state,next_attempt_at FROM marketing_directory_pages ORDER BY url').all()).toEqual([{state:'pending',next_attempt_at:deadline},{state:'blocked',next_attempt_at:deadline}]);
  expect(marketingCountyView(db).counties.find(c=>c.code==='B')?.job?.state).toBe('queued');db.close();
 });

 it('reopens website review without changing contacts, completed directory pages or the București queue',()=>{
  const db=fixture(),id=(db.prepare("SELECT id FROM marketing_county_jobs WHERE county_code='CT'").get() as {id:string}).id;
  saveMarketingContacts(db,[{name:'Protected',category:'business',email:'office@business.ro',city:'Mangalia',county:'CT',source:'Manual',consent:'withdrawn'}],'owner');
  db.prepare("INSERT INTO marketing_county_items(id,job_id,identity,name,category,city,website,phone,source,status) VALUES('item',?,'fixture','Firm','business','Mangalia','https://business.ro/','','Public','done')").run(id);
  db.prepare("UPDATE marketing_county_jobs SET state='review' WHERE id=?").run(id);setMarketingCountyState(db,'CT','enrich','owner');
  expect(db.prepare('SELECT status,attempted_at FROM marketing_county_items').get()).toEqual({status:'pending',attempted_at:''});expect(marketingCountyView(db).counties.find(c=>c.code==='B')?.job?.state).toBe('queued');expect(listMarketingContacts(db,new URLSearchParams()).contacts[0]).toMatchObject({consent:'withdrawn',status:'do_not_contact'});db.close();
 });

 it('keeps other sites and DNS verification moving while one host requests a long pause',async()=>{
  vi.useFakeTimers();const db=fixture();
  const reader=vi.fn<PublicReader>(async url=>url.startsWith('https://slow.ro')?{...page(url,'Unavailable'),status:503,headers:{'content-type':'text/plain','retry-after':'86400'}}:page(url,url.endsWith('robots.txt')?'':'office@fast.ro'));
  const part:CountySourceItem[]=[{type:'node',id:1,tags:{name:'Slow',website:'https://slow.ro'}},{type:'node',id:2,tags:{name:'Fast',website:'https://fast.ro'}}];
  for(let i=0;i<12;i++){await processMarketingCounty(db,reader,()=>{},{...deps,part:async()=>part});vi.setSystemTime(Date.now()+15000);}
  expect(listMarketingContacts(db,new URLSearchParams({county:'CT'})).contacts.find(c=>c.email==='office@fast.ro')?.emailVerification).toBe('verified');
  expect(reader.mock.calls.filter(([url])=>url.startsWith('https://slow.ro'))).toHaveLength(1);expect(marketingCountyView(db).counties[0].job?.state).toBe('collecting');db.close();
 });

 it('does not let a deep started frontier delay a fresh website, while continuing both within the available time',async()=>{
  const db=fixture(),id=(db.prepare("SELECT id FROM marketing_county_jobs WHERE county_code='CT'").get() as {id:string}).id;
  db.prepare("UPDATE marketing_county_jobs SET state='collecting' WHERE id=?").run(id);
  const put=db.prepare("INSERT INTO marketing_county_items(id,job_id,identity,name,category,city,website,phone,source,attempted_at) VALUES(?,?,?,'Firm','business','Mangalia',?,'','Public',?)");put.run('new',id,'new','https://new.ro/','');put.run('started',id,'started','https://started.ro/',new Date().toISOString());
  db.prepare('INSERT INTO marketing_county_web_pages(job_id,website,url) VALUES(?,?,?)').run(id,'https://started.ro/','https://started.ro/');
  const website=vi.fn<typeof collectMarketingCountyWebsite>(async()=>({complete:false,found:[],warning:'',nextAttemptAt:null}));await processMarketingCounty(db,vi.fn(),()=>{},{...deps,website});expect(website.mock.calls.map(call=>call[2])).toEqual(['https://new.ro/','https://started.ro/']);db.close();
 });

});
