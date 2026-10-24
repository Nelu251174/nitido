// Owner-authorized release checkpoint. No app modules, payments or notifications.
const fs=require('node:fs/promises');
const {createReadStream}=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const Database=require('better-sqlite3');
const APP='/app';
const scope=({'https://nitido.ro':'live','https://sandbox.nitido.ro':'sandbox'})[process.env.NEXT_PUBLIC_SITE_URL];if(!scope)throw Error('WRONG_BACKUP_TARGET');
const BASE_COMMIT='31f5cd7a85379234fdea0177e813971cc63c33bd';
const DEST='/app/data/release-checkpoints/20261024-before-admin-password-reset-'+scope;
function report(v){const text=JSON.stringify({marker:'NITIDO_ADMIN_RESET_CHECKPOINT_20261024',scope,...v});console.log(text);require('node:fs').appendFileSync('/proc/1/fd/1',text+'\n');}
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
 try{const old=JSON.parse(await fs.readFile(path.join(DEST,'verification.json'),'utf8'));if(old.status==='passed'&&old.baseCommit===BASE_COMMIT){report({...old,reused:true});return;}}catch(e){if(e.code!=='ENOENT')throw e;}
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
 let buildId=null;try{buildId=(await fs.readFile(path.join(APP,'.next/BUILD_ID'),'utf8')).trim();}catch{}
 const inspectDb=new Database(snapshot,{readonly:true,fileMustExist:true});const schemaChecks={pro:!!inspectDb.prepare("SELECT 1 FROM sqlite_master WHERE name='pro_idempotency'").get(),bathrooms:inspectDb.prepare('PRAGMA table_info(jobs)').all().some(c=>c.name==='bathroom_count')};inspectDb.close();
 const result={schemaChanged:false,schemaChecks,status:'passed',createdAt:new Date().toISOString(),baseCommit:BASE_COMMIT,buildId,checkpointPath:DEST,method:'SQLite online backup; uploads byte hashes stable before and after database snapshot; isolated database restore verified',uploadFileCount:before.length,uploadBytes:before.reduce((n,f)=>n+f.size,0),snapshotSha256:await hash(snapshot),...data,storageLimit:'Persistent application data volume; protects release rollback, not off-host disaster recovery'};
 await fs.writeFile(path.join(DEST,'uploads-manifest.json'),JSON.stringify(before,null,2),{flag:'wx',mode:0o600});
 await fs.writeFile(path.join(DEST,'verification.json'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
 report(result);
})().catch(e=>{console.error(JSON.stringify({status:'failed',code:/^[A-Z_]+$/.test(e.message)?e.message:e.code||'CHECKPOINT_FAILED'}));process.exitCode=1;});
