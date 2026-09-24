import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import Sqlite from 'better-sqlite3';
import {initializeDatabase} from './db';
const provider=vi.hoisted(()=>({authorize:vi.fn()}));
vi.mock('@/lib/payments',()=>({authorizePayment:provider.authorize,connectTransfersEnabled:()=>false}));
import {acceptJobAtomic} from './acceptJob';
let db:Sqlite.Database;
beforeEach(()=>{vi.resetAllMocks();db=new Sqlite(':memory:');db.pragma('foreign_keys = ON');initializeDatabase(db);db.exec("INSERT INTO users(id,role,name) VALUES('c','client','Client'),('u','firma','Firm'),('v','firma','Other');INSERT INTO firms(id,user_id,coverage_city,verified) VALUES('f','u','București',1),('g','v','București',1);INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status) VALUES('j','c','Test','București',75,'apartament','asap',550,150,'waiting')");});
afterEach(()=>db.close());
function failingAuthorization(){let fail!:(error:Error)=>void;provider.authorize.mockImplementation(()=>new Promise((_,reject)=>{fail=reject}));return ()=>fail(Error('private-provider-detail'));}
const state=()=>db.prepare('SELECT status,accepted_firm_id FROM jobs').get();
describe('payment authorization rollback preserves concurrent workflow changes',()=>{
 it('releases its own unchanged acceptance after failure without leaking provider errors',async()=>{const fail=failingAuthorization();const result=acceptJobAtomic(db,'j','f');expect(state()).toEqual({status:'accepted',accepted_firm_id:'f'});fail();expect(await result).toMatchObject({ok:false,status:502});expect(JSON.stringify(await result)).not.toContain('private-provider-detail');expect(state()).toEqual({status:'waiting',accepted_firm_id:null});});
 it.each(['cancelled','no_show','arrived','completed'])('preserves a concurrent %s transition',async status=>{const fail=failingAuthorization();const result=acceptJobAtomic(db,'j','f');db.prepare('UPDATE jobs SET status=? WHERE id=?').run(status,'j');fail();await result;expect(state()).toEqual({status,accepted_firm_id:'f'});});
 it('does not release another firm after reassignment',async()=>{const fail=failingAuthorization();const result=acceptJobAtomic(db,'j','f');db.exec("UPDATE jobs SET accepted_firm_id='g'");fail();await result;expect(state()).toEqual({status:'accepted',accepted_firm_id:'g'});});
 it('keeps a competing accept from starting another authorization while the first is pending',async()=>{const fail=failingAuthorization();const first=acceptJobAtomic(db,'j','f');expect(await acceptJobAtomic(db,'j','g')).toMatchObject({ok:false,status:409});expect(provider.authorize).toHaveBeenCalledTimes(1);fail();await first;});
 it.each(['cancelled','no_show','arrived','completed'])('does not return a stale success after %s',async status=>{
   let resolve!:()=>void;provider.authorize.mockImplementation(()=>new Promise<void>(done=>{resolve=done}));
   const accepted=acceptJobAtomic(db,'j','f');db.prepare('UPDATE jobs SET status=?').run(status);resolve();
   expect(await accepted).toMatchObject({ok:false,status:409});expect(state()).toEqual({status,accepted_firm_id:'f'});
 });
 it.each(['success','failure'])('does not affect a newer acceptance by the same firm after delayed %s',async outcome=>{
   let resolve!:()=>void,fail!:(e:Error)=>void;
   provider.authorize.mockImplementationOnce(()=>new Promise<void>((done,reject)=>{resolve=done;fail=reject})).mockResolvedValueOnce('p');
   const old=acceptJobAtomic(db,'j','f');db.exec("UPDATE jobs SET status='waiting',accepted_firm_id=NULL");
   expect(await acceptJobAtomic(db,'j','f')).toEqual({ok:true});
   if(outcome==='success')resolve();else fail(Error('timeout'));
   expect(await old).toMatchObject({ok:false});expect(state()).toEqual({status:'accepted',accepted_firm_id:'f'});
 });
});
