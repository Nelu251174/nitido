import http from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,writeFile,statfs,mkdir,chmod,lstat} from 'node:fs/promises';
import {createHash,timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const equal=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y)};
export async function startReceiver({env=process.env,data='/data',backendPort=8001,port=8000,binary='/usr/local/bin/rest-server',bootPath='/proc/sys/kernel/random/boot_id'}={}){
 const quota=Number(env.NITIDO_RECEIVER_QUOTA_BYTES??2147483648);
 if(!Number.isSafeInteger(quota)||quota<268435456||quota>10737418240)throw Error('RECEIVER_QUOTA_INVALID');
 if(!/^[a-f0-9]{64}$/.test(env.NITIDO_RECEIVER_HEALTH_TOKEN??''))throw Error('RECEIVER_HEALTH_SECRET_REQUIRED');
 for(const scope of ['LIVE','SANDBOX'])if(!/^\$2[aby]\$1[0-4]\$[./A-Za-z0-9]{53}$/.test(env['NITIDO_'+scope+'_BCRYPT']??''))throw Error('RECEIVER_AUTH_HASH_REQUIRED');
 await mkdir(data,{recursive:true,mode:0o700});const ds=await lstat(data);if(ds.isSymbolicLink()||!ds.isDirectory())throw Error('RECEIVER_VOLUME_INVALID');await chmod(data,0o700);
 const space=await statfs(data);if(Number(space.bavail)*Number(space.bsize)<quota*2+2*1024**3)throw Error('RECEIVER_FREE_SPACE_REQUIRED');
 const bootHash=createHash('sha256').update((await readFile(bootPath,'utf8')).trim()).digest('hex');
 const auth=data+'/.htpasswd';await writeFile(auth,'nitido-live:'+env.NITIDO_LIVE_BCRYPT+'\nnitido-sandbox:'+env.NITIDO_SANDBOX_BCRYPT+'\n',{mode:0o600});await chmod(auth,0o600);
 const backend=spawn(binary,['--listen','127.0.0.1:'+backendPort,'--path',data,'--private-repos','--htpasswd-file',auth,'--max-size',String(quota)],{stdio:['ignore','ignore','ignore'],env:{PATH:env.PATH}});
 let alive=true;backend.on('error',()=>{alive=false});backend.on('exit',()=>{alive=false});
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(req.method==='GET'&&req.url==='/_nitido-backup-health'){
   if(!equal(req.headers['x-nitido-health'],env.NITIDO_RECEIVER_HEALTH_TOKEN)){res.writeHead(401);return res.end()}
   if(!alive){res.writeHead(503);return res.end()}
   try{const s=await statfs(data);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({service:'nitido-offsite-receiver-v1',bootHash,freeBytes:Number(s.bavail)*Number(s.bsize),quotaBytes:quota}))}catch{res.writeHead(503);res.end()};return;
  }
  const path=(req.url??'').split('?')[0];
  if(!/^\/nitido-(?:live|sandbox)\/backup(?:\/|$)/.test(path)||path.includes('%')||path.includes('..')){res.writeHead(404);return res.end()}
  if(!alive){res.writeHead(503);return res.end()}
  const headers={...req.headers};delete headers['x-nitido-health'];
  const upstream=http.request({hostname:'127.0.0.1',port:backendPort,path:req.url,method:req.method,headers},u=>{res.writeHead(u.statusCode??502,{...u.headers,'cache-control':'no-store','x-robots-tag':'noindex, nofollow'});u.pipe(res)});
  upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end()});req.on('aborted',()=>upstream.destroy());req.pipe(upstream);
 });
 server.requestTimeout=0;server.headersTimeout=30000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'0.0.0.0',resolve)});
 return {server,backend,bootHash,close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));backend.kill('SIGTERM')}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){startReceiver().then(r=>{console.log(JSON.stringify({service:'nitido-offsite-receiver-v1',status:'running'}));process.on('SIGTERM',()=>r.close().finally(()=>process.exit(0)));r.backend.once('exit',()=>{console.error('RECEIVER_BACKEND_EXITED');process.exitCode=1;r.server.close()})}).catch(()=>{console.error('RECEIVER_START_FAILED');process.exitCode=1})}
