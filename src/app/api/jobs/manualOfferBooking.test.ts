import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import Database from 'better-sqlite3';
import {NextRequest} from 'next/server';
const state=vi.hoisted(()=>({db:null as Database.Database|null,user:'c',actor:'verified-admin' as string|null,audit:vi.fn()}));
vi.mock('@/lib/db',async original=>{const actual=await original<typeof import('@/lib/db')>();return {...actual,get db(){return state.db!;}};});
vi.mock('@/lib/auth',()=>({getCurrentUser:async()=>state.db!.prepare('SELECT * FROM users WHERE id=?').get(state.user)}));
vi.mock('@/lib/adminAuth',()=>({getAdminActorId:async()=>state.actor,auditAdminAction:state.audit}));
vi.mock('@/lib/clientPayments',()=>({getClientCardInfo:()=>({stripeConfigured:false,hasCard:false})}));
vi.mock('@/lib/push',()=>({queueNewJobFirmPushes:()=>[],processPushOutbox:vi.fn()}));
import {initializeDatabase} from '@/lib/db';
import {saveExecutionTemplate,jobExecutionRules} from '@/lib/executionTemplates';
import {createAssessment} from '@/lib/assessments';
import {saveManualEstimate} from '@/lib/manualEstimates';
import {saveMarginPolicy} from '@/lib/marginPolicy';
import {publishManualOffer,decideManualOffer} from '@/lib/manualOffers';
import {compatibleManualOffer} from '@/lib/manualOfferBooking';
import {COST_CODES,emptyManualEstimate} from '@/lib/operationalMargin';
import {calcNetForFirm} from '@/lib/pricing';
import {calculatePaymentSplit} from '@/lib/payments';
import {POST} from './route';
import {POST as proposeSchedule,GET as readSchedule} from '../assessments/schedule/route';
import {latestOfferSchedule} from '@/lib/manualOfferSchedule';
const now=new Date('2026-10-01T06:00:00Z');
const data={street:'Test 1',postalCode:'010101',city:'București',spaceType:'apartament',sqm:80,windowsSqm:0,mode:'express',whenType:'asap',photoIds:[],manualBookingConfirmed:true,confirmedManualTotalBani:50000};
const req=(body:unknown,key='retry')=>new NextRequest('https://sandbox.nitido.ro/api/jobs',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(body)});
function offer(options:{discount?:number;provider?:number;accepted?:boolean;category?:string}={}){const db=state.db!;const id=createAssessment(db,'c',crypto.randomUUID(),{category:options.category??'general',city:'București',sqm:80,rooms:2,bathrooms:1,difficulty:'normal',notes:'Lucrare evaluată',appliances:0,windowsSqm:0,linenSets:0,extraHours:0});const d=emptyManualEstimate();d.lines=[{label:'Curățenie',amountBani:50000}];d.reason='Cost verificat';d.platformDiscountBani=options.discount??0;d.provider={amountBani:options.provider??Math.round(calcNetForFirm(500)*100),state:'confirmed',source:'Regula existentă',recordedAt:now.toISOString()};for(const c of COST_CODES)d.costs[c]={...d.costs[c],amountBani:0,state:'confirmed',source:'Sursă cost',recordedAt:now.toISOString()};saveManualEstimate(db,{id,revision:0,assessmentVersion:1,definition:d},'admin');const o=publishManualOffer(db,{id,revision:1,scope:'Curățenie generală conform evaluării.',expiresAt:'2026-10-02T06:00:00Z',reason:'Publicare',policyRevision:1,exceptionReason:'Test'},'admin');if(options.accepted!==false)decideManualOffer(db,'c',{id:o.id,action:'accept',confirmed:true,totalBani:o.terms.totalBani});return o;}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(now);for(const flag of ['NITIDO_MANUAL_OFFERS_SANDBOX','NITIDO_MANUAL_OFFER_BOOKING_SANDBOX','NITIDO_MANAGED_PRICING_SANDBOX'])vi.stubEnv(flag,'true');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro');vi.stubEnv('STRIPE_SECRET_KEY','');state.user='c';state.actor='verified-admin';state.audit.mockReset();state.db=new Database(':memory:');state.db.pragma('foreign_keys=ON');initializeDatabase(state.db);state.db.exec("INSERT INTO users(id,role,name,credit_balance) VALUES('c','client','Test',20),('other','client','Other',0)");saveMarginPolicy(state.db,{revision:0,minBani:0,minBasisPoints:null,reason:'Test'},'admin');});
afterEach(()=>{state.db?.close();vi.useRealTimers();vi.unstubAllEnvs();});
describe('accepted manual offer through existing booking route',()=>{
 it('freezes accepted terms without recalculating price or consuming wallet credit',async()=>{const o=offer(),r=await POST(req({...data,manualOfferId:o.id,expectedPriceGross:1,details:'Forged scope'}));expect(r.status).toBe(201);const {job}=await r.json();expect(job.price_gross).toBe(500);expect(job.credit_applied).toBe(0);expect(job.details).toBe(o.terms.scope);expect(JSON.parse(job.pricing_snapshot).terms).toEqual(o.terms);expect(state.db!.prepare("SELECT credit_balance FROM users WHERE id='c'").get()).toEqual({credit_balance:20});const split=calculatePaymentSplit(job.price_gross,job.credit_applied);expect(split.clientAmount*100).toBe(o.terms.totalBani);expect(split.firmAmount).toBe(calcNetForFirm(500));expect(state.db!.prepare('SELECT * FROM payments').all()).toEqual([]);});
 it('creates one job and one event across retries, including after offer expiry',async()=>{const o=offer(),r=await POST(req({...data,manualOfferId:o.id}));const {job}=await r.json();vi.setSystemTime(new Date('2026-10-10T06:00:00Z'));const replay=await POST(req({...data,manualOfferId:o.id},'another-key'));expect(replay.status).toBe(200);expect(await replay.json()).toMatchObject({job:{id:job.id},replayed:true});expect(state.db!.prepare('SELECT count(*) n FROM jobs').get()).toEqual({n:1});expect(state.db!.prepare("SELECT count(*) n FROM assessment_offer_events WHERE action='booking_created'").get()).toEqual({n:1});});
 it('blocks unaccepted, foreign and changed context without jobs',async()=>{const unaccepted=offer({accepted:false});expect((await POST(req({...data,manualOfferId:unaccepted.id}))).status).toBe(409);const o=offer();state.user='other';expect((await POST(req({...data,manualOfferId:o.id}))).status).toBe(404);state.user='c';expect((await POST(req({...data,manualOfferId:o.id,sqm:81}))).status).toBe(409);state.db!.prepare('UPDATE service_assessments SET version=2 WHERE id=?').run(o.assessmentId);expect((await POST(req({...data,manualOfferId:o.id}))).status).toBe(409);expect(state.db!.prepare('SELECT * FROM jobs').all()).toEqual([]);});
 it.each([{discount:1000},{provider:10000},{category:'moving'}])('rejects an incompatible offer %j',async options=>{const o=offer(options);expect((await POST(req({...data,manualOfferId:o.id,confirmedManualTotalBani:o.terms.totalBani}))).status).toBe(422);expect(state.db!.prepare('SELECT * FROM jobs').all()).toEqual([]);});
 it.each([{quoteId:'other'},{mode:'standard'},{express60:true},{propertyId:'property'},{whenType:'scheduled'},{hostEventId:'event'}])('rejects combined or unsupported booking modes %j',async patch=>{const o=offer();expect((await POST(req({...data,manualOfferId:o.id,...patch}))).status).toBe(422);});
 it('requires explicit booking confirmation and exact total',async()=>{const o=offer();for(const patch of [{manualBookingConfirmed:false},{confirmedManualTotalBani:49999}])expect((await POST(req({...data,manualOfferId:o.id,...patch}))).status).toBe(409);});
 it('keeps separate accepted offers independent of a reused HTTP idempotency key',async()=>{for(const o of [offer(),offer()])expect((await POST(req({...data,manualOfferId:o.id},'same'))).status).toBe(201);expect(state.db!.prepare('SELECT count(*) n FROM jobs').get()).toEqual({n:2});});
 it('rolls back job, link and event when linking fails',async()=>{const o=offer();state.db!.exec("CREATE TRIGGER injected_failure BEFORE INSERT ON assessment_offer_jobs BEGIN SELECT RAISE(ABORT,'link failure'); END;");await expect(POST(req({...data,manualOfferId:o.id}))).rejects.toThrow('link failure');expect(state.db!.prepare('SELECT * FROM jobs').all()).toEqual([]);expect(state.db!.prepare("SELECT * FROM assessment_offer_events WHERE action='booking_created'").all()).toEqual([]);});
 it('requires the separate sandbox activation and leaves other booking paths intact',async()=>{const o=offer();vi.stubEnv('NITIDO_MANUAL_OFFER_BOOKING_SANDBOX','false');expect((await POST(req({...data,manualOfferId:o.id}))).status).toBe(403);});
 it('retains immutable offer-job linkage',async()=>{const o=offer();await POST(req({...data,manualOfferId:o.id}));expect(compatibleManualOffer(state.db!,'c',o.id).jobId).toBeTruthy();expect(()=>state.db!.exec('DELETE FROM assessment_offer_jobs')).toThrow(/retained/);expect(()=>state.db!.exec("UPDATE assessment_offer_jobs SET client_id='other'")).toThrow(/immutable/);});
});

