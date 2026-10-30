import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import Database from 'better-sqlite3';
import {SCHEMA_SQL} from './db';
import {WORKSPACE_SCHEMA} from './workspace';
import {persistSignup} from './signupPersistence';
import {markOwnerEventsRead,ownerInbox,processOwnerEmails,queueOwnerRegistration,OWNER_EMAIL_RETRY_WINDOW_MS} from './adminOwnerEvents';
let db:Database.Database;const now=Date.parse('2026-10-15T08:00:00Z');
beforeEach(()=>{db=new Database(':memory:');db.pragma('foreign_keys=ON');db.exec(SCHEMA_SQL);db.exec(WORKSPACE_SCHEMA);vi.stubEnv('NITIDO_OWNER_NOTIFICATIONS_ENABLED','true');vi.stubEnv('NITIDO_OWNER_NOTIFICATION_EMAIL','owner@example.test');vi.stubEnv('RESEND_API_KEY','fixture');vi.stubEnv('RESEND_FROM','NITIDO <sender@example.test>');});
afterEach(()=>{db.close();vi.unstubAllEnvs();});
function signup(role:'client'|'firma'='client',country:string|null='RO',id='u'){
 return persistSignup(db,{userId:id,role,name:'<script>Test</script>',email:id+'@example.test',phone:'+40722111222',passwordHash:'hash',referralCode:'REF'+id,bonus:0,referrer:null,connectionCountry:country,...(role==='firma'?{firm:{id:'f'+id,cui:'123',city:'București',citiesExtra:null,verified:false}}:{})});
}
const row=(id:string)=>db.prepare('SELECT * FROM admin_owner_events WHERE id=?').get(id) as {email_status:string;attempt_count:number;payload_json:string;first_dispatch_ms:number};
it('queues one event atomically per real account, any origin, without raw IP',()=>{
 for(const [i,c] of ['RO','FR','ES','US',null].entries()){const id=signup(i%2?'firma':'client',c,String(i));queueOwnerRegistration(db,String(i),i%2?'firma':'client',c);expect(JSON.parse(row(id).payload_json)).toEqual({connectionCountry:c});}
 expect(ownerInbox(db,'a').unread).toBe(5);expect(()=>signup('client','RO','0')).toThrow();expect(ownerInbox(db,'a').unread).toBe(5);
});
it('rolls back the account if its outbox cannot be saved',()=>{db.exec("CREATE TRIGGER fail_alert BEFORE INSERT ON admin_owner_events BEGIN SELECT RAISE(ABORT,'failure');END");expect(()=>signup()).toThrow();expect(db.prepare("SELECT id FROM users WHERE id='u'").get()).toBeUndefined();});
it('does not queue anything when firm persistence fails',()=>{db.exec("CREATE TRIGGER fail_firm BEFORE INSERT ON firms BEGIN SELECT RAISE(ABORT,'failure');END");expect(()=>signup('firma')).toThrow();expect(ownerInbox(db,'a').events).toHaveLength(0);});
it('sends escaped account data once and marks provider acceptance accurately',async()=>{const id=signup();const sender=vi.fn<import('./adminOwnerEvents').OwnerSender>().mockResolvedValue({id:'provider-id'});const result=await processOwnerEmails(db,{sender,now:Date.now()});expect(result.accepted).toBe(1);expect(sender.mock.calls[0][0].html).toContain('&lt;script&gt;');expect(sender.mock.calls[0][0].to).toBe('owner@example.test');await processOwnerEmails(db,{sender});expect(sender).toHaveBeenCalledTimes(1);expect(row(id).email_status).toBe('sent');});
it.each([
 ['client',false,'Client privat'],
 ['client',true,'Client comercial (firmă)'],
 ['firma',false,'Firmă de curățenie'],
] as const)('notifies the selected owner once for %s with business=%s',async(role,business,type)=>{
 const id=signup(role);vi.stubEnv('NITIDO_OWNER_NOTIFICATION_EMAIL','nelutofan@gmail.com');
 db.prepare('UPDATE users SET name=?,is_business=?,company_name=? WHERE id=?').run('Test Înregistrare',business?1:0,business?'Birou <Test>':null,'u');
 db.prepare('UPDATE admin_owner_events SET created_ms=? WHERE id=?').run(now,id);
 const sender=vi.fn<import('./adminOwnerEvents').OwnerSender>().mockResolvedValue({id:'accepted'});
 expect((await processOwnerEmails(db,{sender})).accepted).toBe(1);
 const mail=sender.mock.calls[0][0];expect(mail.to).toBe('nelutofan@gmail.com');expect(mail.subject).toBe('Înscriere nouă pe NÍTIDO: Test Înregistrare');
 expect(ownerInbox(db,'admin').events[0].accountType).toBe(type);
 expect(mail.html).toContain(type);expect(mail.html).toContain('u@example.test');expect(mail.html).toContain('+40722111222');expect(mail.html).toContain('11:00:00');
 if(business)expect(mail.html).toContain('Birou &lt;Test&gt;');
 await processOwnerEmails(db,{sender});expect(sender).toHaveBeenCalledTimes(1);
});
it('keeps account names out of email header control sequences',async()=>{
 signup();db.prepare('UPDATE users SET name=? WHERE id=?').run('Test\r\nBcc: other@example.test','u');
 const sender=vi.fn<import('./adminOwnerEvents').OwnerSender>().mockResolvedValue({id:'accepted'});await processOwnerEmails(db,{sender});
 expect(sender.mock.calls[0][0].subject).not.toMatch(/[\r\n]/);expect(sender.mock.calls[0][0].to).toBe('owner@example.test');
});
it('retains alerts while email configuration is missing',async()=>{const id=signup();vi.stubEnv('NITIDO_OWNER_NOTIFICATION_EMAIL','');expect((await processOwnerEmails(db)).status).toBe('disabled');expect(row(id).attempt_count).toBe(0);});
it('retries unknown delivery with the same idempotency key and backoff',async()=>{const id=signup(),time=Date.now();const sender=vi.fn().mockResolvedValueOnce({error:'EMAIL_RESPONSE_UNKNOWN',retryable:true}).mockResolvedValueOnce({id:'accepted'});await processOwnerEmails(db,{sender,now:time});await processOwnerEmails(db,{sender,now:time+1000});expect(sender).toHaveBeenCalledTimes(1);await processOwnerEmails(db,{sender,now:time+60000});expect(sender.mock.calls[0][0]).toEqual(sender.mock.calls[1][0]);expect(row(id).email_status).toBe('sent');});
it('prevents concurrent requests from sending the same alert',async()=>{signup();let release!:()=>void;const pending=new Promise<void>(r=>{release=r;});const sender=vi.fn(async()=>{await pending;return {id:'accepted'};});const first=processOwnerEmails(db,{sender});await processOwnerEmails(db,{sender});release();await first;expect(sender).toHaveBeenCalledTimes(1);});
it('quarantines changes in recipient or account content after an uncertain attempt',async()=>{const id=signup(),time=Date.now();const sender=vi.fn(async()=>({error:'EMAIL_RESPONSE_UNKNOWN',retryable:true}));await processOwnerEmails(db,{sender,now:time});vi.stubEnv('NITIDO_OWNER_NOTIFICATION_EMAIL','changed@example.test');await processOwnerEmails(db,{sender,now:time+60000});expect(sender).toHaveBeenCalledTimes(1);expect(row(id).email_status).toBe('uncertain');});
it('does not retry outside the provider idempotency window',async()=>{const id=signup(),time=Date.now();const sender=vi.fn(async()=>({error:'EMAIL_RESPONSE_UNKNOWN',retryable:true}));await processOwnerEmails(db,{sender,now:time});await processOwnerEmails(db,{sender,now:time+OWNER_EMAIL_RETRY_WINDOW_MS});expect(sender).toHaveBeenCalledTimes(1);expect(row(id).email_status).toBe('uncertain');});
it('retains independent read state for each administrator',()=>{const id=signup();expect(markOwnerEventsRead(db,[id,id],'a',now).changed).toBe(1);expect(ownerInbox(db,'a').unread).toBe(0);expect(ownerInbox(db,'b').unread).toBe(1);expect(()=>markOwnerEventsRead(db,['injected'],'a')).toThrow();});
it('suppresses email if the account has been deleted',async()=>{const id=signup();db.prepare('DELETE FROM users WHERE id=?').run('u');const sender=vi.fn();await processOwnerEmails(db,{sender});expect(sender).not.toHaveBeenCalled();expect(row(id).email_status).toBe('suppressed');});

