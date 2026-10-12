import {beforeEach,afterEach,it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {initializeDatabase} from './db';
import {getDeletionRequest,requestAccountDeletion,reviewDeletionRequest,deletionQueue} from './accountDeletion';
let db:Database.Database;
beforeEach(()=>{db=new Database(':memory:');db.pragma('foreign_keys=ON');initializeDatabase(db);db.exec("INSERT INTO users(id,role,name,email) VALUES('c','client','Client','client@example.test'),('f','firma','Provider','provider@example.test'); INSERT INTO sessions(id,user_id,expires_at) VALUES('test-session','c','2099-01-01')");});
afterEach(()=>db.close());
it('journals client/provider requests once and never deletes accounts, sessions or financial data',()=>{
 const users=db.prepare('SELECT * FROM users').all(),sessions=db.prepare('SELECT * FROM sessions').all(),payments=db.prepare('SELECT * FROM payments').all();
 expect(getDeletionRequest(db,'c')).toBeNull();const first=requestAccountDeletion(db,'c');expect(first).toMatchObject({replayed:false,request:{status:'requested',revision:1}});expect(requestAccountDeletion(db,'c')).toEqual({...first,replayed:true});requestAccountDeletion(db,'f');
 expect(db.prepare('SELECT * FROM users').all()).toEqual(users);expect(db.prepare('SELECT * FROM sessions').all()).toEqual(sessions);expect(db.prepare('SELECT * FROM payments').all()).toEqual(payments);
 expect(db.prepare("SELECT action,details FROM admin_audit_log WHERE action='account.deletion_requested'").all()).toHaveLength(2);expect(JSON.parse((db.prepare("SELECT details FROM admin_audit_log WHERE target_id=?").get(first.request.id) as {details:string}).details)).toMatchObject({actorId:'c',actorType:'user'});
 expect(getDeletionRequest(db,'f')?.id).not.toBe(first.request.id);expect(()=>requestAccountDeletion(db,'unknown')).toThrow('inexistent');
});
it('rolls back the intake completely when its audit cannot be persisted',()=>{db.exec("CREATE TRIGGER reject_deletion_audit BEFORE INSERT ON admin_audit_log WHEN NEW.action='account.deletion_requested' BEGIN SELECT RAISE(ABORT,'Audit failed');END;");expect(()=>requestAccountDeletion(db,'c')).toThrow('Audit failed');expect(getDeletionRequest(db,'c')).toBeNull();expect(db.prepare('SELECT * FROM account_deletion_requests').all()).toEqual([]);expect(db.prepare('SELECT * FROM account_deletion_events').all()).toEqual([]);});
it('keeps immutable history, nominal ownership and review atomic; no fabricated fulfilled status',()=>{
 const {request}=requestAccountDeletion(db,'c'),command={id:request.id,revision:1,reason:'Preluare pentru verificarea procesării'};
 const review=reviewDeletionRequest(db,command,'verified-operator');expect(review).toMatchObject({replayed:false,request:{status:'under_review',revision:2}});expect(reviewDeletionRequest(db,command,'verified-operator')).toEqual({...review,replayed:true});expect(()=>reviewDeletionRequest(db,command,'other-operator')).toThrow('preluată');
 expect(requestAccountDeletion(db,'c').request.status).toBe('under_review');expect(db.prepare('SELECT * FROM account_deletion_events').all()).toHaveLength(2);expect(db.prepare("SELECT actor_id FROM account_deletion_events WHERE revision=2").get()).toEqual({actor_id:'verified-operator'});
 for(const sql of ['UPDATE account_deletion_events SET status=\'requested\'','DELETE FROM account_deletion_events','UPDATE account_deletion_requests SET user_id=\'f\'','DELETE FROM account_deletion_requests'])expect(()=>db.exec(sql)).toThrow('immutable');
 expect(()=>db.prepare("INSERT INTO account_deletion_events VALUES(?,3,'deleted','operator','admin','unsupported',?)").run(request.id,new Date().toISOString())).toThrow();
});
it('rolls back a review when audit fails and rejects stale/invalid commands',()=>{
 const {request}=requestAccountDeletion(db,'c');db.exec("CREATE TRIGGER reject_review BEFORE INSERT ON admin_audit_log WHEN NEW.action='account.deletion_review_started' BEGIN SELECT RAISE(ABORT,'Audit failed');END;");
 expect(()=>reviewDeletionRequest(db,{id:request.id,revision:1,reason:'Verified request'},'operator')).toThrow();expect(getDeletionRequest(db,'c')).toMatchObject({revision:1,status:'requested'});
 for(const value of [null,[],{id:request.id,revision:0,reason:'x'},{id:request.id,revision:1,reason:' '},{id:request.id,revision:1,reason:'x'.repeat(2001)}])expect(()=>reviewDeletionRequest(db,value,'operator')).toThrow();
 expect(()=>reviewDeletionRequest(db,{id:request.id,revision:2,reason:'x'},'operator')).toThrow('preluată');
});
it('paginates the entire intake without skipping pending/under-review and minimizes user data',()=>{
 requestAccountDeletion(db,'c');requestAccountDeletion(db,'f');db.transaction(()=>{for(let i=0;i<51;i++){db.prepare("INSERT INTO users(id,role,name,email) VALUES(?,'client',?,?)").run('extra'+i,'Name'+i,'extra'+i+'@example.test');requestAccountDeletion(db,'extra'+i);}})();
 const first=deletionQueue(db,0),second=deletionQueue(db,50);expect(first).toMatchObject({total:53,hasMore:true});expect(first.requests).toHaveLength(50);expect(second).toMatchObject({total:53,hasMore:false});expect(second.requests).toHaveLength(3);expect(new Set([...first.requests,...second.requests].map(r=>r.id)).size).toBe(53);
 expect(Object.keys(first.requests[0]).sort()).toEqual(['createdAt','email','id','name','revision','role','status','updatedAt','userId'].sort());for(const offset of [-1,0.1,1000001,NaN])expect(()=>deletionQueue(db,offset)).toThrow('Pagină');
});
