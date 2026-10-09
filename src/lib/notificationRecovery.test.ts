import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import Database from 'better-sqlite3';
import {SCHEMA_SQL} from './db';
import {runNotificationRecovery,notificationRecoveryConfigured} from './notificationRecovery';
import {processSmsOutbox,queueJobCreatedFirmAlerts} from './notifications';
import {sendSmsViaTwilio} from './sms';
vi.mock('./sms',async original=>({...await original<typeof import('./sms')>(),sendSmsViaTwilio:vi.fn(async()=>({providerMessageId:'SM-test'}))}));
let db:InstanceType<typeof Database>;
function queue(){return queueJobCreatedFirmAlerts(db,{id:'job',city:'Constanta',spaceType:'apartament',sqm:55,scheduledAt:null},['0722000000']);}
beforeEach(()=>{
 db=new Database(':memory:');db.exec(SCHEMA_SQL);db.exec(`INSERT INTO users(id,role,name,phone) VALUES('client','client','Client','0721000000'),('firm-user','firma','Firm','0722000000'),('other','firma','Other','0723000000');
 INSERT INTO firms(id,user_id,coverage_city,verified) VALUES('firm','firm-user','Constanta',1),('other','other','Constanta',1);
 INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status) VALUES('job','client','Private','Constanta',55,'apartament','asap',400,120,'waiting');`);
 vi.clearAllMocks();vi.stubEnv('PUSH_ENABLED','false');vi.stubEnv('SMS_FALLBACK_ENABLED','false');
});
afterEach(()=>{db.close();vi.unstubAllEnvs();});
describe('notification recovery and SMS eligibility',()=>{
 it('does not dispatch or consume attempts while channels are disabled',async()=>{
  queue();expect(await runNotificationRecovery(db)).toEqual({status:'completed',recovered:0,quarantined:0,pushSelected:0,smsSelected:0});
  expect(sendSmsViaTwilio).not.toHaveBeenCalled();expect(db.prepare('SELECT attempt_count FROM notification_outbox').get()).toEqual({attempt_count:0});
 });
 it('fences scheduler activation to the exact sandbox origin',()=>{
  vi.stubEnv('NITIDO_NOTIFICATION_RECOVERY_ENABLED','true');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://nitido.ro');expect(notificationRecoveryConfigured()).toBe(false);
  vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro');expect(notificationRecoveryConfigured()).toBe(true);
 });
 it.each([
  'UPDATE firms SET verified=0',
  "UPDATE firms SET suspended_until='2999-01-01'",
  "UPDATE jobs SET status='cancelled'",
  "INSERT INTO notification_preferences(user_id,new_job_alerts) VALUES('firm-user',0)",
  "UPDATE users SET phone='0724000000' WHERE id='firm-user'; UPDATE users SET phone='0722000000' WHERE id='other'",
  'UPDATE notification_outbox SET recipient_user_id=NULL',
 ])('suppresses stale SMS rather than sending to an ineligible or different user: %s',async change=>{
  const ids=queue();db.exec(change);await processSmsOutbox(db,ids);expect(sendSmsViaTwilio).not.toHaveBeenCalled();
  expect((db.prepare('SELECT last_error FROM notification_outbox').get() as {last_error:string}).last_error).toMatch(/^SUPPRESSED_/);
 });
 it('quarantines SMS timeouts and never retries the ambiguous provider call',async()=>{
  const ids=queue(),sender=vi.fn(async()=>{throw Error('network timeout with private details');});
  await processSmsOutbox(db,ids,sender);await processSmsOutbox(db,ids,sender);
  expect(sender).toHaveBeenCalledTimes(1);expect(db.prepare('SELECT last_error FROM notification_outbox').get()).toEqual({last_error:'DELIVERY_UNKNOWN'});
 });
 it('an empty SMS batch never dispatches the pending queue',async()=>{queue();await processSmsOutbox(db,[]);expect(sendSmsViaTwilio).not.toHaveBeenCalled();});
});
