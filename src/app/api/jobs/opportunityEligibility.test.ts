import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import Database from 'better-sqlite3';
import {NextRequest} from 'next/server';
const state=vi.hoisted(()=>({db:null as Database.Database|null}));
vi.mock('@/lib/db',async original=>({...await original<typeof import('@/lib/db')>(),get db(){return state.db!;},getFirmByUserId:()=>({id:'f',verified:1,coverage_city:'Constanța',coverage_cities_extra:null})}));
vi.mock('@/lib/auth',()=>({getCurrentUser:async()=>({id:'u',role:'firma'})}));
import {initializeDatabase} from '@/lib/db';
import {canPreviewOpportunity} from '@/lib/opportunityEligibility';
import type {JobRow} from '@/lib/types';
import {GET} from './[id]/route';
import {GET as listGET} from './route';
const job=()=>state.db!.prepare('SELECT * FROM jobs WHERE id=?').get('j') as JobRow;
const read=()=>GET(new NextRequest('https://sandbox.nitido.ro/api/jobs/j'),{params:Promise.resolve({id:'j'})});
beforeEach(()=>{
 state.db=new Database(':memory:');state.db.pragma('foreign_keys=ON');initializeDatabase(state.db);
 state.db.exec("INSERT INTO users(id,role,name) VALUES('c','client','Client'),('u','firma','Firma');INSERT INTO firms(id,user_id,verified,coverage_city) VALUES('f','u',1,'Constanța');INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,scheduled_at,price_gross,duration_minutes,status) VALUES('j','c','PRIVATE ADDRESS','Constanța',75,'apartament','scheduled','2099-10-03T07:00:00.000Z',550,150,'waiting');");
});
afterEach(()=>state.db!.close());
it('allows an eligible preview and excludes private fields',async()=>{const res=await read();expect(res.status).toBe(200);const body=await res.json();expect(body.job.id).toBe('j');expect(body.job.currency).toBe('RON');expect(body.job.firm_payout).toBe(451);expect(body.job.street).toBeUndefined();expect(body.job.client_id).toBeUndefined();expect(body.job.photos).toBeUndefined();});
it.each(['2099-12-01T00:00:00Z','invalid date'])('rejects active or invalid suspension %s on direct access',async value=>{state.db!.prepare('UPDATE firms SET suspended_until=?').run(value);expect((await read()).status).toBe(403);});
it('allows an expired suspension',()=>{state.db!.exec("UPDATE firms SET suspended_until='2020-01-01T00:00:00Z'");expect(canPreviewOpportunity(state.db!,'f',job())).toBe(true);});
it.each(["verified=0","coverage_city='Iași'"])('rejects ineligible firm %s',async update=>{state.db!.exec('UPDATE firms SET '+update);expect((await read()).status).toBe(403);});
it.each(["'2099-10-03T08:00:00.000Z'",'NULL'])('rejects occupied or unknown capacity %s',async timing=>{state.db!.exec(`INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,scheduled_at,price_gross,duration_minutes,status,accepted_firm_id) VALUES('occupied','c','Other','Constanța',75,'apartament','scheduled',${timing},550,150,'accepted','f')`);expect((await read()).status).toBe(403);});
it('does not reserve capacity when previewing',async()=>{await read();expect(job().status).toBe('waiting');expect(job().accepted_firm_id).toBeNull();expect(state.db!.prepare('SELECT * FROM workspace_assignments').all()).toEqual([]);});
it('preserves allocated history access despite suspension',async()=>{state.db!.exec("UPDATE firms SET suspended_until='2099-12-01';UPDATE jobs SET status='accepted',accepted_firm_id='f'");const res=await read();expect(res.status).toBe(200);expect((await res.json()).job.street).toBe('PRIVATE ADDRESS');});

it('returns the stored travel buffer in the eligible feed without private job or pricing data',async()=>{
 state.db!.exec("UPDATE jobs SET buffer_minutes=47 WHERE id='j'");
 const res=await listGET(new NextRequest('https://sandbox.nitido.ro/api/jobs?status=waiting'));
 expect(res.status).toBe(200);
 const body=await res.json();
 expect(body.jobs).toHaveLength(1);
 expect(body.jobs[0].buffer_minutes).toBe(47);
 for(const key of ['street','client_id','price_gross','pricing_snapshot'])expect(body.jobs[0][key]).toBeUndefined();
});

it('returns native EUR stored payout cents on the authorized detail and hides the pricing snapshot',async()=>{
 const snapshot={currency:'EUR',countryCode:'DE',city:'Berlin',tariffId:'synthetic',revision:1,recordedAt:'2026-11-02T10:00:00Z',netMinor:10001,vatMinor:0,vatBps:0,grossMinor:10001,clientTotalMinor:10001,creditMinor:0,durationMinutes:180,workers:1,personMinutes:180,lines:[{code:'cleaning',amountMinor:10001},{code:'vat',amountMinor:0}]};
 state.db!.prepare("UPDATE jobs SET status='accepted',accepted_firm_id='f',pricing_snapshot=? WHERE id='j'").run(JSON.stringify(snapshot));
 state.db!.exec("INSERT INTO payments(id,job_id,amount_gross,commission_amount,amount_net,currency,amount_gross_minor,commission_amount_minor,amount_net_minor) VALUES('payment','j',100,18,80,'EUR',10001,1800,8201)");
 const response=await read(),body=await response.json();expect(response.status).toBe(200);expect(body.job).toMatchObject({currency:'EUR',firm_payout:82.01,financial:{firmPayout:82.01}});expect(body.job.pricing_snapshot).toBeUndefined();expect(body.job.price_gross).toBeUndefined();
});