function property(id:string,owner:string,city:string,archived=0){
 db.prepare('INSERT INTO workspace_properties(id,owner_id,name,city,street,sqm,space_type,created_at,archived) VALUES(?,?,?,?,?,40,?,?,?)').run(id,owner,'Proprietate test',city,'Adresă sintetică','apartament',new Date(now).toISOString(),archived);
}
function booking(id:string,client:string,city:string){
 db.prepare("INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes) VALUES(?,?,?,?,40,'apartament','asap',10000,60)").run(id,client,'Adresă sintetică',city);
}
it('enriches historical registrations for all three account types with owned locations and explicit sources',()=>{
 const privateId=signup('client','FR','private'),businessId=signup('client','RO','business'),firmId=signup('firma','RO','firm');
 db.prepare('UPDATE users SET is_business=1 WHERE id=?').run('business');
 property('home','private',' Constanța ');property('office','business','Cluj-Napoca');
 const events=ownerInbox(db,'admin').events;
 expect(events.find(e=>e.id===privateId)).toMatchObject({accountType:'Client privat',city:'Constanța',citySource:'saved_properties',payload:{connectionCountry:'FR'}});
 expect(events.find(e=>e.id===businessId)).toMatchObject({accountType:'Client comercial (firmă)',city:'Cluj-Napoca',citySource:'saved_properties'});
 expect(events.find(e=>e.id===firmId)).toMatchObject({accountType:'Firmă de curățenie',city:'București',citySource:'firm_coverage'});
 expect(events.every(e=>e.read_ms===null&&e.email_status==='pending')).toBe(true);
});
it('deduplicates active property cities, falls back to owned bookings and never borrows another account location',()=>{
 const a=signup('client','RO','a'),b=signup('client','RO','b'),c=signup('client','FR','c');
 property('a1','a','Iași');property('a2','a',' Iași ');property('a3','a','Oradea');property('a4','a','Constanța',1);
 property('b1','b','',0);booking('b-job','b','Timișoara');booking('a-job','a','București');
 const events=ownerInbox(db,'admin').events;
 expect(events.find(e=>e.id===a)).toMatchObject({city:'Iași, Oradea',citySource:'saved_properties'});
 expect(events.find(e=>e.id===b)).toMatchObject({city:'Timișoara',citySource:'bookings'});
 expect(events.find(e=>e.id===c)).toMatchObject({city:null,citySource:null,payload:{connectionCountry:'FR'}});
});
it('does not infer city from a name, free-text business address, IP country or a system event',()=>{
 const id=signup('client','FR');db.prepare('UPDATE users SET name=?,is_business=1,company_address=? WHERE id=?').run('Client Iași','Strada București 10','u');
 db.prepare('INSERT INTO admin_owner_events(id,event_key,event_type,user_id,payload_json,created_ms) VALUES(?,?,?,?,?,?)').run('system-city','system-city','SYSTEM_TEST','u','{}',now);
 const events=ownerInbox(db,'admin').events;
 expect(events.find(e=>e.id===id)).toMatchObject({city:null,citySource:null});
 expect(events.find(e=>e.id==='system-city')).toMatchObject({accountType:null,city:null,citySource:null});
});
