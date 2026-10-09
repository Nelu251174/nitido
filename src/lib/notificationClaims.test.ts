import {describe,it,expect,vi,afterEach} from 'vitest';
import Database from 'better-sqlite3';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SCHEMA_SQL} from './db';
import {claimNotification,startNotificationDispatch,finishNotification,recoverNotificationClaims,NOTIFICATION_LEASE_MS,initializeNotificationClaims} from './notificationClaims';
import {processPushOutbox} from './push';
import {processSmsOutbox} from './notifications';

function setup(path=':memory:'){
 const db=new Database(path);db.exec(SCHEMA_SQL);
 db.exec(`INSERT INTO users(id,role,name,phone) VALUES('u','client','Client','0721000000');
 INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status) VALUES('j','u','Address','Constanta',55,'apartament','asap',400,120,'waiting');
 INSERT INTO notification_outbox(id,idempotency_key,event_type,job_id,recipient,message_body) VALUES('s','s','JOB_CREATED_FIRM_ALERT','j','+40721000000','Test');
 INSERT INTO push_notification_outbox(id,idempotency_key,event_type,job_id,recipient_user_id,title,message_body) VALUES('p','p','JOB_CREATED_FIRM_PUSH','j','u','Test','Test');`);
 return db;
}
afterEach(()=>vi.restoreAllMocks());
describe('durable notification claims',()=>{
 it.each(['push','sms'] as const)('recovers only pre-dispatch claims and fences old %s workers',channel=>{
  const db=setup(),id=channel==='push'?'p':'s',now=Date.now();
  const old=claimNotification(db,channel,id,now)!;
  expect(recoverNotificationClaims(db,now+NOTIFICATION_LEASE_MS-1)).toEqual({recovered:0,quarantined:0});
  expect(recoverNotificationClaims(db,now+NOTIFICATION_LEASE_MS)).toEqual({recovered:1,quarantined:0});
  const fresh=claimNotification(db,channel,id,now+NOTIFICATION_LEASE_MS)!;
  expect(fresh).not.toBe(old);
  expect(startNotificationDispatch(db,channel,id,old,now+NOTIFICATION_LEASE_MS)).toBe(false);
  expect(finishNotification(db,channel,id,old,{providerMessageId:'old'})).toBe(false);
  expect(startNotificationDispatch(db,channel,id,fresh,now+NOTIFICATION_LEASE_MS)).toBe(true);db.close();
 });
 it.each(['push','sms'] as const)('quarantines dispatched %s messages, accepts only the original late response',channel=>{
  const db=setup(),id=channel==='push'?'p':'s',now=Date.now(),token=claimNotification(db,channel,id,now)!;
  expect(startNotificationDispatch(db,channel,id,token,now)).toBe(true);
  expect(startNotificationDispatch(db,channel,id,token,now)).toBe(false);
  expect(recoverNotificationClaims(db,now+NOTIFICATION_LEASE_MS)).toEqual({recovered:0,quarantined:1});
  expect(claimNotification(db,channel,id)).toBeNull();
  expect(finishNotification(db,channel,id,'wrong',{providerMessageId:'wrong'})).toBe(false);
  expect(finishNotification(db,channel,id,token,{providerMessageId:'confirmed'})).toBe(true);
  expect(claimNotification(db,channel,id)).toBeNull();db.close();
 });
 it('retains claim evidence across restart and serializes recovery on two SQLite connections',()=>{
  const folder=mkdtempSync(join(tmpdir(),'nitido-notifications-')),file=join(folder,'db.sqlite');
  let db=setup(file);const now=Date.now(),token=claimNotification(db,'push','p',now)!;startNotificationDispatch(db,'push','p',token,now);db.close();
  db=new Database(file);const other=new Database(file);
  try{expect(recoverNotificationClaims(db,now+NOTIFICATION_LEASE_MS).quarantined).toBe(1);expect(recoverNotificationClaims(other,now+NOTIFICATION_LEASE_MS).quarantined).toBe(0);expect(claimNotification(other,'push','p')).toBeNull();}
  finally{other.close();db.close();rmSync(folder,{recursive:true,force:true});}
 });
 it('migrates without changing legacy rows and never assumes a legacy sending row was unsent',()=>{
  const db=setup();db.exec("DROP TABLE notification_delivery_claims; ALTER TABLE notification_outbox DROP COLUMN recipient_user_id; UPDATE notification_outbox SET status='sending',created_at='2020-01-01';");
  initializeNotificationClaims(db);initializeNotificationClaims(db);
  expect(db.prepare("SELECT recipient,message_body,recipient_user_id FROM notification_outbox WHERE id='s'").get()).toEqual({recipient:'+40721000000',message_body:'Test',recipient_user_id:null});
  expect(recoverNotificationClaims(db)).toEqual({recovered:0,quarantined:1});
  expect(db.prepare("SELECT status,last_error FROM notification_outbox WHERE id='s'").get()).toEqual({status:'failed',last_error:'DELIVERY_UNKNOWN'});db.close();
 });
 it('does not retry quarantined push or SMS through explicit or automatic batches',async()=>{
  const db=setup();db.exec("UPDATE notification_outbox SET status='failed',last_error='DELIVERY_UNKNOWN'; UPDATE push_notification_outbox SET status='failed',last_error='DELIVERY_UNKNOWN';");
  const sender=vi.fn(async()=>({providerMessageId:'never'}));
  await processPushOutbox(db,['p'],sender);await processPushOutbox(db,undefined,sender);await processSmsOutbox(db,['s'],sender);await processSmsOutbox(db,undefined,sender);
  expect(sender).not.toHaveBeenCalled();db.close();
 });
 it('never treats a missing provider receipt as delivered',()=>{
  const db=setup(),token=claimNotification(db,'sms','s')!;startNotificationDispatch(db,'sms','s',token);
  finishNotification(db,'sms','s',token,{providerMessageId:''});
  expect(db.prepare("SELECT status,last_error FROM notification_outbox WHERE id='s'").get()).toEqual({status:'failed',last_error:'DELIVERY_UNKNOWN'});db.close();
 });
});
