import {describe,it,expect,vi} from 'vitest';
import Database from 'better-sqlite3';
import {startMarketingCountyPlan,setMarketingCountyState,processMarketingCounty} from './adminMarketingCounty';
import type {CountyManifest} from './adminMarketingCountySnapshot';
const manifest={schemaVersion:2,scope:'county',countyCode:'BV',generation:'fixture',total:1,parts:[{count:1}]} as CountyManifest;
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){const db=new Database(':memory:');db.exec('CREATE TABLE admin_audit_log(id TEXT PRIMARY KEY,action TEXT,target_id TEXT,details TEXT)');startMarketingCountyPlan(db,'owner',['CT','B','BV','IF']);for(const code of ['B','BV','IF'])setMarketingCountyState(db,code,'activate','owner');db.prepare("UPDATE marketing_county_jobs SET state='collecting' WHERE county_code IN ('CT','B')").run();db.prepare("INSERT INTO marketing_county_dispatch(job_id,last_turn) SELECT id,100 FROM marketing_county_jobs WHERE county_code='CT' ON CONFLICT(job_id) DO UPDATE SET last_turn=100").run();db.prepare("UPDATE marketing_county_dispatch SET last_turn=101 WHERE job_id=(SELECT id FROM marketing_county_jobs WHERE county_code='B')").run();return db;}
describe('one source preparation while active counties keep collecting',()=>{
 it('releases the contact collector immediately, keeps only one preparer, and imports a ready county while the next source prepares',async()=>{
  const db=fixture();let finish!:()=>void,ready=false;const prepare=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;})),directory=vi.fn(async()=>({complete:false,blocked:false})),read=async(code:string)=>ready&&code==='BV'?manifest:null;
  const deps={prepare,manifest:read,directory,part:async()=>[{type:'node' as const,id:1,tags:{name:'Synthetic'}}]},heartbeat=vi.fn();await processMarketingCounty(db,vi.fn(),heartbeat,deps);expect(prepare).toHaveBeenCalledOnce();expect(db.prepare('SELECT COUNT(*) n FROM marketing_county_source_lock').get()).toEqual({n:1});
  await processMarketingCounty(db,vi.fn(),heartbeat,deps);expect(directory).toHaveBeenCalledOnce();expect(prepare).toHaveBeenCalledOnce();
  ready=true;finish();await flush();expect(db.prepare("SELECT state FROM marketing_county_jobs WHERE county_code='BV'").get()).toEqual({state:'importing'});
  await processMarketingCounty(db,vi.fn(),heartbeat,deps);expect(prepare).toHaveBeenCalledTimes(2);for(let n=0;n<3;n++)await processMarketingCounty(db,vi.fn(),heartbeat,deps);expect(db.prepare("SELECT part_cursor FROM marketing_county_jobs WHERE county_code='BV'").get()).toEqual({part_cursor:1});finish();await flush();db.close();
 });
 it('honors an explicit pause and releases its source lease without changing saved data or the other counties',async()=>{
  const db=fixture();let fail!:(error:Error)=>void;let sourceActive!:()=>boolean,sourceHeartbeat!:()=>void;const prepare=vi.fn(async(_c:string,a:()=>boolean,h:()=>void)=>{sourceActive=a;sourceHeartbeat=h;await new Promise<void>((_resolve,reject)=>{fail=reject;});});
  await processMarketingCounty(db,vi.fn(),()=>{},{manifest:async()=>null,prepare});expect(sourceActive()).toBe(true);sourceHeartbeat();setMarketingCountyState(db,'BV','pause','owner');expect(sourceActive()).toBe(false);expect(sourceHeartbeat).toThrow();fail(Error('COUNTY_SOURCE_PREPARATION_INCOMPLETE'));await flush();expect(db.prepare("SELECT state FROM marketing_county_jobs WHERE county_code='BV'").get()).toEqual({state:'paused'});expect(db.prepare('SELECT COUNT(*) n FROM marketing_county_source_lock').get()).toEqual({n:0});db.close();
 });
 it('surfaces a failed public extract and frees preparation capacity without blocking active counties',async()=>{
  const db=fixture();await processMarketingCounty(db,vi.fn(),()=>{},{manifest:async()=>null,prepare:async()=>{throw Error('SOURCE_CHECKSUM_MISMATCH');}});await flush();expect(db.prepare("SELECT state,message FROM marketing_county_jobs WHERE county_code='BV'").get()).toEqual({state:'paused',message:'Pregătirea inventarului public necesită verificare [SOURCE_CHECKSUM_MISMATCH].'});expect(db.prepare('SELECT COUNT(*) n FROM marketing_county_source_lock').get()).toEqual({n:0});expect(db.prepare("SELECT state FROM marketing_county_jobs WHERE county_code='CT'").get()).toEqual({state:'collecting'});db.close();
 });
 it('recovers an expired preparation lease after restart and never starts two live preparations',async()=>{
  const db=fixture();db.prepare("INSERT INTO marketing_county_source_lock VALUES(1,'stale','old',?)").run(Date.now()-1);let finish!:()=>void;const prepare=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));const deps={manifest:async()=>null,prepare,directory:async()=>({complete:false,blocked:false})};await processMarketingCounty(db,vi.fn(),()=>{},deps);await processMarketingCounty(db,vi.fn(),()=>{},deps);expect(prepare).toHaveBeenCalledOnce();expect(db.prepare('SELECT COUNT(*) n FROM marketing_county_source_lock').get()).toEqual({n:1});finish();await flush();db.close();
 });
});
