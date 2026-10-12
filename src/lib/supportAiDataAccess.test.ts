import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import Database from 'better-sqlite3';
const state=vi.hoisted(()=>({db:null as Database.Database|null}));
vi.mock('@/lib/db',async original=>({...await original<typeof import('@/lib/db')>(),get db(){return state.db!;},getFirmByUserId:(id:string)=>state.db!.prepare('SELECT * FROM firms WHERE user_id=?').get(id)}));
import {initializeDatabase,type UserRow} from './db';
import {buildAuthorizedSupportContext} from './supportAi';
const user=(id:string)=>state.db!.prepare('SELECT * FROM users WHERE id=?').get(id) as UserRow;
beforeEach(()=>{
 state.db=new Database(':memory:');state.db.pragma('foreign_keys=ON');initializeDatabase(state.db);
 state.db.exec("INSERT INTO users(id,role,name) VALUES('client','client','Client'),('other','client','Other'),('firm-user','firma','Firm'),('other-firm-user','firma','Other firm');INSERT INTO firms(id,user_id,verified,coverage_city) VALUES('firm','firm-user',1,'Constanța'),('other-firm','other-firm-user',1,'Constanța');INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,scheduled_at,price_gross,duration_minutes,status,accepted_firm_id) VALUES('own','client','PRIVATE ADDRESS','Constanța',75,'apartament','scheduled','2026-10-03T07:00:00.000Z',1234,150,'completed','firm'),('foreign','other','FOREIGN ADDRESS','Constanța',75,'apartament','scheduled','2026-10-04T07:00:00.000Z',9876,150,'completed','other-firm');INSERT INTO payments(id,job_id,amount_gross,commission_amount,amount_net,status) VALUES('payment-own','own',1234,358,876,'captured'),('payment-foreign','foreign',9876,3087,6789,'captured');");
});
afterEach(()=>state.db!.close());
describe('AI context uses the same price and ownership boundaries as the partner API',()=>{
 it('preserves the authenticated client’s own total while excluding another client and exact addresses',()=>{
  const context=JSON.parse(buildAuthorizedSupportContext(user('client')));expect(context.ownJobs).toHaveLength(1);expect(context.ownJobs[0].id).toBe('own');expect(context.ownJobs[0].price_gross).toBe(1234);expect(JSON.stringify(context)).not.toContain('foreign');expect(JSON.stringify(context)).not.toContain('PRIVATE ADDRESS');
 });
 it('provides only the allocated firm’s own payout and permitted state, without gross prices or inferable margins',()=>{
  const raw=buildAuthorizedSupportContext(user('firm-user')),context=JSON.parse(raw);expect(context.ownAllocatedJobs).toHaveLength(1);expect(context.ownAllocatedJobs[0].id).toBe('own');expect(context.ownAllocatedJobs[0].firm_payout).toBe(876);expect(context.ownAllocatedJobs[0].payment_status).toBe('captured');
  for(const value of ['price_gross','amount_gross','pricing_snapshot','credit_applied','commission','platformFee','1234','foreign','PRIVATE ADDRESS'])expect(raw).not.toContain(value);
 });
});
