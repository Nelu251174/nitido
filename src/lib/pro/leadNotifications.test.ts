import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import type {OwnerSender} from '../adminOwnerEvents';
import Database from 'better-sqlite3';
vi.mock('../adminOwnerEvents',()=>({ownerNotificationConfig:()=>({enabled:true,recipient:'ops@example.test',emailConfigured:true}),OWNER_EMAIL_RETRY_WINDOW_MS:23*3600000,sendOwnerEmail:vi.fn()}));
import {queueLeadNotification,processLeadNotifications} from './leadNotifications';
let db:Database.Database;
beforeEach(()=>{db=new Database(':memory:');db.exec('CREATE TABLE pro_idempotency(actor TEXT,key TEXT,request_hash TEXT,result_json TEXT,PRIMARY KEY(actor,key))');});
afterEach(()=>db.close());
it('queues once and delivers once to the configured operational recipient without private lead fields',async()=>{
 queueLeadNotification(db,'synthetic-ref');queueLeadNotification(db,'synthetic-ref');const sender=vi.fn<OwnerSender>(async()=>({id:'provider-id'}));
 await processLeadNotifications(db,{sender,now:1000});await processLeadNotifications(db,{sender,now:1001});expect(sender).toHaveBeenCalledTimes(1);expect(sender.mock.calls[0][0]).toMatchObject({to:'ops@example.test',idempotencyKey:'nitido-pro-lead-synthetic-ref'});expect(sender.mock.calls[0][0].html).toContain('/pro/operator');
});
it('retries an unknown provider result with the same idempotency key and stops outside its window',async()=>{
 queueLeadNotification(db,'retry-ref');const sender=vi.fn<OwnerSender>(async()=>({error:'EMAIL_RESPONSE_UNKNOWN',retryable:true}));
 await processLeadNotifications(db,{sender,now:1000});await processLeadNotifications(db,{sender,now:200000});expect(sender).toHaveBeenCalledTimes(2);expect(sender.mock.calls[0][0].idempotencyKey).toBe(sender.mock.calls[1][0].idempotencyKey);
 await processLeadNotifications(db,{sender,now:24*3600000});expect(sender).toHaveBeenCalledTimes(2);
});
it('claims only one delivery during concurrent dispatch and survives a sender exception',async()=>{
 queueLeadNotification(db,'concurrent-ref');const sender=vi.fn<OwnerSender>(async()=>{await Promise.resolve();throw Error('timeout')});
 await Promise.all([processLeadNotifications(db,{sender,now:1000}),processLeadNotifications(db,{sender,now:1000})]);expect(sender).toHaveBeenCalledTimes(1);
});
