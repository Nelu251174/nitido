import Database from 'better-sqlite3';
import {mkdir,lstat,readdir,copyFile,chmod,writeFile,readFile,rename,rm,statfs,realpath} from 'node:fs/promises';
import {createReadStream,constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve,isAbsolute} from 'node:path';
import {isIP} from 'node:net';
import {spawn} from 'node:child_process';

export const TAG='nitido-offsite-v1';
const ROOTS=['public/uploads','data/uploads','data/pro-uploads'];
export class BackupError extends Error{constructor(code){super(code);this.code=code}}
const fail=code=>{throw new BackupError(code)};
const hash=async file=>{const h=createHash('sha256');for await(const b of createReadStream(file))h.update(b);return h.digest('hex')};
export function backupConfig(env,{allowLocalRepository=false}={}){
 if(env.NITIDO_OFFSITE_BACKUP_ENABLED!=='true')return {enabled:false};
 const scope=({'https://nitido.ro':'live','https://sandbox.nitido.ro':'sandbox'})[env.NEXT_PUBLIC_SITE_URL];if(!scope)fail('BACKUP_TARGET_INVALID');
 const repository=env.RESTIC_REPOSITORY;
 if(typeof repository!=='string'||!repository||repository.length>1000)fail('BACKUP_REPOSITORY_REQUIRED');
 let local=false,backend='s3',healthUrl=null;
 if(allowLocalRepository&&isAbsolute(repository))local=true;
 else {
  backend=repository.startsWith('rest:https://')?'rest':'s3';
  if(!repository.startsWith(backend+':https://'))fail('BACKUP_HTTPS_S3_REQUIRED');
  let u;try{u=new URL(repository.slice(backend.length+1))}catch{fail('BACKUP_REPOSITORY_INVALID')}
  const host=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.port&&u.port!=='443'||isIP(host)||host.includes(':')||!host.includes('.')||/(?:^|\.)(?:localhost|nitido\.ro|local|internal)$/.test(host))fail('BACKUP_EXTERNAL_HOST_REQUIRED');
  const expectedPath=backend==='rest'?new RegExp('^/nitido-'+scope+'/backup/?$'):new RegExp('^/[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]/nitido/'+scope+'/?$');
  if(u.pathname!==decodeURI(u.pathname)||!expectedPath.test(u.pathname))fail('BACKUP_DEDICATED_PREFIX_REQUIRED');
  if(backend==='rest'){if(env.RESTIC_REST_USERNAME!=='nitido-'+scope||!/^.{32,}$/.test(env.RESTIC_REST_PASSWORD??'')||!/^[a-f0-9]{64}$/.test(env.NITIDO_BACKUP_HEALTH_TOKEN??''))fail('BACKUP_REST_CREDENTIALS_REQUIRED');healthUrl=u.origin+'/_nitido-backup-health';}
  for(const k of backend==='s3'?['AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_DEFAULT_REGION']:[])if(typeof env[k]!=='string'||!env[k].trim())fail('BACKUP_STORAGE_CREDENTIALS_REQUIRED');
 }
 if(typeof env.RESTIC_PASSWORD!=='string'||env.RESTIC_PASSWORD.length<32)fail('BACKUP_ENCRYPTION_SECRET_REQUIRED');
 if(!/^[a-f0-9]{64}$/.test(env.NITIDO_OFFSITE_REPOSITORY_ID??''))fail('BACKUP_REPOSITORY_ID_REQUIRED');
 const timeout=Number(env.NITIDO_OFFSITE_TIMEOUT_SECONDS??21600);if(!Number.isSafeInteger(timeout)||timeout<60||timeout>86400)fail('BACKUP_TIMEOUT_INVALID');
 // Never forward unrelated application/financial credentials to the backup process.
 const childEnv=Object.fromEntries(['PATH','HOME','TMPDIR','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy','SSL_CERT_FILE','SSL_CERT_DIR','RESTIC_CACERT','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN','AWS_DEFAULT_REGION','RESTIC_REST_USERNAME','RESTIC_REST_PASSWORD'].filter(k=>env[k]!==undefined).map(k=>[k,env[k]]));
 Object.assign(childEnv,{RESTIC_REPOSITORY:repository,RESTIC_PASSWORD:env.RESTIC_PASSWORD});
 return {enabled:true,scope,host:'nitido-'+scope,local,backend,healthUrl,healthToken:env.NITIDO_BACKUP_HEALTH_TOKEN,repositoryId:env.NITIDO_OFFSITE_REPOSITORY_ID,timeoutMs:timeout*1000,childEnv};
}
async function directory(path){await mkdir(path,{recursive:true,mode:0o700});const s=await lstat(path);if(!s.isDirectory()||s.isSymbolicLink())fail('BACKUP_UNSAFE_DIRECTORY');await chmod(path,0o700)}
export async function backupLayout(appRoot){
 const root=resolve(appRoot);if(await realpath(root)!==root)fail('BACKUP_APP_SYMLINK');
 const data=join(root,'data');if(await realpath(data)!==data)fail('BACKUP_DATA_SYMLINK');
 const base=join(data,'offsite-backup');await directory(base);
 const stageParent=join(base,'stage'),restoreParent=join(base,'restore');await directory(stageParent);await directory(restoreParent);
 return {root,base,stage:join(stageParent,'current'),restore:join(restoreParent,'current'),status:join(base,'status.json'),lock:join(base,'runner.lock')};
}
async function newDirectory(path){try{const s=await lstat(path);if(!s.isDirectory()||s.isSymbolicLink())fail('BACKUP_UNSAFE_DIRECTORY');await rm(path,{recursive:true})}catch(e){if(e.code!=='ENOENT')throw e}await mkdir(path,{mode:0o700})}
async function inventory(root,paths=ROOTS){
 const entries=[];
 async function walk(relative){
  const full=join(root,relative);let s;try{s=await lstat(full)}catch(e){if(e.code==='ENOENT')return;throw e}
  if(s.isSymbolicLink())fail('BACKUP_UPLOAD_SYMLINK');
  if(s.isDirectory()){for(const name of (await readdir(full)).sort())await walk(relative+'/'+name)}
  else if(s.isFile())entries.push({path:relative,size:s.size,sha256:await hash(full)});
  else fail('BACKUP_UNSAFE_UPLOAD');
 }
 for(const path of paths)await walk(path);return entries.sort((a,b)=>a.path.localeCompare(b.path,'en'));
}
export function inspectDatabase(file){
 const db=new Database(file,{readonly:true,fileMustExist:true});try{
  if(db.pragma('integrity_check',{simple:true})!=='ok'||db.pragma('foreign_key_check').length)fail('BACKUP_SQLITE_INVALID');
  const schema=db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type,name").all();
  const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const counts=Object.fromEntries(tables.map(({name})=>[name,db.prepare('SELECT COUNT(*) FROM "'+name.replaceAll('"','""')+'"').pluck().get()]));
  return {schemaSha256:createHash('sha256').update(JSON.stringify(schema)).digest('hex'),counts};
 }finally{db.close()}
}
export async function prepareSnapshot(layout,{now=new Date(),afterSnapshot}={}){
 const before=await inventory(layout.root),dbPath=join(layout.root,'data/nitido.db'),dbStat=await lstat(dbPath);if(dbStat.isSymbolicLink()||!dbStat.isFile())fail('BACKUP_SQLITE_PATH_INVALID');const size=dbStat.size;
 const space=await statfs(layout.base),filesSize=before.reduce((n,f)=>n+f.size,0);
 if(Number(space.bavail)*Number(space.bsize)<size*3+filesSize*2+64*1024*1024)fail('BACKUP_INSUFFICIENT_SPACE');
 await newDirectory(layout.stage);await directory(join(layout.stage,'data'));
 const snapshot=join(layout.stage,'data/nitido.db'),source=new Database(dbPath,{readonly:true,fileMustExist:true});
 try{await source.backup(snapshot)}finally{source.close()}
 await chmod(snapshot,0o600);const database={...inspectDatabase(snapshot),sha256:await hash(snapshot)};
 if(afterSnapshot)await afterSnapshot();
 for(const entry of before){const target=join(layout.stage,entry.path);await directory(resolve(target,'..'));await copyFile(join(layout.root,entry.path),target,constants.COPYFILE_EXCL);await chmod(target,0o600);if(await hash(target)!==entry.sha256)fail('BACKUP_UPLOAD_CHANGED')}
 if(JSON.stringify(before)!==JSON.stringify(await inventory(layout.root)))fail('BACKUP_UPLOAD_SET_CHANGED');
 const manifest={format:1,createdAt:now.toISOString(),method:'SQLite online backup with stable upload inventories around snapshot/copy',database,uploads:before};
 await writeFile(join(layout.stage,'manifest.json'),JSON.stringify(manifest),{flag:'wx',mode:0o600});
 return manifest;
}
export async function verifyRestored(restored,expected){
 const s=await lstat(restored);if(s.isSymbolicLink()||!s.isDirectory())fail('BACKUP_RESTORE_PATH_INVALID');
 const manifestFile=join(restored,'manifest.json'),dbFile=join(restored,'data/nitido.db');
 for(const path of [manifestFile,dbFile]){const v=await lstat(path);if(v.isSymbolicLink()||!v.isFile())fail('BACKUP_RESTORE_PATH_INVALID')}
 if(await readFile(manifestFile,'utf8')!==JSON.stringify(expected))fail('BACKUP_MANIFEST_MISMATCH');
 if(await hash(dbFile)!==expected.database.sha256||JSON.stringify(inspectDatabase(dbFile))!==JSON.stringify({schemaSha256:expected.database.schemaSha256,counts:expected.database.counts}))fail('BACKUP_DATABASE_RESTORE_MISMATCH');
 const files=await inventory(restored);if(JSON.stringify(files)!==JSON.stringify(expected.uploads))fail('BACKUP_UPLOAD_RESTORE_MISMATCH');
 return {database:true,uploads:true,uploadFiles:files.length,uploadBytes:files.reduce((n,f)=>n+f.size,0)};
}
/** Fixed CLI arguments; stdout is private and is never streamed into application logs. */
export async function resticCommand(binary,args,{env,timeoutMs=21600000,capture='none'}={}){
 return await new Promise((resolvePromise,reject)=>{
  const p=spawn(binary,args,{env,stdio:['ignore','pipe','pipe']});let text='',line='',summary=null,settled=false,timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;p.kill('SIGTERM');setTimeout(()=>p.kill('SIGKILL'),5000).unref()},timeoutMs);timer.unref();
  const end=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);if(error)reject(error);else resolvePromise(value)};
  p.on('error',()=>end(new BackupError('BACKUP_RESTIC_UNAVAILABLE')));
  p.stderr.on('data',()=>{});
  p.stdout.on('data',chunk=>{
   if(settled)return;
   if(capture==='json'){text+=chunk;if(text.length>16*1024*1024){p.kill('SIGTERM');end(new BackupError('BACKUP_RESPONSE_TOO_LARGE'))}}
   else if(capture==='summary'){line+=chunk;const lines=line.split('\n');line=lines.pop();for(const l of lines){try{const v=JSON.parse(l);if(v.message_type==='summary')summary=v}catch{}}if(line.length>1024*1024){p.kill('SIGTERM');end(new BackupError('BACKUP_RESPONSE_TOO_LARGE'))}}
  });
  p.on('close',code=>{if(timedOut)return end(new BackupError('BACKUP_RESTIC_TIMEOUT'));if(code!==0)return end(new BackupError('BACKUP_RESTIC_FAILED'));if(capture==='json'){try{return end(null,JSON.parse(text))}catch{return end(new BackupError('BACKUP_RESPONSE_INVALID'))}}if(capture==='summary'){try{if(line){const v=JSON.parse(line);if(v.message_type==='summary')summary=v}}catch{}return end(null,summary)}end(null,null)});
 });
}
export function assertDedicatedSnapshots(snapshots,config,stage){
 if(!Array.isArray(snapshots))fail('BACKUP_RESPONSE_INVALID');
 if(snapshots.some(s=>s.hostname!==config.host||!Array.isArray(s.tags)||s.tags.length!==1||s.tags[0]!==TAG||!Array.isArray(s.paths)||s.paths.length!==1||s.paths[0]!==stage))fail('BACKUP_REPOSITORY_NOT_DEDICATED');
}
async function saveStatus(layout,result){const temp=layout.status+'.new';await writeFile(temp,JSON.stringify(result)+'\n',{mode:0o600});await rename(temp,layout.status)}
export async function verifyReceiver(config,{request=fetch,bootPath='/proc/sys/kernel/random/boot_id',minimumFreeBytes=2*1024**3}={}){
 if(config.local||config.backend!=='rest')return;
 const response=await request(config.healthUrl,{headers:{'x-nitido-health':config.healthToken},redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok)fail('BACKUP_RECEIVER_NOT_CONFIRMED');
 const body=await response.json(),ownHash=createHash('sha256').update((await readFile(bootPath,'utf8')).trim()).digest('hex');
 if(body.service!=='nitido-offsite-receiver-v1'||!/^[a-f0-9]{64}$/.test(body.bootHash??''))fail('BACKUP_RECEIVER_NOT_CONFIRMED');
 if(body.bootHash===ownHash)fail('BACKUP_RECEIVER_SAME_MACHINE');
 if(!Number.isSafeInteger(body.freeBytes)||body.freeBytes<minimumFreeBytes)fail('BACKUP_RECEIVER_LOW_SPACE');
 return {independentMachine:true,freeBytes:body.freeBytes,quotaBytes:body.quotaBytes};
}
export async function runOffsiteBackup({env=process.env,appRoot='/app',resticBinary='/usr/local/bin/restic',allowLocalRepository=false,now=new Date(),command=resticCommand}={}){
 const config=backupConfig(env,{allowLocalRepository});if(!config.enabled)return {status:'disabled',uploaded:false};
 const layout=await backupLayout(appRoot),childEnv={...config.childEnv,RESTIC_CACHE_DIR:join(layout.base,'cache')};
 const deadline=Date.now()+config.timeoutMs;
 const run=(args,capture='none')=>{const remaining=deadline-Date.now();if(remaining<=0)fail('BACKUP_RESTIC_TIMEOUT');return command(resticBinary,args,{env:childEnv,timeoutMs:remaining,capture})};
 let previous=null;try{previous=JSON.parse(await readFile(layout.status,'utf8'))}catch(e){if(e.code!=='ENOENT')fail('BACKUP_STATUS_INVALID')}
 const startedAt=now.toISOString();await saveStatus(layout,{status:'running',startedAt,lastSuccessfulAt:previous?.lastSuccessfulAt??null});
 try{
  const receiver=await verifyReceiver(config);
  const repository=await run(['cat','config'],'json');if(repository.id!==config.repositoryId)fail('BACKUP_REPOSITORY_ID_MISMATCH');
  assertDedicatedSnapshots(await run(['snapshots','--json'],'json'),config,layout.stage);
  const manifest=await prepareSnapshot(layout,{now});
  const backup=await run(['backup',layout.stage,'--host',config.host,'--tag',TAG,'--json'],'summary');
  const id=backup?.snapshot_id;if(!/^[a-f0-9]{64}$/.test(id??''))fail('BACKUP_SNAPSHOT_NOT_CONFIRMED');
  await run(['check']);await newDirectory(layout.restore);
  await run(['restore',id,'--target',layout.restore]);
  const restored=join(layout.restore,layout.stage.slice(1)),verified=await verifyRestored(restored,manifest);
  // Never prune a shared repository, even if another writer appeared after backup.
  assertDedicatedSnapshots(await run(['snapshots','--json'],'json'),config,layout.stage);
  await run(['forget','--host',config.host,'--tag',TAG,'--path',layout.stage,'--group-by','host,paths,tags','--keep-daily','30','--keep-last','3','--prune']);
  await run(['check']);
  const lastFull=previous?.lastFullCheckAt?Date.parse(previous.lastFullCheckAt):0;
  const fullCheck=!Number.isFinite(lastFull)||lastFull>now.getTime()||now.getTime()-lastFull>=7*86400000;
  if(fullCheck)await run(['check','--read-data']);
  const result={status:'passed',startedAt,finishedAt:new Date().toISOString(),lastSuccessfulAt:startedAt,lastFullCheckAt:fullCheck?startedAt:previous?.lastFullCheckAt??null,scope:config.scope,mode:config.local?'local-test':'external-'+config.backend,receiverVerified:receiver?.independentMachine??false,snapshotId:id,repositoryId:config.repositoryId,encrypted:true,restoreVerified:true,retention:{keepDaily:30,keepLast:3},...verified};
  await saveStatus(layout,result);return result;
 }catch(e){const code=e instanceof BackupError?e.code:'BACKUP_OPERATION_FAILED';await saveStatus(layout,{status:'failed',startedAt,finishedAt:new Date().toISOString(),lastSuccessfulAt:previous?.lastSuccessfulAt??null,lastFullCheckAt:previous?.lastFullCheckAt??null,code});throw new BackupError(code)}
 finally{await rm(layout.stage,{recursive:true,force:true});await rm(layout.restore,{recursive:true,force:true})}
}
