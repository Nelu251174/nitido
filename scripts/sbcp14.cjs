// Owner-authorized release checkpoint. No app modules, payments or notifications.
const fs=require('node:fs/promises');
const {createReadStream}=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const Database=require('better-sqlite3');
const APP='/app';
if(process.env.NEXT_PUBLIC_SITE_URL!=='https://sandbox.nitido.ro')throw Error('WRONG_PRODUCTION_TARGET');
const BASE_COMMIT='5933bbf2ac186afcb1d43577197b305fa2232383';
const DEST='/app/data/release-checkpoints/20261022-before-localization-sandbox';
const ROOTS=['public/uploads','data/uploads','data/pro-uploads'];
async function hash(file){const h=createHash('sha256');for await(const c of createReadStream(file))h.update(c);return h.digest('hex');}
async function inventory(){
 const entries=[];
 async function walk(relative){
  let list;try{list=await fs.readdir(path.join(APP,relative),{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return;throw e;}
  for(const e of list){const name=path.posix.join(relative,e.name);if(e.isSymbolicLink())throw Error('UNSAFE_UPLOAD_ENTRY');if(e.isDirectory())await walk(name);else if(e.isFile()){const file=path.join(APP,name),st=await fs.stat(file);entries.push({path:name,size:st.size,sha256:await hash(file)});}else throw Error('UNSAFE_UPLOAD_ENTRY');}
 }
 for(const root of ROOTS)await walk(root);
 return entries.sort((a,b)=>a.path.localeCompare(b.path));
}
function inspect(file){
 const db=new Database(file,{readonly:true,fileMustExist:true});
 try{
  if(db.pragma('integrity_check',{simple:true})!=='ok'||db.pragma('foreign_key_check').length)throw Error('SQLITE_INTEGRITY_FAILED');
  const jobs=db.prepare('SELECT status,COUNT(*) count FROM jobs GROUP BY status ORDER BY status').all();
  const payments=db.prepare('SELECT status,COUNT(*) count FROM payments GROUP BY status ORDER BY status').all();
  const protectedRows=db.prepare("SELECT id,status,price_gross,credit_applied,duration_minutes,buffer_minutes,pricing_snapshot,accepted_firm_id FROM jobs WHERE status IN ('accepted','arrived') ORDER BY id").all();
  return {jobs,payments,activeProtectedCount:protectedRows.length,activeProtectedSha256:createHash('sha256').update(JSON.stringify(protectedRows)).digest('hex')};
 }finally{db.close();}
}
(async()=>{
 try{const old=JSON.parse(await fs.readFile(path.join(DEST,'verification.json'),'utf8'));if(old.status==='passed'&&old.baseCommit===BASE_COMMIT){console.log(JSON.stringify({...old,reused:true}));return;}}catch(e){if(e.code!=='ENOENT')throw e;}
 const before=await inventory();const dbFile=path.join(APP,'data/nitido.db'),st=await fs.stat(dbFile),space=await fs.statfs(path.join(APP,'data'));
 const required=st.size*3+before.reduce((n,f)=>n+f.size,0)*2+64*1024*1024;
 if(Number(space.bavail)*Number(space.bsize)<required)throw Error('INSUFFICIENT_BACKUP_SPACE');
 await fs.mkdir(path.dirname(DEST),{recursive:true,mode:0o700});await fs.mkdir(DEST,{mode:0o700});
 await fs.mkdir(path.join(DEST,'data'),{mode:0o700});
 const snapshot=path.join(DEST,'data/nitido.db'),source=new Database(dbFile,{readonly:true,fileMustExist:true});
 try{await source.backup(snapshot);}finally{source.close();}
 await fs.chmod(snapshot,0o600);const data=inspect(snapshot);
 for(const entry of before){const target=path.join(DEST,entry.path);await fs.mkdir(path.dirname(target),{recursive:true,mode:0o700});await fs.copyFile(path.join(APP,entry.path),target,require('node:fs').constants.COPYFILE_EXCL);await fs.chmod(target,0o600);if(await hash(target)!==entry.sha256)throw Error('UPLOAD_COPY_CHANGED');}
 const after=await inventory();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('UPLOADS_CHANGED_DURING_CHECKPOINT');
 const restored=path.join(DEST,'isolated-restore.db');await fs.copyFile(snapshot,restored,require('node:fs').constants.COPYFILE_EXCL);await fs.chmod(restored,0o600);
 if(JSON.stringify(inspect(restored))!==JSON.stringify(data)||await hash(snapshot)!==await hash(restored))throw Error('RESTORE_VERIFICATION_FAILED');
 const additiveDb=new Database(restored);try{additiveDb.exec("\nCREATE TABLE IF NOT EXISTS appointment_reminders(\n id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,\n scheduled_at TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('24h','2h')),channel TEXT NOT NULL CHECK(channel IN ('inapp','push','email')),device_id TEXT NOT NULL DEFAULT '',\n status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_ms INTEGER NOT NULL DEFAULT 0,\n claim_token TEXT,claimed_ms INTEGER,dispatch_ms INTEGER,provider_id TEXT,last_error TEXT,created_ms INTEGER NOT NULL,\n UNIQUE(job_id,firm_id,scheduled_at,kind,channel,device_id)\n);\nCREATE INDEX IF NOT EXISTS appointment_reminders_due ON appointment_reminders(status,next_ms,created_ms);\nCREATE TABLE IF NOT EXISTS appointment_acknowledgments(\n job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,scheduled_at TEXT NOT NULL,\n user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,confirmed_at TEXT NOT NULL,PRIMARY KEY(job_id,firm_id,scheduled_at)\n);\n\nCREATE TABLE IF NOT EXISTS home_maintenance_plans(\n id TEXT PRIMARY KEY,client_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,property_id TEXT NOT NULL REFERENCES workspace_properties(id) ON DELETE CASCADE,\n year INTEGER NOT NULL,month INTEGER NOT NULL,windows_sqm INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,\n request_key TEXT NOT NULL,payload_hash TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(client_id,request_key));\n CREATE UNIQUE INDEX IF NOT EXISTS home_maintenance_one_month ON home_maintenance_plans(client_id,property_id,year,month) WHERE active=1;\n CREATE INDEX IF NOT EXISTS home_maintenance_plans_owner ON home_maintenance_plans(client_id,active,year,month);");for(const name of ['appointment_reminders','appointment_acknowledgments','home_maintenance_plans'])if(!additiveDb.prepare('SELECT 1 FROM sqlite_master WHERE type=? AND name=?').get('table',name))throw Error('ADDITIVE_SCHEMA_MISSING');}finally{additiveDb.close();}
 if(JSON.stringify(inspect(restored))!==JSON.stringify(data))throw Error('ADDITIVE_SCHEMA_CHANGED_PROTECTED_DATA');
 let buildId=null;try{buildId=(await fs.readFile(path.join(APP,'.next/BUILD_ID'),'utf8')).trim();}catch{}
 const inspectDb=new Database(snapshot,{readonly:true,fileMustExist:true});const schemaChecks={pro:!!inspectDb.prepare("SELECT 1 FROM sqlite_master WHERE name='pro_idempotency'").get(),bathrooms:inspectDb.prepare('PRAGMA table_info(jobs)').all().some(c=>c.name==='bathroom_count')};inspectDb.close();
 const result={additiveSchemaVerified:true,schemaChecks,status:'passed',createdAt:new Date().toISOString(),baseCommit:BASE_COMMIT,buildId,checkpointPath:DEST,method:'SQLite online backup; uploads byte hashes stable before and after database snapshot; isolated database restore verified',uploadFileCount:before.length,uploadBytes:before.reduce((n,f)=>n+f.size,0),snapshotSha256:await hash(snapshot),...data,storageLimit:'Persistent application data volume; protects release rollback, not off-host disaster recovery'};
 await fs.writeFile(path.join(DEST,'uploads-manifest.json'),JSON.stringify(before,null,2),{flag:'wx',mode:0o600});
 await fs.writeFile(path.join(DEST,'verification.json'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
 console.log(JSON.stringify(result));
})().catch(e=>{console.error(JSON.stringify({status:'failed',code:/^[A-Z_]+$/.test(e.message)?e.message:e.code||'CHECKPOINT_FAILED'}));process.exitCode=1;});
