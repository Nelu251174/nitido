import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import Sqlite from 'better-sqlite3';
import type Stripe from 'stripe';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {SCHEMA_SQL} from './db';
import {receiveStripeEvent} from './stripeInbox';
import {processStripeEvent} from './stripeEventProcessor';
import {runFinancialRecovery} from './financialRecovery';

let db:Sqlite.Database,clock:number;
const api={accounts:{retrieve:vi.fn()},events:{retrieve:vi.fn()},payouts:{retrieve:vi.fn()},paymentIntents:{retrieve:vi.fn(),cancel:vi.fn()},refunds:{retrieve:vi.fn()}};
const stripe=api as unknown as Stripe;
const run=()=>runFinancialRecovery(db,stripe,{now:()=>clock});
const event=(id='evt_one',payout='po_one')=>({id,type:'payout.paid',account:'acct_f',livemode:false,created:Math.floor(clock/1000),data:{object:{id:payout}}}) as Stripe.Event;
const payout=(id='po_one')=>({id,livemode:false,amount:41000,currency:'ron',status:'paid',arrival_date:1800000000});
const intent=(status='requires_capture')=>({id:'pi_one',livemode:false,amount:50000,currency:'ron',status,metadata:{jobId:'j',paymentId:'p'}});
function seed(){db.exec("INSERT INTO users(id,role,name) VALUES('u','client','Client'),('fu','firma','Firma');INSERT INTO firms(id,user_id,coverage_city,stripe_account_id) VALUES('f','fu','București','acct_f');INSERT INTO jobs(id,client_id,city,street,sqm,space_type,when_type,price_gross,duration_minutes,status,accepted_firm_id) VALUES('j','u','Test','Test',50,'apartament','asap',500,120,'cancelled','f')");}
function cancelRequest(){db.exec("INSERT INTO payments(id,job_id,amount_gross,commission_amount,amount_net,status,stripe_payment_intent_id) VALUES('p','j',500,90,410,'authorized','pi_one');INSERT INTO payment_cancellation_requests(job_id) VALUES('j')");}
beforeEach(()=>{
 vi.resetAllMocks();clock=1800000000000;
 vi.stubEnv('NITIDO_FINANCIAL_RECOVERY_ENABLED','true');vi.stubEnv('STRIPE_SECRET_KEY','rk_test_fixture');vi.stubEnv('NITIDO_STRIPE_PLATFORM_ACCOUNT_ID','acct_platform');vi.stubEnv('NITIDO_STRIPE_CONNECT_TRANSFERS_ENABLED','false');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro');
 db=new Sqlite(':memory:');db.exec(SCHEMA_SQL);seed();
 api.accounts.retrieve.mockResolvedValue({id:'acct_platform'});api.events.retrieve.mockResolvedValue(event());api.payouts.retrieve.mockResolvedValue(payout());api.paymentIntents.retrieve.mockResolvedValue(intent());api.paymentIntents.cancel.mockResolvedValue(intent('canceled'));
});
afterEach(()=>{if(db.open)db.close();vi.unstubAllEnvs();});
describe('bounded periodic sandbox recovery',()=>{
 it.each([
   ['NITIDO_FINANCIAL_RECOVERY_ENABLED','false'],['STRIPE_SECRET_KEY','sk_live_fixture'],['STRIPE_SECRET_KEY','rk_live_fixture'],['STRIPE_SECRET_KEY',''],
   ['NITIDO_STRIPE_PLATFORM_ACCOUNT_ID',''],['NITIDO_STRIPE_CONNECT_TRANSFERS_ENABLED','true'],['NEXT_PUBLIC_SITE_URL','https://nitido.ro'],['NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro@foreign.test'],['NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro/path'],
 ])('rejects unsafe configuration %s before provider access',async(name,value)=>{
   vi.stubEnv(name,value);await expect(run()).rejects.toThrow('SANDBOX_RECOVERY_NOT_CONFIGURED');expect(api.accounts.retrieve).not.toHaveBeenCalled();expect(db.prepare('SELECT * FROM financial_recovery_runs').all()).toHaveLength(0);
 });
 it('verifies platform identity before replaying any resource and stores only a fixed failure code',async()=>{
   receiveStripeEvent(db,event());api.accounts.retrieve.mockResolvedValue({id:'acct_other'});
   await expect(run()).rejects.toThrow('RECOVERY_ACCOUNT_MISMATCH');expect(api.events.retrieve).not.toHaveBeenCalled();
   expect(api.accounts.retrieve).toHaveBeenCalledWith(null);
   expect(db.prepare('SELECT status,last_error FROM financial_recovery_runs').get()).toEqual({status:'failed',last_error:'RECOVERY_RUN_NOT_CONFIRMED'});
 });
 it('replays a known event through the shared processor and skips subsequent delivery',async()=>{
   receiveStripeEvent(db,event());expect(await run()).toMatchObject({status:'completed',attempted:1,processed:1,failed:0});
   expect(api.events.retrieve).toHaveBeenCalledWith('evt_one',{}, {stripeAccount:'acct_f'});
   expect(db.prepare('SELECT status FROM stripe_bank_payouts').get()).toEqual({status:'paid'});
   expect(await processStripeEvent(db,stripe,event())).toMatchObject({duplicate:true});expect(api.payouts.retrieve).toHaveBeenCalledTimes(1);
   clock+=61000;expect(await run()).toMatchObject({attempted:0});
 });
 it.each([{id:'evt_other'},{type:'payout.failed'},{account:'acct_other'},{livemode:true},{data:{object:{id:'po_other'}}}])('rejects retrieved event identity mismatch %j',async change=>{
   receiveStripeEvent(db,event());api.events.retrieve.mockResolvedValue({...event(),...change});
   expect(await run()).toMatchObject({failed:1,processed:0});expect(api.payouts.retrieve).not.toHaveBeenCalled();expect(db.prepare('SELECT * FROM stripe_events').all()).toHaveLength(0);
 });
 it('does not retrieve an inbox envelope with live or unknown mode',async()=>{
   receiveStripeEvent(db,{...event(),livemode:true});expect(await run()).toMatchObject({failed:1});expect(api.events.retrieve).not.toHaveBeenCalled();
 });
 it('leaves events absent from the provider available for intervention without saving error payloads',async()=>{
   receiveStripeEvent(db,event());api.events.retrieve.mockRejectedValue(Error('private full provider payload'));
   expect(await run()).toMatchObject({failed:1});expect(JSON.stringify(db.prepare('SELECT * FROM financial_recovery_items').all())).not.toContain('private full provider payload');expect(db.prepare('SELECT status FROM stripe_webhook_inbox').get()).toEqual({status:'received'});
 });
 it('recovers a known cancellation and audits confirmation',async()=>{
   cancelRequest();expect(await run()).toMatchObject({attempted:1,processed:1});expect(api.paymentIntents.cancel).toHaveBeenCalledWith('pi_one',{}, {idempotencyKey:'nitido-cancel-j'});
   expect(db.prepare('SELECT status FROM payments').get()).toEqual({status:'cancelled'});expect(db.prepare("SELECT event_type FROM workflow_audit_log WHERE event_type='PAYMENT_CANCELLATION_CONFIRMED'").all()).toHaveLength(1);
 });
 it('keeps an unknown authorization pending and backs off without any creation or cancellation',async()=>{
   db.exec("INSERT INTO payment_cancellation_requests(job_id) VALUES('j')");
   expect(await run()).toMatchObject({attempted:1,deferred:1});expect(api.paymentIntents.retrieve).not.toHaveBeenCalled();expect(api.paymentIntents.cancel).not.toHaveBeenCalled();
   expect(await run()).toMatchObject({status:'cooldown',attempted:0});clock+=61000;expect(await run()).toMatchObject({deferred:1});
   expect(db.prepare('SELECT attempts,next_attempt_ms FROM financial_recovery_items').get()).toEqual({attempts:2,next_attempt_ms:clock+120000});
 });
 it('parks unresolved work after eight attempts and does not retry it blindly',async()=>{
   db.exec("INSERT INTO payment_cancellation_requests(job_id) VALUES('j');INSERT INTO financial_recovery_items(kind,resource_id,attempts) VALUES('cancellation','j',7)");
   expect(await run()).toMatchObject({deferred:1});expect(db.prepare('SELECT attempts,parked FROM financial_recovery_items').get()).toEqual({attempts:8,parked:1});
   clock+=24*3600000;expect(await run()).toMatchObject({attempted:0});
 });
 it('does not cancel active jobs even if an old cancellation request remains',async()=>{
   cancelRequest();db.exec("UPDATE jobs SET status='accepted'");expect(await run()).toMatchObject({attempted:0});expect(api.paymentIntents.cancel).not.toHaveBeenCalled();
 });
 it('rejects live PaymentIntents while keeping the request visible',async()=>{
   cancelRequest();api.paymentIntents.retrieve.mockResolvedValue({...intent(),livemode:true});expect(await run()).toMatchObject({failed:1});expect(api.paymentIntents.cancel).not.toHaveBeenCalled();expect(db.prepare('SELECT status FROM payment_cancellation_requests').get()).toEqual({status:'needs_review'});
 });
 it('limits one run to ten items',async()=>{
   for(let i=0;i<12;i++)receiveStripeEvent(db,event(`evt_${i}`,`po_${i}`));
   api.events.retrieve.mockImplementation(async(id:string)=>event(id,id.replace('evt_','po_')));api.payouts.retrieve.mockImplementation(async(id:string)=>payout(id));
   expect(await run()).toMatchObject({attempted:10,processed:10});expect(db.prepare("SELECT * FROM stripe_webhook_inbox WHERE status='received'").all()).toHaveLength(2);
 });
 it('stops starting work once the batch budget is consumed',async()=>{
   receiveStripeEvent(db,event());api.accounts.retrieve.mockImplementation(async()=>{clock+=41000;return {id:'acct_platform'};});expect(await run()).toMatchObject({attempted:0});expect(api.events.retrieve).not.toHaveBeenCalled();
 });
 it('does not run overlapping batches',async()=>{
   let resolve!:(value:unknown)=>void;api.accounts.retrieve.mockImplementationOnce(()=>new Promise(done=>{resolve=done}));
   const first=run();expect(await run()).toMatchObject({status:'busy',attempted:0});expect(api.accounts.retrieve).toHaveBeenCalledTimes(1);resolve({id:'acct_platform'});expect(await first).toMatchObject({status:'completed'});
 });
 it('fences a delayed worker after another run takes over its expired lease',async()=>{
   let resolve!:(value:unknown)=>void;api.accounts.retrieve.mockImplementationOnce(()=>new Promise(done=>{resolve=done}));
   const old=run();clock+=121000;expect(await run()).toMatchObject({status:'completed'});resolve({id:'acct_platform'});
   await expect(old).rejects.toThrow('RECOVERY_LEASE_LOST');expect(db.prepare('SELECT status FROM financial_recovery_runs ORDER BY started_ms').all()).toEqual([{status:'abandoned'},{status:'completed'}]);
 });
 it('does not commit provider data once the lease expired during retrieval',async()=>{
   receiveStripeEvent(db,event());api.payouts.retrieve.mockImplementation(async()=>{clock+=121000;return payout();});
   await expect(run()).rejects.toThrow('RECOVERY_LEASE_LOST');expect(db.prepare('SELECT * FROM stripe_bank_payouts').all()).toHaveLength(0);expect(db.prepare('SELECT * FROM stripe_events').all()).toHaveLength(0);
 });
 it('does not issue cancellation after losing the lease while reading the intent',async()=>{
   cancelRequest();api.paymentIntents.retrieve.mockImplementation(async()=>{clock+=121000;return intent();});await expect(run()).rejects.toThrow('RECOVERY_LEASE_LOST');expect(api.paymentIntents.cancel).not.toHaveBeenCalled();
 });
 it('rejects an old worker snapshot after a concurrent webhook updates the same payout',async()=>{
   receiveStripeEvent(db,event());let resolve!:(value:unknown)=>void;api.payouts.retrieve.mockImplementationOnce(()=>new Promise(done=>{resolve=done}));
   const worker=run();await vi.waitFor(()=>expect(api.payouts.retrieve).toHaveBeenCalledTimes(1));
   await processStripeEvent(db,stripe,event('evt_new'));resolve({...payout(),status:'failed'});
   expect(await worker).toMatchObject({failed:1,processed:0});expect(db.prepare('SELECT status FROM stripe_bank_payouts').get()).toEqual({status:'paid'});
   clock+=61000;expect(await run()).toMatchObject({processed:1});
 });
 it('retains committed financial effects if persisting the batch result fails and avoids a duplicate on retry',async()=>{
   receiveStripeEvent(db,event());db.exec("CREATE TRIGGER reject_run_counts BEFORE UPDATE ON financial_recovery_runs WHEN NEW.processed>0 BEGIN SELECT RAISE(ABORT,'fixture'); END");
   await expect(run()).rejects.toThrow('fixture');expect(db.prepare('SELECT status FROM stripe_webhook_inbox').get()).toEqual({status:'processed'});
   db.exec('DROP TRIGGER reject_run_counts');clock+=61000;expect(await run()).toMatchObject({attempted:0});expect(api.payouts.retrieve).toHaveBeenCalledTimes(1);
 });
 it('uses the persisted lease across independent database connections',async()=>{
   const dir=mkdtempSync(join(tmpdir(),'nitido-worker-concurrent-'));db.close();let other:Sqlite.Database|undefined;
   try{
     db=new Sqlite(join(dir,'db.sqlite'));db.exec(SCHEMA_SQL);seed();other=new Sqlite(join(dir,'db.sqlite'));
     let resolve!:(value:unknown)=>void;api.accounts.retrieve.mockImplementationOnce(()=>new Promise(done=>{resolve=done}));
     const first=run();expect(await runFinancialRecovery(other,stripe,{now:()=>clock})).toMatchObject({status:'busy'});resolve({id:'acct_platform'});await first;
   }finally{other?.close();if(db.open)db.close();rmSync(dir,{recursive:true,force:true});}
 });
 it('recovers persisted work after database close and reopen, retaining an interrupted attempt',async()=>{
   const dir=mkdtempSync(join(tmpdir(),'nitido-worker-'));db.close();
   try{
     db=new Sqlite(join(dir,'db.sqlite'));db.exec(SCHEMA_SQL);seed();receiveStripeEvent(db,event());
     db.prepare("INSERT INTO financial_recovery_runs(id,status,started_ms,attempted) VALUES('interrupted','running',?,1)").run(clock-121000);
     db.prepare("INSERT INTO financial_recovery_lock(id,token,lease_until_ms) VALUES(1,'interrupted',?)").run(clock-1);
     db.prepare("INSERT INTO financial_recovery_items(kind,resource_id,attempts,next_attempt_ms) VALUES('event','evt_one',1,?)").run(clock-1);
     db.close();db=new Sqlite(join(dir,'db.sqlite'));db.exec(SCHEMA_SQL);
     expect(await run()).toMatchObject({processed:1});expect(db.prepare("SELECT status FROM financial_recovery_runs WHERE id='interrupted'").get()).toEqual({status:'abandoned'});expect(db.prepare('SELECT attempts FROM financial_recovery_items').get()).toEqual({attempts:2});
   }finally{if(db.open)db.close();rmSync(dir,{recursive:true,force:true});}
 });
});
