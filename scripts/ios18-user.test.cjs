const {test}=require('node:test');
const assert=require('node:assert/strict');
const Database=require('better-sqlite3');
const bcrypt=require('bcryptjs');
const {applyReviewClient}=require('./ios18-user.cjs');
const hash=bcrypt.hashSync('Unit-test-only-password-18',12);
const input={e:'apple-review-ios18@nitido.ro',h:hash,p:null};
function fixture(){const d=new Database(':memory:');d.exec(`
CREATE TABLE users(id TEXT PRIMARY KEY,role TEXT,name TEXT,email TEXT UNIQUE,phone TEXT,password_hash TEXT,referral_code TEXT,credit_balance INTEGER DEFAULT 0);
CREATE TABLE sessions(id TEXT,user_id TEXT REFERENCES users(id));
CREATE TABLE firms(id TEXT);CREATE TABLE jobs(id TEXT);CREATE TABLE payments(id TEXT);
INSERT INTO users(id,role,name,email,password_hash,credit_balance) VALUES('normal','client','Owner','owner@example.test','unchanged',90);
INSERT INTO sessions VALUES('owner-session','normal');`);return d;}
test('creates only a zero-credit synthetic review client and leaves existing accounts/sessions unchanged',()=>{const d=fixture();try{const before=d.prepare('SELECT * FROM users WHERE id=?').get('normal');const result=applyReviewClient(d,input);assert.equal(result.created,true);const row=d.prepare('SELECT * FROM users WHERE email=?').get(input.e);assert.equal(row.role,'client');assert.equal(row.credit_balance,0);assert(bcrypt.compareSync('Unit-test-only-password-18',row.password_hash));assert.deepEqual(d.prepare('SELECT * FROM users WHERE id=?').get('normal'),before);assert.equal(d.prepare('SELECT COUNT(*) n FROM sessions').get().n,1);}finally{d.close();}});
test('refuses any other email before changing the database',()=>{const d=fixture();try{assert.throws(()=>applyReviewClient(d,{...input,e:'owner@example.test'}),/INVALID_REVIEW_SCOPE/);assert.equal(d.prepare('SELECT COUNT(*) n FROM users').get().n,1);}finally{d.close();}});
test('preserves an existing real account even if its email matches the reserved review address',()=>{const d=fixture();try{d.prepare('INSERT INTO users(id,role,name,email,password_hash) VALUES(?,?,?,?,?)').run('collision','client','Real person',input.e,'keep');assert.throws(()=>applyReviewClient(d,input),/PRESERVED/);assert.equal(d.prepare('SELECT password_hash FROM users WHERE id=?').get('collision').password_hash,'keep');}finally{d.close();}});
test('retry updates only the synthetic review account and invalidates only its sessions',()=>{const d=fixture();try{applyReviewClient(d,input);const row=d.prepare('SELECT id FROM users WHERE email=?').get(input.e);d.prepare('INSERT INTO sessions VALUES(?,?)').run('review-session',row.id);assert.equal(applyReviewClient(d,input).created,false);assert.deepEqual(d.prepare('SELECT id FROM sessions').all(),[{id:'owner-session'}]);assert.equal(d.prepare('SELECT COUNT(*) n FROM users').get().n,2);}finally{d.close();}});
