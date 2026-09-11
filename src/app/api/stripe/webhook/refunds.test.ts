import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const state=vi.hoisted(()=>({constructEvent:vi.fn(),retrieve:vi.fn()}));
vi.mock('@/lib/db',async original=>{const actual=await original<typeof import('@/lib/db')>();const {default:Sqlite}=await import('better-sqlite3');const db=new Sqlite(':memory:');db.exec(actual.SCHEMA_SQL);return {...actual,db};});
vi.mock('stripe',()=>({default:class{webhooks={constructEvent:state.constructEvent};refunds={retrieve:state.retrieve}}}));
import {db} from '@/lib/db';
import {POST} from './route';
function request(){return new NextRequest('https://nitido.test/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':'fixture'},body:'fixture'});}
const refund=(status:string)=>({id:'re_test',payment_intent:'pi_test',currency:'ron',amount:50000,status});
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('STRIPE_SECRET_KEY','sk_test_fixture');vi.stubEnv('STRIPE_WEBHOOK_SECRET','whsec_fixture');db.exec("DELETE FROM stripe_events;DELETE FROM payment_refunds;DELETE FROM payments;DELETE FROM jobs;DELETE FROM users;INSERT INTO users(id,role,name) VALUES('u','client','Test');INSERT INTO jobs(id,client_id,city,street,sqm,space_type,when_type,price_gross,duration_minutes,status) VALUES('j','u','Test','Test',50,'apartament','asap',500,120,'completed');INSERT INTO payments(id,job_id,amount_gross,commission_amount,amount_net,status,stripe_payment_intent_id,refund_status) VALUES('p','j',500,90,410,'captured','pi_test','pending');INSERT INTO payment_refunds(id,payment_id,amount,stripe_refund_id,status) VALUES('r','p',500,'re_test','pending')");state.constructEvent.mockReturnValue({id:'evt_test',type:'refund.updated',data:{object:{id:'re_test'}}});});
afterEach(()=>vi.unstubAllEnvs());
describe('refund webhook reconciliation',()=>{
 it('fetches current provider state and deduplicates delivery',async()=>{state.retrieve.mockResolvedValue(refund('succeeded'));expect((await POST(request())).status).toBe(200);expect(db.prepare('SELECT status FROM payments').get()).toEqual({status:'refunded'});expect((await POST(request())).status).toBe(200);expect(state.retrieve).toHaveBeenCalledTimes(1);});
 it('allows retry after provider failure',async()=>{state.retrieve.mockRejectedValueOnce(Error('timeout')).mockResolvedValueOnce(refund('succeeded'));expect((await POST(request())).status).toBe(500);expect(db.prepare('SELECT * FROM stripe_events').all()).toHaveLength(0);expect((await POST(request())).status).toBe(200);expect(db.prepare('SELECT status FROM payments').get()).toEqual({status:'refunded'});});
 it('does not equate a charge notification with successful full refund',async()=>{state.constructEvent.mockReturnValue({id:'evt_test',type:'charge.refunded',data:{object:{payment_intent:'pi_test',metadata:{paymentId:'p'},amount_refunded:100}}});state.retrieve.mockResolvedValue(refund('pending'));expect((await POST(request())).status).toBe(200);expect(db.prepare('SELECT status FROM payments').get()).toEqual({status:'captured'});});
 it('rejects invalid signatures without fetching provider data',async()=>{state.constructEvent.mockImplementation(()=>{throw Error('bad signature')});expect((await POST(request())).status).toBe(400);expect(state.retrieve).not.toHaveBeenCalled();});
});
