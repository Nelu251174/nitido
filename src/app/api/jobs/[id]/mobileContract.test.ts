import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import Database from 'better-sqlite3';
import {NextRequest} from 'next/server';
const state=vi.hoisted(()=>({db:null as Database.Database|null,user:{id:'firm-user',role:'firma'} as {id:string;role:string}|null}));
vi.mock('@/lib/db',async original=>({...await original<typeof import('@/lib/db')>(),get db(){return state.db!;},getFirmByUserId:(id:string)=>state.db!.prepare('SELECT * FROM firms WHERE user_id=?').get(id)}));
vi.mock('@/lib/auth',()=>({getCurrentUser:async()=>state.user}));
import {initializeDatabase} from '@/lib/db';
import {freezeExecutionRules,saveExecutionTemplate} from '@/lib/executionTemplates';
import {GET} from './route';
const read=(id='job')=>GET(new NextRequest(`https://sandbox.nitido.ro/api/jobs/${id}`),{params:Promise.resolve({id})});
beforeEach(()=>{
 state.user={id:'firm-user',role:'firma'};state.db=new Database(':memory:');state.db.pragma('foreign_keys=ON');initializeDatabase(state.db);
 state.db.exec("INSERT INTO users(id,role,name) VALUES('client','client','Client'),('other','client','Other'),('firm-user','firma','Firm'),('old-firm-user','firma','Old firm');INSERT INTO firms(id,user_id,verified,coverage_city) VALUES('firm','firm-user',1,'Constanța'),('old-firm','old-firm-user',1,'Constanța');INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,scheduled_at,price_gross,duration_minutes,status,accepted_firm_id) VALUES('job','client','PRIVATE ADDRESS','Constanța',75,'apartament','scheduled','2099-10-03T07:00:00.000Z',550,150,'accepted','firm');");
 state.db.transaction(()=>{
  saveExecutionTemplate(state.db!,{scope:'standard',revision:0,items:[{key:'custom_surface',label:'Suprafață contractuală'},{key:'custom_finish',label:'Verificare contractuală'}],photoRules:{arrivalMin:2,completionMin:3},reason:'Synthetic contract fixture'},'qa-manager');
  freezeExecutionRules(state.db!,'job','standard');
  saveExecutionTemplate(state.db!,{scope:'standard',revision:1,items:[{key:'new_item',label:'Future policy'}],photoRules:{arrivalMin:4,completionMin:5},reason:'Synthetic future policy'},'qa-manager');
 }).immediate();
 const insert=state.db.prepare('INSERT INTO job_photos(id,job_id,filename,proof_type,uploaded_by_firm_id,status,validated_at) VALUES(?,?,?,?,?,?,?)');
 for(const [id,type,firm,status,validation] of [['context','CLIENT_CONTEXT',null,'VALID',null],['current-arrival','ARRIVAL','firm','VALID','2026-10-01T10:00:00Z'],['current-completion','COMPLETION','firm','VALID','2026-10-01T11:00:00Z'],['old-arrival','ARRIVAL','old-firm','VALID','2026-10-01T10:00:00Z'],['old-completion','COMPLETION','old-firm','VALID','2026-10-01T11:00:00Z'],['unvalidated','COMPLETION','firm','VALID',null],['rejected','ARRIVAL','firm','REJECTED','2026-10-01T11:00:00Z']] as const)insert.run(id,'job',`${id}.png`,type,firm,status,validation);
});
afterEach(()=>state.db!.close());
describe('authorized web/native job detail contract',()=>{
 it.each([['firm-user','firma'],['client','client']])('exposes frozen operational rules and only current validated proofs to %s',async(id,role)=>{
  state.user={id,role};const res=await read(),body=await res.json();expect(res.status).toBe(200);expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  expect(body.job.photoRules).toEqual({arrivalMin:2,completionMin:3});expect(body.job.executionRules).toEqual({scope:'standard',revision:1,items:[{key:'custom_surface',label:'Suprafață contractuală'},{key:'custom_finish',label:'Verificare contractuală'}]});
  expect(body.job.proofs.map((p:{id:string})=>p.id).sort()).toEqual(['current-arrival','current-completion']);expect(body.job.photos.sort()).toEqual(['/api/uploads/context','/api/uploads/current-arrival','/api/uploads/current-completion']);
  expect(body.job.price_gross).toBe(role==='firma'?undefined:550);
 });
 it('keeps operational rules, proofs and exact address out of unallocated eligible preview',async()=>{
  state.db!.exec("UPDATE jobs SET status='waiting',accepted_firm_id=NULL");const res=await read(),body=await res.json();expect(res.status).toBe(200);expect(body.job.id).toBe('job');for(const key of ['photoRules','executionRules','photos','proofs','street','client_id','price_gross'])expect(body.job[key]).toBeUndefined();
 });
 it('denies another client and the former assigned firm',async()=>{
  for(const [id,role] of [['other','client'],['old-firm-user','firma']]){state.user={id,role};expect((await read()).status).toBe(403);}
 });
 it('requires an authenticated session',async()=>{state.user=null;expect((await read()).status).toBe(401)});
 it('uses legacy snapshots rather than today’s template when the historical snapshot is absent',async()=>{
  state.db!.exec("INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,scheduled_at,price_gross,duration_minutes,status,accepted_firm_id) SELECT 'legacy',client_id,street,city,sqm,space_type,when_type,scheduled_at,price_gross,duration_minutes,status,accepted_firm_id FROM jobs WHERE id='job'");const body=await (await read('legacy')).json();expect(body.job.photoRules).toEqual({arrivalMin:1,completionMin:1});expect(body.job.executionRules.scope).toBe('legacy');expect(body.job.executionRules.revision).toBe(0);expect(body.job.executionRules.items.some((i:{key:string})=>i.key==='new_item')).toBe(false);
 });
});
