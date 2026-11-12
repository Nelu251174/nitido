import {spawn,type ChildProcess} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';

type Supervisor={child?:ChildProcess;retry?:ReturnType<typeof setTimeout>;stopped:boolean;retried:boolean;onExit:()=>void};
const state=globalThis as typeof globalThis & {__nitidoMarketingCollectorProcess?:Supervisor};

/** Public collection needs proxy/TLS settings, never application or provider credentials. */
export function marketingCollectorEnvironment(source:NodeJS.ProcessEnv=process.env):NodeJS.ProcessEnv{
 const env:NodeJS.ProcessEnv={NODE_ENV:'production'};
 for(const key of ['PATH','HOME','TMPDIR','TMP','TEMP','LANG','LC_ALL','TZ','HTTPS_PROXY','HTTP_PROXY','NO_PROXY','https_proxy','http_proxy','no_proxy','NODE_EXTRA_CA_CERTS','SSL_CERT_FILE','SSL_CERT_DIR','NEXT_PUBLIC_SITE_URL','NITIDO_MARKETING_ADMIN_ENABLED','NITIDO_MARKETING_DELIVERY_ENABLED']){
  if(source[key]!==undefined)env[key]=source[key];
 }
 return env;
}

/** One collector child per web process; existing persisted leases serialize actual collection. */
export function startMarketingCollectorProcess(databasePath:string){
 if(state.__nitidoMarketingCollectorProcess)return;
 const supervisor:Supervisor={stopped:false,retried:false,onExit:()=>stopMarketingCollectorProcess()};
 state.__nitidoMarketingCollectorProcess=supervisor;
 const worker=join(process.cwd(),'scripts','runtime','marketing-collector.cjs');
 if(databasePath===':memory:'||!databasePath||!existsSync(worker)){
  console.error('[marketing] collector_process_unavailable');
  return; // Never fall back to executing the collector in the HTTP event loop.
 }
 process.once('exit',supervisor.onExit);
 const launch=()=>{
  if(supervisor.stopped)return;
  let settled=false;
  const finished=()=>{
   if(settled||supervisor.stopped)return;
   settled=true;supervisor.child=undefined;
   console.error('[marketing] collector_process_failed');
   if(supervisor.retried){console.error('[marketing] collector_process_retry_exhausted');return;}
   supervisor.retried=true;
   supervisor.retry=setTimeout(()=>{supervisor.retry=undefined;launch();},15000);
   supervisor.retry.unref();
  };
  try{
   const child=spawn(process.execPath,['--max-old-space-size=256',worker,resolve(databasePath)],{
    env:marketingCollectorEnvironment(),
    stdio:['ignore','inherit','inherit','ipc'],
   });
   supervisor.child=child;
   child.once('message',message=>{if(message&&typeof message==='object'&&'type' in message&&message.type==='marketing-collector-ready')console.log('MKT_COLLECTOR_PROCESS '+JSON.stringify({state:'ready',isolated:true}));});
   child.once('error',finished);child.once('exit',finished);
   child.unref();child.channel?.unref();
  }catch{finished();}
 };
 launch();
}

export function stopMarketingCollectorProcess(){
 const supervisor=state.__nitidoMarketingCollectorProcess;if(!supervisor)return;
 supervisor.stopped=true;
 if(supervisor.retry)clearTimeout(supervisor.retry);
 process.removeListener('exit',supervisor.onExit);
 supervisor.child?.kill('SIGTERM');
 delete state.__nitidoMarketingCollectorProcess;
}
