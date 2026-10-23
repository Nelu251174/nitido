import {pathToFileURL} from 'node:url';
import {apnsSigningKey,APNS_IDENTITY} from './apns-credential-check.mjs';

const API='https://coolify.nitido.ro/api/v1';
const TARGETS=[{scope:'sandbox',uuid:'civaeb8joydtchvzlen6pivq',site:'https://sandbox.nitido.ro'},{scope:'live',uuid:'zxnelxi2cejranyvfpw0scac',site:'https://nitido.ro'}];
const RELEASE='0e7796447555737acccc4c1400fc43d120934ac4';
const rows=data=>Array.isArray(data)?data:data?.data??data?.envs??[];
function hasTargetDomain(app,site){
  const configuration=[app.fqdn,app.docker_compose_domains].map(value=>typeof value==='string'?value:JSON.stringify(value??'')).join(' ').replace(/\\\//g,'/');
  return (configuration.match(/https?:\/\/[^\s,"'\\}]+/g)??[]).some(value=>{try{const url=new URL(value);return url.protocol==='https:'&&url.hostname===new URL(site).hostname}catch{return false}});
}

export async function installApnsRuntime(env,fetcher=fetch){
  if(!env.COOLIFY_TOKEN)throw Error('COOLIFY_CREDENTIAL_MISSING');
  async function call(path,method='GET',body){
    const response=await fetcher(API+path,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Bearer '+env.COOLIFY_TOKEN,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(!response.ok)throw Error('COOLIFY_HTTP_'+response.status);
    return response.status===204?null:response.json();
  }
  // Verify both authorized destinations before sending any key or mutating bindings.
  const existing=new Map();
  for(const target of TARGETS){
    const app=await call('/applications/'+target.uuid);
    if(app.status!=='running:healthy'||app.git_commit_sha!==RELEASE||!hasTargetDomain(app,target.site))throw Error('COOLIFY_TARGET_RELEASE_MISMATCH');
    existing.set(target.uuid,rows(await call('/applications/'+target.uuid+'/envs')));
  }
  const privateKey=apnsSigningKey(env.APNS_PRIVATE_KEY,env.APPLE_TEAM_ID).export({type:'pkcs8',format:'pem'});
  const values={PUSH_ENABLED:'false',APNS_KEY_ID:APNS_IDENTITY.keyId,APNS_TEAM_ID:APNS_IDENTITY.teamId,APNS_BUNDLE_ID:APNS_IDENTITY.bundleId,APNS_USE_SANDBOX:'false',APNS_PRIVATE_KEY:privateKey};
  const result={status:'configured_restart_queued',servers:[],notificationSent:false,deviceReceptionTested:false,pushDeliveryEnabled:false,keyExportedToArtifacts:false};
  for(const target of TARGETS){
    const path='/applications/'+target.uuid;
    for(const [key,value] of Object.entries(values)){
      const body={key,value,is_buildtime:false,is_runtime:true,is_literal:true,is_shown_once:true};
      const found=existing.get(target.uuid).some(row=>row.key===key&&row.is_preview===false);
      await call(path+'/envs',found?'PATCH':'POST',{...body,is_preview:false});
      const copies=rows(await call(path+'/envs'));
      if(copies.some(row=>row.key===key&&row.is_preview===true))await call(path+'/envs','PATCH',{...body,is_preview:true});
    }
    const stored=rows(await call(path+'/envs'));
    if(!Object.keys(values).every(key=>stored.some(row=>row.key===key&&row.is_preview===false&&row.is_shown_once===true&&row.is_runtime===true&&row.is_buildtime===false)))throw Error('COOLIFY_RUNTIME_BINDING_PROTECTION_FAILED');
    if(stored.some(row=>Object.hasOwn(values,row.key)&&row.is_shown_once!==true))throw Error('COOLIFY_PREVIEW_BINDING_PROTECTION_FAILED');
    const restart=await call(path+'/restart','POST');
    if(typeof restart?.deployment_uuid!=='string')throw Error('COOLIFY_RESTART_RESPONSE_INVALID');
    result.servers.push({scope:target.scope,configured:true,deploymentUuid:restart.deployment_uuid});
  }
  return result;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{console.log(JSON.stringify(await installApnsRuntime(process.env)))}
  catch(error){console.log(JSON.stringify({status:'blocked',reason:/^(?:COOLIFY|APNS)_[A-Z0-9_]+$/.test(error.message)?error.message:'APNS_RUNTIME_INSTALLATION_FAILED',notificationSent:false,keyExportedToArtifacts:false}));process.exitCode=1}
}
