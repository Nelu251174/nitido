import {describe,it,expect,vi} from 'vitest';
import Database from 'better-sqlite3';
import {startMarketingCountyPlan,processMarketingCounty,marketingCountyView,setMarketingCountyState} from './adminMarketingCounty';
import {listMarketingContacts,saveMarketingContacts} from './adminMarketing';
import type {CountyManifest,CountySourceItem} from './adminMarketingCountySnapshot';
import type {PublicReader} from './adminMarketingPublicWeb';
const manifest={schemaVersion:2,scope:'county',countyCode:'CT',generation:'fixture',total:2,parts:[{count:2}]} as CountyManifest;
const page=(url:string,text:string)=>({url,status:200,text,headers:{'content-type':'text/html'}});
function fixture(){const db=new Database(':memory:');db.exec('CREATE TABLE admin_audit_log(id TEXT PRIMARY KEY,action TEXT,target_id TEXT,details TEXT)');startMarketingCountyPlan(db,'owner');return db;}
const domain=vi.fn(async()=>({state:'mx' as const,reason:'PUBLIC_MX_PRESENT'}));
const data:CountySourceItem[]=[{type:'node' as const,id:1,tags:{name:'County business',email:'office@business.ro;info@business.ro','addr:city':'Mangalia'}},{type:'way' as const,id:2,tags:{name:'Without email','addr:city':'Năvodari'}}];
const deps={manifest:vi.fn(async()=>manifest),part:vi.fn(async()=>data),domain};
describe('county worker: persistent batches, all emails, correct county order',()=>{
 it('saves every public address and keeps inventory without email, preserving consent and waiting for coverage review',async()=>{
  const db=fixture(),reader:PublicReader=vi.fn();saveMarketingContacts(db,[{name:'Protected',category:'business',email:'office@business.ro',city:'București',source:'Manual',consent:'withdrawn'}],'owner');
  for(let i=0;i<6;i++)await processMarketingCounty(db,reader,()=>{},deps);
  const view=marketingCountyView(db),ct=view.counties.find(r=>r.code==='CT')!,b=view.counties.find(r=>r.code==='B')!;
  expect(ct.job).toMatchObject({state:'review',total:2,processed:2,withoutEmail:1});expect(ct).toMatchObject({emails:2,verified:2});expect(b.job?.state).toBe('queued');
  expect(listMarketingContacts(db,new URLSearchParams({county:'CT'})).contacts.find(c=>c.email==='office@business.ro')).toMatchObject({name:'Protected',consent:'withdrawn',status:'do_not_contact'});
  expect(reader).not.toHaveBeenCalled();expect(db.prepare("SELECT COUNT(*) n FROM marketing_contacts WHERE consent='granted'").get()).toEqual({n:0});db.close();
 });
 it('does not proceed to București when Constanța is paused or has an invalid source part',async()=>{
  const db=fixture(),reader:PublicReader=vi.fn();setMarketingCountyState(db,'CT','pause','owner');await processMarketingCounty(db,reader,()=>{},deps);expect(marketingCountyView(db).counties.find(r=>r.code==='B')?.job?.state).toBe('queued');
  setMarketingCountyState(db,'CT','resume','owner');await processMarketingCounty(db,reader,()=>{},deps);await processMarketingCounty(db,reader,()=>{},{...deps,part:async()=>{throw Error('corrupt');}});expect(marketingCountyView(db).counties[0].job?.state).toBe('paused');expect(db.prepare('SELECT COUNT(*) n FROM marketing_county_items').get()).toEqual({n:0});db.close();
 });
 it('reads contact pages even when the home page already exposes another email',async()=>{
  const db=fixture();const reader:PublicReader=vi.fn(async url=>page(url,url.endsWith('robots.txt')?'User-agent: *\nAllow: /':url.endsWith('/contact')?'info@business.ro':'office@business.ro<a href="/contact">Contact</a>'));
  const d={...deps,part:async()=>[{...data[0],tags:{name:'Website firm',website:'https://business.ro','addr:city':'Mangalia'}},data[1]]};for(let i=0;i<6;i++)await processMarketingCounty(db,reader,()=>{},d);
  expect(listMarketingContacts(db,new URLSearchParams({county:'CT'})).total).toBe(2);expect(reader).toHaveBeenCalledWith('https://business.ro/contact',{redirects:false});db.close();
 });
 it('stops without saving when paused during a site request',async()=>{
  const db=fixture();const reader:PublicReader=vi.fn(async url=>{if(!url.endsWith('robots.txt'))setMarketingCountyState(db,'CT','pause','owner');return page(url,url.endsWith('robots.txt')?'':'office@business.ro');});const d={...deps,part:async()=>[{...data[0],tags:{name:'Website firm',website:'https://business.ro'}},data[1]]};for(let i=0;i<4;i++)await processMarketingCounty(db,reader,()=>{},d);expect(listMarketingContacts(db,new URLSearchParams({county:'CT'})).total).toBe(0);db.close();
 });
});
