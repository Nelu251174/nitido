const {test}=require('node:test'),assert=require('node:assert/strict'),Database=require('better-sqlite3'),fs=require('node:fs'),path=require('node:path');
const {activateNational,CODES}=require('./marketing-activate-national.cjs');
function fixture(){
 const db=new Database(':memory:');
 db.exec(`CREATE TABLE marketing_county_jobs(id TEXT PRIMARY KEY,county_code TEXT UNIQUE,position INTEGER,state TEXT DEFAULT 'queued',manifest TEXT DEFAULT '',part_cursor INTEGER DEFAULT 0,total INTEGER DEFAULT 0,message TEXT DEFAULT '',next_attempt_at TEXT,created_at TEXT,updated_at TEXT,created_by TEXT);
 CREATE TABLE marketing_county_dispatch(job_id TEXT PRIMARY KEY,independent INTEGER DEFAULT 0,last_turn INTEGER DEFAULT 0);
 CREATE TABLE admin_audit_log(id TEXT PRIMARY KEY,action TEXT,target_id TEXT,details TEXT);
 CREATE TABLE marketing_contacts(id TEXT,email TEXT,consent TEXT);INSERT INTO marketing_contacts VALUES('fixture','public@fixture.ro','withdrawn');
 CREATE TABLE marketing_county_items(id TEXT,job_id TEXT,status TEXT);INSERT INTO marketing_county_items VALUES('item','B','pending');`);
 for(const [position,code] of ['CT','B','BV','IF','CJ','IS','TM'].entries()){
  db.prepare("INSERT INTO marketing_county_jobs VALUES(?,?,?,'collecting','fixture-manifest',29,999,'existing message',?,'created','updated','owner')").run(code,code,position,code==='CT'?'2099-01-01T00:00:00Z':null);
  db.prepare('INSERT INTO marketing_county_dispatch VALUES(?,?,?)').run(code,code==='CT'?0:1,100+position);
 }
 return db;
}
test('canonical activation covers exactly all 41 counties and București, distinct from Ilfov',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/lib/adminMarketingRegions.ts'),'utf8');
 const canonical=[...source.split('].map')[0].matchAll(/\['([A-Z]{1,2})','/g)].map(m=>m[1]);
 assert.equal(CODES.length,42);assert.equal(new Set(CODES).size,42);assert.deepEqual([...CODES].sort(),canonical.sort());assert.ok(CODES.includes('B')&&CODES.includes('IF'));
});
test('adds 35 regions and independently activates all 42 without resetting existing progress, deadlines, order or contact data',()=>{
 const db=fixture(),jobs=db.prepare('SELECT * FROM marketing_county_jobs ORDER BY position').all(),turns=db.prepare('SELECT job_id,last_turn FROM marketing_county_dispatch ORDER BY job_id').all(),contacts=db.prepare('SELECT * FROM marketing_contacts').all(),items=db.prepare('SELECT * FROM marketing_county_items').all();
 const result=activateNational(db);assert.equal(result.created.length,35);assert.equal(result.regions,42);assert.deepEqual(result.held,[]);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM marketing_county_dispatch WHERE independent=1').get().n,42);
 assert.deepEqual(db.prepare('SELECT * FROM marketing_county_jobs WHERE position<7 ORDER BY position').all(),jobs);assert.deepEqual(db.prepare('SELECT job_id,last_turn FROM marketing_county_dispatch WHERE job_id IN (SELECT id FROM marketing_county_jobs WHERE position<7) ORDER BY job_id').all(),turns);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM marketing_county_jobs WHERE position>=7 AND state='queued' AND manifest='' AND part_cursor=0 AND total=0").get().n,35);
 assert.deepEqual(db.prepare('SELECT * FROM marketing_contacts').all(),contacts);assert.deepEqual(db.prepare('SELECT * FROM marketing_county_items').all(),items);db.close();
});
test('replay is idempotent and does not duplicate queue rows, audit records or reset a newly started region',()=>{
 const db=fixture();activateNational(db);db.prepare("UPDATE marketing_county_jobs SET state='importing',part_cursor=3,total=4321,message='progress' WHERE county_code='AB'").run();
 const before=db.prepare('SELECT * FROM marketing_county_jobs ORDER BY position').all(),audits=db.prepare('SELECT COUNT(*) n FROM admin_audit_log').get().n,result=activateNational(db);
 assert.deepEqual(result.created,[]);assert.deepEqual(result.activated,[]);assert.equal(result.alreadyActive.length,42);assert.deepEqual(db.prepare('SELECT * FROM marketing_county_jobs ORDER BY position').all(),before);assert.equal(db.prepare('SELECT COUNT(*) n FROM admin_audit_log').get().n,audits);db.close();
});
test('retains existing source pauses, review states, completion and deadlines while activating other regions',()=>{
 const db=fixture();db.prepare("UPDATE marketing_county_jobs SET state='paused' WHERE county_code='CT'").run();db.prepare("UPDATE marketing_county_jobs SET state='review' WHERE county_code='B'").run();db.prepare("UPDATE marketing_county_jobs SET state='completed' WHERE county_code='BV'").run();
 const prior=db.prepare("SELECT * FROM marketing_county_jobs WHERE county_code IN ('CT','B','BV') ORDER BY county_code").all(),result=activateNational(db);
 assert.deepEqual(result.held,[{county:'CT',state:'paused'},{county:'B',state:'review'},{county:'BV',state:'completed'}]);assert.deepEqual(db.prepare("SELECT * FROM marketing_county_jobs WHERE county_code IN ('CT','B','BV') ORDER BY county_code").all(),prior);assert.equal(result.created.length,35);db.close();
});
test('an invalid plan or audit failure rolls back the whole operation',()=>{
 for(const cause of ['unknown','audit']){
  const db=fixture();if(cause==='unknown')db.prepare("UPDATE marketing_county_jobs SET county_code='XX' WHERE county_code='CT'").run();else db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON admin_audit_log BEGIN SELECT RAISE(ABORT,'fixture failure');END");
  const before=db.prepare('SELECT * FROM marketing_county_jobs ORDER BY position').all();assert.throws(()=>activateNational(db));assert.deepEqual(db.prepare('SELECT * FROM marketing_county_jobs ORDER BY position').all(),before);assert.equal(db.prepare('SELECT COUNT(*) n FROM admin_audit_log').get().n,0);db.close();
 }
});
