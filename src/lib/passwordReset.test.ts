import {beforeEach,afterEach,describe,it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {SCHEMA_SQL} from './db';
import {createResetToken,applyPasswordReset,discardResetToken} from './passwordReset';
let db:Database.Database;
beforeEach(()=>{
 db=new Database(':memory:');db.exec(SCHEMA_SQL);
 for(const id of ['a','b']){
  db.prepare("INSERT INTO users(id,role,name,password_hash) VALUES(?,'client',?,'original')").run(id,id);
  db.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,?)").run(id,id,'2099-01-01');
 }
});
afterEach(()=>db.close());
const password=(id='a')=>db.prepare('SELECT password_hash FROM users WHERE id=?').get(id);
describe('atomic password recovery',()=>{
 it('updates only the owner and revokes every outstanding link and session',()=>{
  const first=createResetToken(db,'a'),second=createResetToken(db,'a'),other=createResetToken(db,'b');
  expect(applyPasswordReset(db,first,'new-hash')).toBe(true);
  expect(password()).toEqual({password_hash:'new-hash'});
  expect(password('b')).toEqual({password_hash:'original'});
  expect(db.prepare('SELECT id FROM sessions').all()).toEqual([{id:'b'}]);
  expect(applyPasswordReset(db,first,'replay')).toBe(false);
  expect(applyPasswordReset(db,second,'older-link')).toBe(false);
  expect(applyPasswordReset(db,other,'other-hash')).toBe(true);
 });
 it.each(['password','session','token'])('rolls back all changes if saving %s fails and allows retry',stage=>{
  const token=createResetToken(db,'a');
  const trigger=stage==='password'?'BEFORE UPDATE ON users':stage==='session'?'BEFORE DELETE ON sessions':'BEFORE UPDATE ON password_reset_tokens';
  db.exec(`CREATE TRIGGER fail_reset ${trigger} BEGIN SELECT RAISE(ABORT,'storage failed'); END;`);
  expect(()=>applyPasswordReset(db,token,'new-hash')).toThrow();
  expect(password()).toEqual({password_hash:'original'});
  expect(db.prepare("SELECT id FROM sessions WHERE user_id='a'").all()).toHaveLength(1);
  expect(db.prepare("SELECT used_at FROM password_reset_tokens WHERE user_id='a'").get()).toEqual({used_at:null});
  db.exec('DROP TRIGGER fail_reset');
  expect(applyPasswordReset(db,token,'new-hash')).toBe(true);
 });
 it.each(['2000-01-01T00:00:00Z','invalid'])('rejects expired or corrupt expiry %s without mutation',expiry=>{
  const token=createResetToken(db,'a');db.prepare('UPDATE password_reset_tokens SET expires_at=?').run(expiry);
  expect(applyPasswordReset(db,token,'new-hash')).toBe(false);
  expect(password()).toEqual({password_hash:'original'});
  expect(db.prepare('SELECT id FROM sessions').all()).toHaveLength(2);
 });
 it('discards only a failed attempt and preserves other links and consumed audit rows',()=>{
  const earlier=createResetToken(db,'a'),failed=createResetToken(db,'a'),other=createResetToken(db,'b');
  discardResetToken(db,failed);
  expect(applyPasswordReset(db,failed,'bad')).toBe(false);
  expect(applyPasswordReset(db,earlier,'good')).toBe(true);
  const before=db.prepare('SELECT COUNT(*) n FROM password_reset_tokens').get();
  discardResetToken(db,earlier);
  expect(db.prepare('SELECT COUNT(*) n FROM password_reset_tokens').get()).toEqual(before);
  expect(applyPasswordReset(db,other,'other')).toBe(true);
 });
 it('rejects an unknown token',()=>{expect(applyPasswordReset(db,'unknown','hash')).toBe(false);expect(password()).toEqual({password_hash:'original'})});
});
