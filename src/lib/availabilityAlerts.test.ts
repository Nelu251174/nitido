import {availabilityAlertDates} from './availabilityAlertDates';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import Database from 'better-sqlite3';
import {initializeDatabase} from './db';
import {attachAlertOrigin,subscribeAvailability,unsubscribeAvailability,queueAvailabilityAlerts,processAvailabilityAlerts,batchMatches,validateAlertCriteria} from './availabilityAlerts';
import {attachOpeningRequest,publishOpening,approveOpening,withdrawOpening} from './weeklyAvailability';
import {issueEmailVerification,confirmEmailVerification} from './emailVerification';
import {PushProviderError} from './pushProviders';
let db:Database.Database,slotId:string;
const input={city:'Constanța',spaceType:'apartament',sqm:80,bathroomCount:1,windowsSqm:0,fromDate:'2026-10-23',toDate:'2026-10-24',fromHour:8,toHour:20,consent:true,channels:['inapp']};
const count=(table:string)=>(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get() as {n:number}).n;
function offer(){slotId=publishOpening(db,'f',{teamId:'t',city:'Constanța',startsAt:'2026-10-23T05:00:00.000Z',endsAt:'2026-10-23T17:00:00.000Z',category:'general',requestKey:'actual'});approveOpening(db,slotId,'admin',true);}
function batch(){return (db.prepare('SELECT id FROM availability_alert_batches LIMIT 1').get() as {id:string}).id;}
function email(){vi.stubEnv('RESEND_API_KEY','synthetic');vi.stubEnv('RESEND_FROM','test@example.test');const verification=issueEmailVerification(db,'c');confirmEmailVerification(db,verification.token);}
function push(){vi.stubEnv('PUSH_ENABLED','true');for(const k of ['APNS_KEY_ID','APNS_TEAM_ID','APNS_PRIVATE_KEY','APNS_BUNDLE_ID'])vi.stubEnv(k,'synthetic');db.exec("INSERT INTO push_devices(id,user_id,platform,device_token) VALUES('d1','c','IOS','synthetic-1'),('d2','c','IOS','synthetic-2')");}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-22T06:00:00Z'));db=new Database(':memory:');db.pragma('foreign_keys=ON');initializeDatabase(db);db.exec(`INSERT INTO users(id,role,name,email) VALUES('c','client','Client','c@example.test'),('other','client','Other','o@example.test'),('fu','firma','Firm','f@example.test');
INSERT INTO firms(id,user_id,verified,coverage_city) VALUES('f','fu',1,'Constanța');INSERT INTO workspace_teams(id,firm_id,name,minimum_duration_minutes,travel_minutes) VALUES('t','f','Team',180,30);INSERT INTO service_catalog_firms(category_key,firm_id,enabled) VALUES('general','f',1);`)});
afterEach(()=>{db.close();vi.useRealTimers();vi.unstubAllEnvs()});
it('requires explicit consent, available channels and future bounded valid dates',()=>{
  expect(()=>subscribeAvailability(db,'c',{...input,consent:false})).toThrow(/explicit/);expect(()=>subscribeAvailability(db,'c',{...input,channels:['email']})).toThrow(/canal/);
  expect(()=>subscribeAvailability(db,'c',{...input,channels:[]})).toThrow();expect(()=>subscribeAvailability(db,'c',{...input,toDate:'2026-11-01'})).toThrow();
  expect(()=>validateAlertCriteria({...input,fromDate:'2026-02-30'})).toThrow();expect(()=>validateAlertCriteria({...input,fromDate:'2026-10-22',toDate:'2026-10-22',fromHour:6,toHour:7})).toThrow(/expirat/);
  expect(()=>validateAlertCriteria({...input,fromHour:20,toHour:8})).toThrow();
});
it('deduplicates criteria even with city normalization and can unsubscribe only its own alert',()=>{
  const id=subscribeAvailability(db,'c',input);expect(subscribeAvailability(db,'c',{...input,city:'constanta'})).toBe(id);expect(count('availability_subscriptions')).toBe(1);
  expect(()=>unsubscribeAvailability(db,'other',id)).toThrow();unsubscribeAvailability(db,'c',id);expect(queueAvailabilityAlerts(db).queued).toBe(0);
});
it('never invents capacity before provider publication and admin approval; no commercial writes',async()=>{
  subscribeAvailability(db,'c',input);expect(queueAvailabilityAlerts(db).queued).toBe(0);offer();expect(queueAvailabilityAlerts(db).queued).toBe(1);
  expect(count('jobs')).toBe(0);expect(count('payments')).toBe(0);expect(count('workspace_assignments')).toBe(0);
  await processAvailabilityAlerts(db);expect(count('workspace_notices')).toBe(1);await processAvailabilityAlerts(db);expect(count('workspace_notices')).toBe(1);
  expect(batchMatches(db,'other',batch())).toEqual([]);
});
it('checks service, complete duration, window, calendar and withdrawal again before dispatch',async()=>{
  subscribeAvailability(db,'c',{...input,fromHour:18,toHour:20});offer();expect(queueAvailabilityAlerts(db).queued).toBe(0);
  subscribeAvailability(db,'c',input);expect(queueAvailabilityAlerts(db).queued).toBe(1);withdrawOpening(db,'f',slotId);
  expect(batchMatches(db,'c',batch())).toEqual([]);await processAvailabilityAlerts(db);expect(count('workspace_notices')).toBe(0);
  expect(db.prepare('SELECT status FROM availability_alert_deliveries').get()).toEqual({status:'suppressed'});
});
it('groups multiple matching subscriptions into one notification event per client per day',async()=>{
  subscribeAvailability(db,'c',input);subscribeAvailability(db,'c',{...input,sqm:85});offer();await processAvailabilityAlerts(db);
  expect(count('availability_alert_batches')).toBe(1);expect(count('workspace_notices')).toBe(1);
  subscribeAvailability(db,'c',{...input,sqm:90});expect(queueAvailabilityAlerts(db).queued).toBe(0);
});
it('cancellation suppresses pending messages and removes a now-stale in-account notice',async()=>{
  const id=subscribeAvailability(db,'c',input);offer();queueAvailabilityAlerts(db);unsubscribeAvailability(db,'c',id);await processAvailabilityAlerts(db);expect(count('workspace_notices')).toBe(0);
  const other=subscribeAvailability(db,'other',input);await processAvailabilityAlerts(db);expect(count('workspace_notices')).toBe(1);unsubscribeAvailability(db,'other',other);expect(count('workspace_notices')).toBe(0);
});
it('keeps privacy in email, shares a daily batch across channels and uses a stable provider idempotency key',async()=>{
  email();subscribeAvailability(db,'c',{...input,channels:['email','inapp']});offer();const send=vi.fn(async()=>true);await processAvailabilityAlerts(db,{email:send});
  expect(send).toHaveBeenCalledTimes(1);expect(send.mock.calls[0]).toBeDefined();const arg=vi.mocked(send).mock.calls[0] as unknown as [{to:string;html:string;idempotencyKey:string}];
  expect(arg[0].idempotencyKey).toMatch(/^availability-/);expect(arg[0].html).toContain('/client/alerte-disponibilitate?batch=');expect(arg[0].html).not.toContain('Private');
  expect(count('availability_alert_batches')).toBe(1);expect(count('workspace_notices')).toBe(1);
});
it('rechecks unsubscribe and device revocation after an earlier async provider call',async()=>{
  push();const id=subscribeAvailability(db,'c',{...input,channels:['push']});offer();let resolve!:(v:{providerMessageId:string})=>void;
  const send=vi.fn(()=>new Promise<{providerMessageId:string}>(r=>{resolve=r}));const run=processAvailabilityAlerts(db,{push:send});expect(send).toHaveBeenCalledTimes(1);
  unsubscribeAvailability(db,'c',id);resolve({providerMessageId:'synthetic-receipt'});await run;expect(send).toHaveBeenCalledTimes(1);
  expect((db.prepare("SELECT COUNT(*) n FROM availability_alert_deliveries WHERE status='suppressed'").get() as {n:number}).n).toBe(1);
});
it('overlapping workers do not send twice; uncertain push delivery is quarantined rather than replayed',async()=>{
  push();db.exec("DELETE FROM push_devices WHERE id='d2'");subscribeAvailability(db,'c',{...input,channels:['push']});offer();let reject!:(e:Error)=>void;
  const send=vi.fn(()=>new Promise<{providerMessageId:string}>((_,r)=>{reject=r}));const first=processAvailabilityAlerts(db,{push:send});await processAvailabilityAlerts(db,{push:send});expect(send).toHaveBeenCalledTimes(1);
  reject(new Error('synthetic timeout'));await first;expect(db.prepare('SELECT status FROM availability_alert_deliveries').get()).toEqual({status:'unknown'});
  vi.advanceTimersByTime(6*60000);await processAvailabilityAlerts(db,{push:send});expect(send).toHaveBeenCalledTimes(1);
});
it('retries a known transient failure and stops when device notification permission is revoked',async()=>{
  push();db.exec("DELETE FROM push_devices WHERE id='d2'");subscribeAvailability(db,'c',{...input,channels:['push']});offer();const send=vi.fn(async()=>{throw new PushProviderError('FCM_TEMPORARY_FAILURE')});await processAvailabilityAlerts(db,{push:send});
  expect(db.prepare('SELECT status,attempts FROM availability_alert_deliveries').get()).toEqual({status:'failed',attempts:1});
  db.exec('UPDATE push_devices SET push_enabled=0');vi.advanceTimersByTime(6*60000);await processAvailabilityAlerts(db,{push:send});expect(send).toHaveBeenCalledTimes(1);
  expect(db.prepare('SELECT status FROM availability_alert_deliveries').get()).toEqual({status:'suppressed'});
});
it('expires subscriptions and obeys the emergency stop without dispatching',async()=>{
  subscribeAvailability(db,'c',input);offer();queueAvailabilityAlerts(db);vi.stubEnv('NITIDO_AVAILABILITY_ALERTS_ENABLED','false');await processAvailabilityAlerts(db);expect(count('workspace_notices')).toBe(0);
  vi.stubEnv('NITIDO_AVAILABILITY_ALERTS_ENABLED','true');vi.advanceTimersByTime(4*86400000);await processAvailabilityAlerts(db);expect(count('workspace_notices')).toBe(0);
  expect(db.prepare('SELECT active FROM availability_subscriptions').get()).toEqual({active:0});
});

it('uses seven civil days across Romania daylight saving change',()=>{expect(availabilityAlertDates(new Date('2026-10-24T21:30:00Z'))).toEqual({min:'2026-10-25',max:'2026-10-31'});vi.setSystemTime(new Date('2026-10-24T21:30:00Z'));expect(validateAlertCriteria({...input,fromDate:'2026-10-25',toDate:'2026-10-31'}).toDate).toBe('2026-10-31');});

it('attributes a request only to an owned live alert with matching scope and never counts it as paid',()=>{subscribeAvailability(db,'c',input);offer();queueAvailabilityAlerts(db);const b=batch(),match=batchMatches(db,'c',b)[0];db.prepare("INSERT INTO jobs(id,client_id,city,street,sqm,space_type,bathroom_count,windows_sqm,mode,when_type,scheduled_at,duration_minutes,buffer_minutes,price_gross,status) VALUES('j','c','Constanța','Synthetic',80,'apartament',1,0,'standard','scheduled',?,180,30,550,'waiting')").run(match.startsAt);attachOpeningRequest(db,'j','c',match.slotId,match.revision,match.startsAt);expect(()=>attachAlertOrigin(db,'j','other',b)).toThrow();attachAlertOrigin(db,'j','c',b);expect(count('job_availability_origins')).toBe(1);expect(count('payments')).toBe(0);});
