import {saveExecutionTemplate,jobExecutionRules} from '@/lib/executionTemplates';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import Database from 'better-sqlite3';
import {NextRequest} from 'next/server';
const state=vi.hoisted(()=>({db:null as Database.Database|null,user:'c'}));
vi.mock('@/lib/db',async original=>{const actual=await original<typeof import('@/lib/db')>();return {...actual,get db(){return state.db!;}};});
vi.mock('@/lib/auth',()=>({getCurrentUser:async()=>state.db!.prepare('SELECT * FROM users WHERE id=?').get(state.user)}));
vi.mock('@/lib/clientPayments',()=>({getClientCardInfo:()=>({stripeConfigured:false,hasCard:false})}));
vi.mock('@/lib/push',()=>({queueNewJobFirmPushes:()=>[],processPushOutbox:vi.fn()}));
import {initializeDatabase} from '@/lib/db';
import {changeCustomerOperations} from '@/lib/customerOperations';
import {createTariff,simulateTariff,publishTariff} from '@/lib/managedPricingStore';
import {POST as quote} from './quote/route';
import {POST as book} from './route';
const now=new Date('2026-10-01T06:00:00Z');
const body={bathroomCount:1,street:'Test 1',city:'București',spaceType:'apartament',sqm:80,windowsSqm:10,mode:'standard',whenType:'asap',photoIds:[]};
const req=(path:string,data:unknown,key?:string)=>new NextRequest(`https://sandbox.nitido.ro/api/jobs${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify(data)});
async function offer(data=body){const r=await quote(req('/quote',data));expect(r.status).toBe(200);return (await r.json()).quote;}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(now);vi.stubEnv('NITIDO_MANAGED_PRICING_SANDBOX','true');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro');vi.stubEnv('STRIPE_SECRET_KEY','');state.user='c';state.db=new Database(':memory:');state.db.pragma('foreign_keys=ON');initializeDatabase(state.db);state.db.exec("INSERT INTO users(id,role,name,credit_balance) VALUES('c','client','Test',20),('other','client','Other',0)");const t=createTariff(state.db,'Test'),sim=simulateTariff(state.db,t.id,0);publishTariff(state.db,t.id,0,sim.simulationId,now.toISOString(),null,now);});
afterEach(()=>{state.db?.close();vi.useRealTimers();vi.unstubAllEnvs();});
describe('managed quotes through real booking route',()=>{
 it.each(['standard','express'])('creates %s once and freezes the accepted snapshot',async mode=>{const data={...body,mode},q=await offer(data);const first=await book(req('',{...data,quoteId:q.id},'same-request'));expect(first.status).toBe(201);const job=(await first.json()).job;expect(job.price_gross).toBe(1320);expect(job.credit_applied).toBe(20);expect(JSON.parse(job.pricing_snapshot)).toMatchObject(q.pricing);expect(JSON.parse(job.pricing_snapshot).bookingTerms).toMatchObject({duration:{scheduledMinutes:210,minimumOnsiteMinutes:180},commission:{rate:0.18},inclusions:jobExecutionRules(state.db!,job.id).items});vi.setSystemTime(new Date('2026-10-01T08:00:00Z'));const replay=await book(req('',{...data,quoteId:q.id},'same-request'));expect(replay.status).toBe(200);expect((await replay.json()).job.id).toBe(job.id);const secondKey=await book(req('',{...data,quoteId:q.id},'different-request'));expect((await secondKey.json()).job.id).toBe(job.id);expect(state.db!.prepare('SELECT count(*) n FROM jobs').get()).toEqual({n:1});expect(state.db!.prepare("SELECT credit_balance FROM users WHERE id='c'").get()).toEqual({credit_balance:0});});
 it('blocks missing, foreign, expired and changed quotes without creating jobs',async()=>{const q=await offer();expect((await book(req('',body))).status).toBe(409);state.user='other';expect((await book(req('',{...body,quoteId:q.id}))).status).toBe(409);state.user='c';expect((await book(req('',{...body,sqm:81,quoteId:q.id}))).status).toBe(409);vi.setSystemTime(new Date(q.expiresAt));expect((await book(req('',{...body,quoteId:q.id}))).status).toBe(409);expect(state.db!.prepare('SELECT count(*) n FROM jobs').get()).toEqual({n:0});});
 it('requires reconfirmation after another booking consumes credit',async()=>{const a=await offer(),b=await offer();expect((await book(req('',{...body,quoteId:a.id}))).status).toBe(201);expect((await book(req('',{...body,quoteId:b.id}))).status).toBe(409);expect(state.db!.prepare('SELECT count(*) n FROM jobs').get()).toEqual({n:1});});
 it('rolls back job and credit when quote linking fails',async()=>{const q=await offer();state.db!.exec("CREATE TRIGGER test_failure BEFORE UPDATE OF job_id ON booking_price_quotes BEGIN SELECT RAISE(ABORT,'injected failure'); END;");await expect(book(req('',{...body,quoteId:q.id}))).rejects.toThrow('injected failure');expect(state.db!.prepare('SELECT count(*) n FROM jobs').get()).toEqual({n:0});expect(state.db!.prepare("SELECT credit_balance FROM users WHERE id='c'").get()).toEqual({credit_balance:20});});
 it('keeps legacy creation available when the sandbox flag is off',async()=>{vi.stubEnv('NITIDO_MANAGED_PRICING_SANDBOX','false');expect((await book(req('',body,'legacy'))).status).toBe(201);expect(state.db!.prepare('SELECT count(*) n FROM booking_price_quotes').get()).toEqual({n:0});});
 it('includes Express 60 once and rejects a scheduled premium booking',async()=>{const data={...body,express60:true},q=await offer(data);expect(q.pricing.lines.filter((l:{code:string})=>l.code==='express60')).toHaveLength(1);const r=await book(req('',{...data,quoteId:q.id}));expect(r.status).toBe(201);expect((await r.json()).job.price_gross*100).toBe(q.pricing.grossBani);expect((await book(req('',{...data,quoteId:q.id,whenType:'scheduled'}))).status).toBe(400);});
});

it.each(['standard','express'])('blocks new %s reservations atomically without spending credit, but replays an existing reservation',async mode=>{
 const data={...body,mode},q=await offer(data);
 const restrict=(revision:number,blocked:boolean)=>state.db!.transaction(()=>changeCustomerOperations(state.db!,{clientId:'c',action:'restrict',revision,blockBookings:blocked,blockAssessments:false,reason:'Internal investigation'},'admin')).immediate();
 restrict(0,true);
 const blocked=await book(req('',{...data,quoteId:q.id},'retry'));
 expect(blocked.status).toBe(403);expect(await blocked.text()).not.toContain('Internal investigation');
 expect(state.db!.prepare('SELECT COUNT(*) n FROM jobs').get()).toEqual({n:0});expect(state.db!.prepare("SELECT credit_balance FROM users WHERE id='c'").get()).toEqual({credit_balance:20});
 restrict(1,false);const success=await book(req('',{...data,quoteId:q.id},'retry'));expect(success.status).toBe(201);
 restrict(2,true);expect((await book(req('',{...data,quoteId:q.id},'retry'))).status).toBe(200);
});
it('captures the configured checklist in the real booking transaction and keeps it on retries',async()=>{
 const publish=(revision:number,label:string)=>state.db!.transaction(()=>saveExecutionTemplate(state.db!,{scope:'standard',revision,reason:'Test',items:[{key:'task',label}]},'admin')).immediate();
 publish(0,'Original');const q=await offer();const first=await book(req('',{...body,quoteId:q.id},'rules'));const job=(await first.json()).job;
 expect(jobExecutionRules(state.db!,job.id)).toMatchObject({revision:1,items:[{key:'task',label:'Original'}]});publish(1,'Changed');
 expect((await book(req('',{...body,quoteId:q.id},'rules'))).status).toBe(200);expect(jobExecutionRules(state.db!,job.id).items[0].label).toBe('Original');
});

it('caps credit to the platform share consistently in quote, snapshot, balance debit and existing payment split',async()=>{state.db!.exec("UPDATE users SET credit_balance=300 WHERE id='c'");const q=await offer();expect(q.pricing.creditBani).toBe(23800);expect(q.pricing.clientTotalBani).toBe(108200);const result=await book(req('',{...body,quoteId:q.id},'credit-reconcile'));expect(result.status).toBe(201);const job=(await result.json()).job;expect(job.credit_applied).toBe(238);expect(JSON.parse(job.pricing_snapshot).clientTotalBani).toBe(108200);expect(state.db!.prepare("SELECT credit_balance FROM users WHERE id='c'").get()).toEqual({credit_balance:62});});

it('uses the same capped credit on the normal live booking path and never spends the remaining balance twice',async()=>{vi.stubEnv('NITIDO_MANAGED_PRICING_SANDBOX','false');state.db!.exec("UPDATE users SET credit_balance=300 WHERE id='c'");const first=await book(req('',body,'normal-credit-first'));expect(first.status).toBe(201);const a=(await first.json()).job;expect(a.duration_minutes).toBe(210);expect(a.credit_applied).toBe(238);const snapshot=JSON.parse(a.pricing_snapshot);expect(snapshot.clientTotalBani).toBe(108200);expect(snapshot.bookingTerms.settlement.quotedClientBani).toBe(108200);expect(state.db!.prepare("SELECT credit_balance FROM users WHERE id='c'").get()).toEqual({credit_balance:62});const second=await book(req('',body,'normal-credit-second'));expect(second.status).toBe(201);expect((await second.json()).job.credit_applied).toBe(62);expect(state.db!.prepare("SELECT credit_balance FROM users WHERE id='c'").get()).toEqual({credit_balance:0});expect((await book(req('',body,'normal-credit-first'))).status).toBe(200);expect(state.db!.prepare('SELECT duration_minutes,credit_applied,pricing_snapshot FROM jobs WHERE id=?').get(a.id)).toEqual({duration_minutes:210,credit_applied:238,pricing_snapshot:a.pricing_snapshot});});

it('authoritatively prices the approved bathroom supplement, preserves retries and never creates payment at posting',async()=>{
 vi.stubEnv('NITIDO_MANAGED_PRICING_SANDBOX','false');
 state.db!.exec("UPDATE users SET credit_balance=0 WHERE id='c'");
 const data={...body,sqm:60,windowsSqm:0,bathroomCount:2,expectedPriceGross:1100};
 const first=await book(req('',{...data,price_gross:1,bathroomFee:0},'bathrooms'));
 expect(first.status).toBe(201);const job=(await first.json()).job;
 expect(job).toMatchObject({price_gross:1100,bathroom_count:2,credit_applied:0,duration_minutes:180});
 const frozen=job.pricing_snapshot;expect(JSON.parse(frozen)).toMatchObject({grossBani:110000,bathroomCount:2,bookingTerms:{bathrooms:{additionalCount:1},commission:{rate:0.18,firmAmountBani:90200}}});
 expect(state.db!.prepare('SELECT COUNT(*) n FROM payments').get()).toEqual({n:0});
 const retry=await book(req('',{...data,bathroomCount:undefined},'bathrooms'));expect(retry.status).toBe(200);expect((await retry.json()).job.pricing_snapshot).toBe(frozen);
 for(const bathroomCount of [undefined,null,-1,1.2,'2',21])expect((await book(req('',{...data,bathroomCount},'invalid-'+String(bathroomCount)))).status).toBe(400);
 expect((await book(req('',{...data,expectedPriceGross:450},'stale-bathroom-total'))).status).toBe(409);
 expect(state.db!.prepare('SELECT COUNT(*) n FROM jobs').get()).toEqual({n:1});
 expect(state.db!.prepare('SELECT pricing_snapshot FROM jobs WHERE id=?').get(job.id)).toEqual({pricing_snapshot:frozen});
});
it('includes bathroom extras in the sandbox authoritative quote without changing its gate',async()=>{const data={...body,sqm:60,windowsSqm:0,bathroomCount:2},q=await offer(data);expect(q.priceGross).toBe(1100);const r=await book(req('',{...data,quoteId:q.id},'sandbox-bathrooms'));expect(r.status).toBe(201);expect((await r.json()).job.price_gross).toBe(1100)});

it('requires reconfirmation of an explicit previous tariff version before creating a new LIVE-path reservation',async()=>{
 vi.stubEnv('NITIDO_MANAGED_PRICING_SANDBOX','false');
 const stale=await book(req('',{...body,pricingVersion:'nitido-2026-10-20-bathrooms-v1',expectedPriceGross:1320},'previous-tariff'));
 expect(stale.status).toBe(409);expect(state.db!.prepare('SELECT COUNT(*) n FROM jobs').get()).toEqual({n:0});
 expect(state.db!.prepare("SELECT credit_balance FROM users WHERE id='c'").get()).toEqual({credit_balance:20});
});

it('prices maintenance on the LIVE path, freezes the service and rejects a stale general total without charging',async()=>{
 vi.stubEnv('NITIDO_MANAGED_PRICING_SANDBOX','false');
 const data={...body,cleaningType:'maintenance',sqm:60,windowsSqm:10,bathroomCount:2,expectedPriceGross:770};
 const r=await book(req('',data,'maintenance-scope'));expect(r.status).toBe(201);const j=(await r.json()).job;
 expect(j).toMatchObject({cleaning_type:'maintenance',price_gross:770});expect(JSON.parse(j.pricing_snapshot)).toMatchObject({cleaningType:'maintenance',grossBani:77000,bookingTerms:{cleaningType:'maintenance'}});
 expect(jobExecutionRules(state.db!,j.id).scope).toBe('maintenance');
 expect((await book(req('',{...data,expectedPriceGross:1220},'wrong-maintenance-total'))).status).toBe(409);
 expect((await book(req('',{...data,cleaningType:'renovation'},'needs-evaluation'))).status).toBe(422);
 expect(state.db!.prepare('SELECT COUNT(*) n FROM payments').get()).toEqual({n:0});expect(state.db!.prepare('SELECT COUNT(*) n FROM jobs').get()).toEqual({n:1});
});
