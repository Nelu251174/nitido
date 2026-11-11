import {beforeEach,afterEach,it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {SCHEMA_SQL} from './db';
import {persistSignup,signupInputError,signupEmailInUse,type SignupRecords} from './signupPersistence';
let db:Database.Database;
beforeEach(()=>{db=new Database(':memory:');db.exec(SCHEMA_SQL);db.exec("INSERT INTO users(id,role,name,referral_code,credit_balance) VALUES('ref','client','Ref','REF',10)")});afterEach(()=>db.close());
const input=():SignupRecords=>({userId:'new',role:'firma',name:'Firma',email:'new@example.com',phone:'+40722111222',passwordHash:'hash',referralCode:'NEW',referrer:{id:'ref',code:'REF'},bonus:20,firm:{id:'firm',cui:'123',city:'București',citiesExtra:null,verified:false}});
it('creates all records and applies the bonus once',()=>{persistSignup(db,input());expect(db.prepare("SELECT credit_balance FROM users WHERE id='ref'").get()).toEqual({credit_balance:30});expect(db.prepare("SELECT verified FROM firms WHERE id='firm'").get()).toEqual({verified:0});expect(()=>persistSignup(db,input())).toThrow();expect(db.prepare("SELECT credit_balance FROM users WHERE id='ref'").get()).toEqual({credit_balance:30})});
it('rolls back the user and referral bonus when firm creation fails',()=>{db.exec("CREATE TRIGGER reject_firm BEFORE INSERT ON firms BEGIN SELECT RAISE(ABORT,'injected failure'); END");expect(()=>persistSignup(db,input())).toThrow();expect(db.prepare("SELECT id FROM users WHERE id='new'").get()).toBeUndefined();expect(db.prepare("SELECT credit_balance FROM users WHERE id='ref'").get()).toEqual({credit_balance:10})});
it('rolls back when the referrer no longer matches',()=>{const value=input();value.referrer!.code='CHANGED';expect(()=>persistSignup(db,value)).toThrow();expect(db.prepare("SELECT id FROM users WHERE id='new'").get()).toBeUndefined()});
it('requires firm records only for a firm role',()=>{const value=input();delete value.firm;expect(()=>persistSignup(db,value)).toThrow();value.role='client';persistSignup(db,value);expect(db.prepare('SELECT COUNT(*) n FROM firms').get()).toEqual({n:0})});
it('rejects malformed shapes and values without calling string methods on them',()=>{const valid={name:'Nelu',email:'n@example.com',password:'validpass123',phone:'0722111222',role:'client'};expect(signupInputError(valid)).toBeNull();for(const value of [null,[],42,{...valid,email:{}},{...valid,password:123},{...valid,referralCode:[]},{...valid,email:'invalid'},{...valid,name:' '.repeat(5)},{...valid,password:'x'.repeat(1025)}])expect(signupInputError(value)).not.toBeNull()});

it('re-registers a removed email as a separate identity while retaining its contact and history',()=>{
 const old={...input(),role:'client' as const,firm:undefined,referrer:null};persistSignup(db,old);
 db.exec("CREATE TABLE admin_removed_accounts(user_id TEXT PRIMARY KEY REFERENCES users(id),kind TEXT,target_id TEXT); INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status) VALUES('old-job','new','Synthetic street','Constanța',40,'apartament','scheduled',100,180,'completed')");
 db.prepare("INSERT INTO admin_removed_accounts VALUES(?,'client',?)").run(old.userId,old.userId);
 db.prepare('UPDATE users SET credit_balance=77 WHERE id=?').run(old.userId);
 expect(signupEmailInUse(db,'  NEW@example.com  ')).toBe(false);
 const replacement={...old,userId:'replacement',email:'NEW@example.com',referralCode:'REPLACEMENT',passwordHash:'new-password'};persistSignup(db,replacement);
 expect(db.prepare('SELECT email,credit_balance FROM users WHERE id=?').get(old.userId)).toEqual({email:null,credit_balance:77});
 expect(db.prepare('SELECT email,credit_balance,password_hash FROM users WHERE id=?').get(replacement.userId)).toEqual({email:'NEW@example.com',credit_balance:0,password_hash:'new-password'});
 expect(db.prepare('SELECT email FROM admin_removed_account_emails WHERE user_id=?').get(old.userId)).toEqual({email:old.email});
 expect(db.prepare('SELECT client_id FROM jobs WHERE id=?').get('old-job')).toEqual({client_id:old.userId});
 expect(db.prepare('SELECT user_id FROM admin_removed_accounts').get()).toEqual({user_id:old.userId});
 expect(signupEmailInUse(db,'new@example.com')).toBe(true);
 expect(()=>db.prepare('DELETE FROM admin_removed_account_emails WHERE user_id=?').run(old.userId)).toThrow('Removed contact history is retained');
});
it('rolls back email release and contact archiving if replacement creation fails',()=>{
 const old={...input(),role:'client' as const,firm:undefined,referrer:null};persistSignup(db,old);
 db.exec("CREATE TABLE admin_removed_accounts(user_id TEXT PRIMARY KEY REFERENCES users(id),kind TEXT,target_id TEXT); CREATE TRIGGER reject_replacement BEFORE INSERT ON users WHEN NEW.id='replacement' BEGIN SELECT RAISE(ABORT,'synthetic failure');END");
 db.prepare("INSERT INTO admin_removed_accounts VALUES(?,'client',?)").run(old.userId,old.userId);
 expect(()=>persistSignup(db,{...old,userId:'replacement',referralCode:'REPLACEMENT'})).toThrow('synthetic failure');
 expect(db.prepare('SELECT email FROM users WHERE id=?').get(old.userId)).toEqual({email:old.email});
 expect(db.prepare('SELECT id FROM users WHERE id=?').get('replacement')).toBeUndefined();
 expect(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='admin_removed_account_emails'").get()).toBeUndefined();
});
it('does not release an active account email even during a concurrent case-insensitive collision',()=>{
 const old={...input(),role:'client' as const,firm:undefined,referrer:null};persistSignup(db,old);
 db.exec("CREATE TABLE admin_removed_accounts(user_id TEXT PRIMARY KEY REFERENCES users(id),kind TEXT,target_id TEXT)");
 expect(signupEmailInUse(db,'NEW@example.com')).toBe(true);
 expect(()=>persistSignup(db,{...old,userId:'replacement',email:'NEW@example.com',referralCode:'REPLACEMENT'})).toThrow('SIGNUP_EMAIL_IN_USE');
 expect(db.prepare('SELECT email FROM users WHERE id=?').get(old.userId)).toEqual({email:old.email});
});
