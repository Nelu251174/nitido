import {spawn} from 'node:child_process';
import {lstat,open} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {backupRuntimeConfig,backupLayout,runOffsiteBackup,BackupError} from './offsite-backup.mjs';
export async function runBackupProcess({env=process.env,args=process.argv.slice(2)}={}){
 const config=await backupRuntimeConfig(env);if(!config.enabled)return {status:'disabled',uploaded:false};
 if(args.length===1&&args[0]==='--locked')return await runOffsiteBackup({env});
 if(args.length)throw new BackupError('BACKUP_ARGUMENT_INVALID');
 const layout=await backupLayout('/app');
 try{const s=await lstat(layout.lock);if(s.isSymbolicLink()||!s.isFile())throw new BackupError('BACKUP_LOCK_UNSAFE')}catch(e){if(e.code!=='ENOENT')throw e}
 const file=await open(layout.lock,'a',0o600);await file.close();
 return await new Promise((resolve,reject)=>{const p=spawn('/usr/local/bin/flock',['--nonblock','--conflict-exit-code','75',layout.lock,process.execPath,process.argv[1],'--locked'],{env,stdio:['ignore','pipe','pipe']});let text='';p.stdout.on('data',b=>{text+=b;if(text.length>65536)p.kill('SIGTERM')});p.stderr.on('data',()=>{});p.on('error',()=>reject(new BackupError('BACKUP_LOCK_UNAVAILABLE')));p.on('close',code=>{if(code===75)return resolve({status:'skipped',reason:'backup_running'});if(code!==0)return reject(new BackupError('BACKUP_PROCESS_FAILED'));try{resolve(JSON.parse(text))}catch{reject(new BackupError('BACKUP_PROCESS_RESPONSE_INVALID'))}})});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){runBackupProcess().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(JSON.stringify({status:'failed',code:e instanceof BackupError?e.code:'BACKUP_PROCESS_FAILED'}));process.exitCode=1})}
