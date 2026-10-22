import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import net from 'node:net';
import bcrypt from 'bcryptjs';
import {startReceiver} from './receiver.mjs';
import {resticCommand} from '../../scripts/offsite-backup.mjs';
const restic=process.env.NITIDO_TEST_RESTIC_BIN||'/usr/local/bin/restic',restServer=process.env.NITIDO_TEST_REST_SERVER_BIN||'/usr/local/bin/rest-server';
async function port(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p}
const env=async()=>({NITIDO_RECEIVER_QUOTA_BYTES:String(256*1024**2),NITIDO_RECEIVER_HEALTH_TOKEN:'b'.repeat(64),NITIDO_LIVE_BCRYPT:await bcrypt.hash('synthetic-live-rest-password',10),NITIDO_SANDBOX_BCRYPT:await bcrypt.hash('synthetic-sandbox-rest-password',10)});
test('receiver requires protected configuration before starting a process',async()=>{await assert.rejects(startReceiver({env:{}}),/RECEIVER_HEALTH_SECRET_REQUIRED/);await assert.rejects(startReceiver({env:{...(await env()),NITIDO_RECEIVER_QUOTA_BYTES:'1'}}),/RECEIVER_QUOTA_INVALID/);await assert.rejects(startReceiver({env:{...(await env()),NITIDO_LIVE_BCRYPT:''}}),/RECEIVER_AUTH_HASH_REQUIRED/)});
test('real receiver authenticates health, encrypts a REST repository and isolates users and prefixes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'nitido-receiver-'));await mkdir(join(root,'data'));await writeFile(join(root,'boot'),'isolated-receiver-kernel');let receiver;
 try{
  const e=await env();receiver=await startReceiver({env:e,allowInsecureTest:true,data:join(root,'data'),bootPath:join(root,'boot'),binary:restServer,backendPort:await port(),port:0});const base='http://127.0.0.1:'+receiver.server.address().port;
  assert.equal((await fetch(base+'/_nitido-backup-health')).status,401);
  const h=await fetch(base+'/_nitido-backup-health',{headers:{'x-nitido-health':e.NITIDO_RECEIVER_HEALTH_TOKEN}});assert.equal(h.status,200);const proof=await h.json();assert.equal(proof.service,'nitido-offsite-receiver-v1');assert.match(proof.bootHash,/^[a-f0-9]{64}$/);assert.equal(proof.quotaBytes,256*1024**2);assert.equal(JSON.stringify(proof).includes('password'),false);
  assert.equal((await fetch(base+'/unrelated')).status,404);
  for(let i=0;i<20;i++){const r=await fetch(base+'/nitido-live/backup/');if(r.status===401)break;await new Promise(r=>setTimeout(r,30))}
  assert.equal((await fetch(base+'/nitido-live/backup/')).status,401);
  const client={RESTIC_REPOSITORY:'rest:'+base+'/nitido-live/backup/',RESTIC_REST_USERNAME:'nitido-live',RESTIC_REST_PASSWORD:'synthetic-live-rest-password',RESTIC_PASSWORD:'synthetic-encryption-password-at-least-32-characters',RESTIC_CACHE_DIR:join(root,'cache')};
  const run=(args,extra={},capture='none')=>resticCommand(restic,args,{env:{...client,...extra},timeoutMs:30000,capture});
  await run(['init']);const config=await run(['cat','config'],{},'json');assert.match(config.id,/^[a-f0-9]{64}$/);
  await assert.rejects(run(['cat','config'],{RESTIC_REST_USERNAME:'nitido-sandbox',RESTIC_REST_PASSWORD:'synthetic-sandbox-rest-password'}),/BACKUP_RESTIC_FAILED/);
  await assert.rejects(run(['cat','config'],{RESTIC_REST_PASSWORD:'wrong-authentication-password'}),/BACKUP_RESTIC_FAILED/);
  await assert.rejects(run(['cat','config'],{RESTIC_PASSWORD:'wrong-decryption-password-with-32-characters'}),/BACKUP_RESTIC_FAILED/);
  await writeFile(join(root,'synthetic.txt'),'Synthetic backup payload');const summary=await run(['backup',join(root,'synthetic.txt'),'--json'],{},'summary');assert.match(summary.snapshot_id,/^[a-f0-9]{64}$/);await run(['check','--read-data']);
 }finally{if(receiver)await receiver.close();await rm(root,{recursive:true,force:true})}
});
test('production receiver refuses to expose a plaintext transport',async()=>{await assert.rejects(startReceiver({env:await env()}),/RECEIVER_TLS_REQUIRED/)});
test('TLS receiver and Restic accept only the pinned certificate',async()=>{
 const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');const {readFile}=await import('node:fs/promises');const {receiverRequest}=await import('../../scripts/offsite-backup.mjs');const root=await mkdtemp(join(tmpdir(),'nitido-receiver-tls-'));let receiver;
 try{
  const cert=join(root,'tls.pem'),key=join(root,'tls.key');await promisify(execFile)('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','365','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost'],{maxBuffer:65536});
  const e=await env();e.NITIDO_RECEIVER_TLS_CERT_BASE64=(await readFile(cert)).toString('base64');e.NITIDO_RECEIVER_TLS_KEY_BASE64=(await readFile(key)).toString('base64');await writeFile(join(root,'boot'),'independent-tls-test-kernel');
  receiver=await startReceiver({env:e,data:join(root,'data'),bootPath:join(root,'boot'),binary:restServer,backendPort:await port(),port:0});const base='https://localhost:'+receiver.server.address().port;
  const result=await receiverRequest(base+'/_nitido-backup-health',{headers:{'x-nitido-health':e.NITIDO_RECEIVER_HEALTH_TOKEN},signal:AbortSignal.timeout(5000)},await readFile(cert,'utf8'));assert.equal(result.status,200);assert.equal((await result.json()).service,'nitido-offsite-receiver-v1');
  await assert.rejects(receiverRequest(base+'/_nitido-backup-health',{headers:{},signal:AbortSignal.timeout(5000)},'incorrect-ca'));
  const client={RESTIC_REPOSITORY:'rest:'+base+'/nitido-live/backup/',RESTIC_REST_USERNAME:'nitido-live',RESTIC_REST_PASSWORD:'synthetic-live-rest-password',RESTIC_PASSWORD:'synthetic-encryption-password-at-least-32-characters',RESTIC_CACHE_DIR:join(root,'cache'),RESTIC_CACERT:cert};
  await resticCommand(restic,['init'],{env:client,timeoutMs:30000});const config=await resticCommand(restic,['cat','config'],{env:client,timeoutMs:30000,capture:'json'});assert.match(config.id,/^[a-f0-9]{64}$/);
  await assert.rejects(resticCommand(restic,['cat','config'],{env:{...client,RESTIC_CACERT:undefined},timeoutMs:30000}));
 }finally{if(receiver)await receiver.close();await rm(root,{recursive:true,force:true})}
});
