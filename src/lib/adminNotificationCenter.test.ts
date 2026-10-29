import {beforeEach,afterEach,it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {initializeDatabase} from './db';
import {persistSignup} from './signupPersistence';
import {ownerInbox,markOwnerEventsRead} from './adminOwnerEvents';
import {adminNotificationFeed,markAdminNotificationsRead} from './adminNotificationCenter';
let db:Database.Database;
beforeEach(()=>{db=new Database(':memory:');initializeDatabase(db);persistSignup(db,{userId:'fixture',role:'client',name:'Fixture Client',email:'fixture@example.test',phone:'+40722111222',passwordHash:'hash',referralCode:'FIXTURE',bonus:0,referrer:null});});
afterEach(()=>db.close());
it('collects registration and operational/payment notifications with safe direct links',()=>{
 db.prepare("INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,created_at) VALUES('j','fixture','Fixture','Constanța',40,'apartament','asap',100,60,?)").run(new Date().toISOString());
 db.prepare("INSERT INTO payments(id,job_id,amount_gross,commission_amount,amount_net,status) VALUES('p','j',100,10,90,'authorized')").run();
 const feed=adminNotificationFeed(db,'owner');expect(new Set(feed.items.map(i=>i.category))).toEqual(new Set(['registrations','operations','payments']));expect(feed.items.every(i=>i.href.startsWith('/admin'))).toBe(true);expect(feed.items.some(i=>i.description.includes('fixture@example.test'))).toBe(true);
});
it('shares read state with the registration inbox and preserves independent administrators',()=>{
 const item=adminNotificationFeed(db,'owner').items[0];markAdminNotificationsRead(db,'owner',[{id:item.id,revision:item.revision}]);expect(adminNotificationFeed(db,'owner').unread).toBe(0);expect(ownerInbox(db,'owner').unread).toBe(0);expect(adminNotificationFeed(db,'other').unread).toBe(1);
});
it('reflects registration reads made from the existing table',()=>{const event=ownerInbox(db,'owner').events[0];markOwnerEventsRead(db,[event.id],'owner');expect(adminNotificationFeed(db,'owner').unread).toBe(0);});
it('does not consume a notification that arrived after the displayed snapshot',()=>{
 const old=adminNotificationFeed(db,'owner').items[0];persistSignup(db,{userId:'second',role:'client',name:'Second',email:'second@example.test',phone:'+40722111223',passwordHash:'hash',referralCode:'SECOND',bonus:0,referrer:null});
 markAdminNotificationsRead(db,'owner',[{id:old.id,revision:old.revision}]);expect(adminNotificationFeed(db,'owner').unread).toBe(1);
});
it('makes a changed operational state unread again without unstable polling timestamps',()=>{
 db.prepare("INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes) VALUES('j','fixture','Fixture','Constanța',40,'apartament','asap',100,60)").run();
 const item=adminNotificationFeed(db,'owner').items.find(i=>i.title.startsWith('Lucrare'))!;markAdminNotificationsRead(db,'owner',[{id:item.id,revision:item.revision}]);expect(adminNotificationFeed(db,'owner').items.find(i=>i.id===item.id)?.read).toBe(true);db.prepare("UPDATE jobs SET status='cancelled' WHERE id='j'").run();expect(adminNotificationFeed(db,'owner').items.find(i=>i.id===item.id)?.read).toBe(false);
});
it('rejects stale, forged and caller-controlled items atomically',()=>{const item=adminNotificationFeed(db,'owner').items[0];expect(()=>markAdminNotificationsRead(db,'owner',[{id:item.id,revision:item.revision},{id:'a'.repeat(32),revision:'b'.repeat(32)}])).toThrow();expect(adminNotificationFeed(db,'owner').unread).toBe(1);expect(()=>markAdminNotificationsRead(db,'owner',[{...item,href:'https://foreign.test'}])).toThrow();expect(()=>adminNotificationFeed(db,'owner','unknown' as never)).toThrow();});
it('paginates and filters without lowering the total unread badge',()=>{for(let i=0;i<55;i++)db.prepare("INSERT INTO admin_owner_events(id,event_key,event_type,created_ms) VALUES(?,?,'SYSTEM_TEST',?)").run('owner_'+String(i).padStart(32,'0'),'event'+i,Date.now()+i);const first=adminNotificationFeed(db,'owner','registrations');expect(first.items).toHaveLength(50);expect(first.hasMore).toBe(true);expect(first.unread).toBe(56);expect(adminNotificationFeed(db,'owner','registrations',50).items).toHaveLength(6);expect(adminNotificationFeed(db,'owner','payments').unread).toBe(56);});
