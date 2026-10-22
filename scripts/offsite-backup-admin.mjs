// Infrastructure CLI only. Never import this module into an HTTP route.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {backupConfig,backupLayout,verifyReceiver,resticCommand,BackupError} from './offsite-backup.mjs';
const action=process.argv[2];
async function report(result){const line=JSON.stringify({marker:'NITIDO_OFFSITE_OPERATION_V1',action,...result})+'\n';console.log(line.trim());try{await writeFile('/proc/1/fd/1',line)}catch{}}
try{
 if(!['preflight','init','status'].includes(action))throw new BackupError('BACKUP_ADMIN_ARGUMENT_INVALID');
 const layout=await backupLayout('/app');
 if(action==='status'){
  let status;try{status=JSON.parse(await readFile(layout.status,'utf8'))}catch(e){if(e.code==='ENOENT')status={status:'not_run'};else throw e}
  await report(status);
 }else{
  // Explicit operator bootstrap only; scheduled backups never initialize repositories.
  const config=backupConfig({...process.env,NITIDO_OFFSITE_BACKUP_ENABLED:'true',NITIDO_OFFSITE_REPOSITORY_ID:process.env.NITIDO_OFFSITE_REPOSITORY_ID||'0'.repeat(64)});
  const receiver=await verifyReceiver(config);const bootHash=createHash('sha256').update((await readFile('/proc/sys/kernel/random/boot_id','utf8')).trim()).digest('hex');
  const env={...config.childEnv,RESTIC_CACHE_DIR:join(layout.base,'cache')};
  if(action==='init'){
   await resticCommand('/usr/local/bin/restic',['init'],{env,timeoutMs:120000});
   const result=await resticCommand('/usr/local/bin/restic',['cat','config'],{env,timeoutMs:60000,capture:'json'});
   if(!/^[a-f0-9]{64}$/.test(result.id??''))throw new BackupError('BACKUP_REPOSITORY_ID_REQUIRED');
   await report({status:'initialized',scope:config.scope,repositoryId:result.id,...receiver});
  }else await report({status:'passed',scope:config.scope,sourceBootHash:bootHash,...receiver});
 }
}catch(e){await report({status:'failed',code:e instanceof BackupError?e.code:'BACKUP_ADMIN_FAILED'});process.exitCode=1}