const scheduleInput=(id:string,patch:Record<string,unknown>={})=>({id,revision:0,action:'propose',scheduledDate:'2026-10-03',scheduledHour:10,expiresAt:'2026-10-02T12:00:00Z',reason:'Private operational reason',...patch});
const scheduleReq=(body:unknown,origin?:string)=>new NextRequest('https://sandbox.nitido.ro/api/assessments/schedule',{method:'POST',headers:origin?{Origin:origin}:{},body:JSON.stringify(body)});
const scheduledData=(id:string,patch:Record<string,unknown>={})=>({...data,manualOfferId:id,whenType:'scheduled',scheduledDate:'2026-10-03',scheduledHour:10,manualScheduleRevision:1,...patch});
describe('assisted schedule through admin and booking APIs',()=>{
 it('creates the exact Romanian slot and freezes the approved revision without internal notes',async()=>{
  const o=offer();expect((await proposeSchedule(scheduleReq(scheduleInput(o.id)))).status).toBe(200);
  const r=await POST(req(scheduledData(o.id)));expect(r.status).toBe(201);const {job}=await r.json();
  expect(job.scheduled_at).toBe('2026-10-03T07:00:00.000Z');expect(job.when_type).toBe('scheduled');expect(job.price_gross).toBe(500);
  expect(JSON.parse(job.pricing_snapshot).schedule).toMatchObject({revision:1,starts_at:job.scheduled_at});expect(job.pricing_snapshot).not.toMatch(/Private operational|verified-admin/);
  expect(state.db!.prepare('SELECT * FROM payments').all()).toEqual([]);
 });
 it('rejects stale or altered slot confirmations and never falls back to asap',async()=>{
  const o=offer();await proposeSchedule(scheduleReq(scheduleInput(o.id)));
  for(const patch of [{manualScheduleRevision:0},{scheduledHour:12},{scheduledDate:'2026-10-04'},{whenType:'asap'}])expect((await POST(req(scheduledData(o.id,patch)))).status).toBe(409);
  await proposeSchedule(scheduleReq(scheduleInput(o.id,{revision:1,scheduledHour:12})));
  expect((await POST(req(scheduledData(o.id)))).status).toBe(409);expect(state.db!.prepare('SELECT * FROM jobs').all()).toHaveLength(0);
 });
 it('expires exactly at the deadline and requires a fresh operator proposal',async()=>{
  const o=offer();await proposeSchedule(scheduleReq(scheduleInput(o.id)));vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
  expect((await POST(req(scheduledData(o.id)))).status).toBe(409);
  expect((await POST(req({...data,manualOfferId:o.id}))).status).toBe(409);
 });
 it('withdraws without rewriting history and permits explicit asap after withdrawal',async()=>{
  const o=offer();await proposeSchedule(scheduleReq(scheduleInput(o.id)));expect((await proposeSchedule(scheduleReq(scheduleInput(o.id,{revision:1,action:'withdraw'})))).status).toBe(200);
  expect((await POST(req(scheduledData(o.id)))).status).toBe(422);
  expect((await POST(req({...data,manualOfferId:o.id}))).status).toBe(201);
  expect(state.db!.prepare('SELECT * FROM assessment_offer_schedules').all()).toHaveLength(2);
 });
 it('preserves one booking on retry after expiry and blocks later operator changes',async()=>{
  const o=offer();await proposeSchedule(scheduleReq(scheduleInput(o.id)));const first=await (await POST(req(scheduledData(o.id)))).json();vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
  const repeat=await POST(req(scheduledData(o.id)));expect(repeat.status).toBe(200);expect(await repeat.json()).toMatchObject({job:{id:first.job.id},replayed:true});
  expect((await proposeSchedule(scheduleReq(scheduleInput(o.id,{revision:1,action:'withdraw'})))).status).toBe(409);
  expect(state.db!.prepare('SELECT * FROM jobs').all()).toHaveLength(1);
 });
 it('rolls back the proposal when audit fails and rejects concurrent stale revisions',async()=>{
  const o=offer();state.audit.mockImplementation(()=>{throw Error('audit failure');});expect((await proposeSchedule(scheduleReq(scheduleInput(o.id)))).status).toBe(500);expect(latestOfferSchedule(state.db!,o.id)).toBeNull();
  state.audit.mockReset();expect((await proposeSchedule(scheduleReq(scheduleInput(o.id)))).status).toBe(200);
  expect((await proposeSchedule(scheduleReq(scheduleInput(o.id)))).status).toBe(409);
 });
 it.each([{scheduledDate:'2026-02-30'},{scheduledDate:'2026-10-03T00:00:00Z'},{scheduledHour:9},{expiresAt:'2026-10-03T12:00:00Z'},{expiresAt:'2026-02-30T12:00:00Z'},{expiresAt:'2026-10-02T12:00:00'},{reason:''}])('rejects invalid operational input %j',async patch=>{
  const o=offer();expect((await proposeSchedule(scheduleReq(scheduleInput(o.id,patch)))).status).toBe(400);
 });
 it('uses Bucharest winter offset, independently of server timezone',async()=>{
  const o=offer();const r=await proposeSchedule(scheduleReq(scheduleInput(o.id,{scheduledDate:'2026-11-01'})));expect(r.status).toBe(200);expect((await r.json()).schedule.starts_at).toBe('2026-11-01T08:00:00.000Z');
 });
 it('protects owner reads and administrative writes, with no private note in client projection',async()=>{
  const o=offer();await proposeSchedule(scheduleReq(scheduleInput(o.id,{actor:'forged'})));
  const url=`https://sandbox.nitido.ro/api/assessments/schedule?id=${o.id}`;
  const client=await readSchedule(new NextRequest(url));expect(client.status).toBe(200);expect(client.headers.get('Cache-Control')).toBe('private, no-store');expect(await client.text()).not.toMatch(/Private operational|verified-admin|forged/);
  const admin=await readSchedule(new NextRequest(url+'&admin=true'));expect(await admin.json()).toMatchObject({schedule:{actor_id:'verified-admin'}});
  state.user='other';expect((await readSchedule(new NextRequest(url))).status).toBe(404);
  state.actor=null;expect((await readSchedule(new NextRequest(url+'&admin=true'))).status).toBe(401);expect((await proposeSchedule(scheduleReq(scheduleInput(o.id)))).status).toBe(401);
 });
 it('blocks CSRF, disabled activation and malformed input',async()=>{
  const o=offer();expect((await proposeSchedule(scheduleReq(scheduleInput(o.id),'https://attacker.example'))).status).toBe(403);
  expect((await proposeSchedule(scheduleReq('x'.repeat(5001)))).status).toBe(413);expect((await proposeSchedule(scheduleReq([]))).status).toBe(400);
  vi.stubEnv('NITIDO_MANUAL_OFFER_BOOKING_SANDBOX','false');expect((await proposeSchedule(scheduleReq(scheduleInput(o.id)))).status).toBe(403);
 });
 it('retains immutable proposals and does not enable incompatible financial offers',async()=>{
  const bad=offer({discount:1000});expect((await proposeSchedule(scheduleReq(scheduleInput(bad.id)))).status).toBe(422);
  const o=offer();await proposeSchedule(scheduleReq(scheduleInput(o.id)));expect(()=>state.db!.exec('DELETE FROM assessment_offer_schedules')).toThrow(/retained/);expect(()=>state.db!.exec("UPDATE assessment_offer_schedules SET scheduled_hour=12")).toThrow(/immutable/);
 });
});

it('blocks a new assisted booking without linking the offer, and freezes its actual service checklist after release',async()=>{
 const o=offer();state.db!.exec("INSERT INTO customer_restrictions VALUES('c',1,1,0,'Test','admin','2026-10-01')");
 expect((await POST(req({...data,manualOfferId:o.id}))).status).toBe(403);
 expect(state.db!.prepare('SELECT * FROM assessment_offer_jobs').all()).toEqual([]);
 state.db!.exec("INSERT INTO customer_restrictions VALUES('c',2,0,0,'Resolved','admin','2026-10-01')");
 state.db!.transaction(()=>saveExecutionTemplate(state.db!,{scope:'general',revision:0,items:[{key:'custom',label:'Verificare serviciu general'}],reason:'Test'},'admin')).immediate();
 const result=await POST(req({...data,manualOfferId:o.id}));expect(result.status).toBe(201);const job=(await result.json()).job;
 expect(jobExecutionRules(state.db!,job.id)).toMatchObject({scope:'general',revision:1,items:[{key:'custom',label:'Verificare serviciu general'}]});
});
