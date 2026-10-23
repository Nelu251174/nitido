import {readFile,writeFile,mkdtemp,rm,chmod} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {firebaseServiceAccount,FIREBASE_PROJECT} from './push-firebase-provision.mjs';
const execute=promisify(execFile);
export function validateFirebaseConfig(value){
 let config;try{config=typeof value==='string'?JSON.parse(value):value}catch{throw Error('FIREBASE_ANDROID_JSON_INVALID')}
 const project=config?.project_info;
 if(typeof project?.project_id!=='string'||!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project.project_id)||!/^\d+$/.test(String(project.project_number??'')))throw Error('FIREBASE_ANDROID_PROJECT_INVALID');
 const clients=Array.isArray(config.client)?config.client.filter(c=>c?.client_info?.android_client_info?.package_name==='ro.nitido.app'):[];
 if(clients.length!==1)throw Error('FIREBASE_ANDROID_PACKAGE_MISMATCH');
 const client=clients[0];if(typeof client.client_info.mobilesdk_app_id!=='string'||!client.client_info.mobilesdk_app_id.startsWith('1:'+project.project_number+':android:')||!Array.isArray(client.api_key)||!client.api_key.some(k=>typeof k.current_key==='string'&&k.current_key.length>=20))throw Error('FIREBASE_ANDROID_CLIENT_INVALID');
 return {packageName:'ro.nitido.app',projectId:project.project_id,androidAppId:client.client_info.mobilesdk_app_id};
}
export async function prepareFirebase({env=process.env,target='android/app/google-services.json'}={}){
 const raw=env.GOOGLE_SERVICES_JSON?.trim()?env.GOOGLE_SERVICES_JSON:env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()?await downloadFirebaseAndroidConfig(env):await readFile(target,'utf8').catch(()=>{throw Error('FIREBASE_ANDROID_CONFIG_REQUIRED')});
 const result=validateFirebaseConfig(raw);if(result.projectId!==FIREBASE_PROJECT)throw Error('FIREBASE_ANDROID_PROJECT_MISMATCH');
 await writeFile(target,raw,{mode:0o600});await chmod(target,0o600);return result;
}
export async function downloadFirebaseAndroidConfig(env=process.env,invoke=execute){
 const account=firebaseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_JSON??'');
 const root=await mkdtemp(join(tmpdir(),'nitido-firebase-config-'));
 try{
  const credential=join(root,'account.json');await writeFile(credential,JSON.stringify(account),{mode:0o600});
  const child={...env,GOOGLE_APPLICATION_CREDENTIALS:credential,XDG_CONFIG_HOME:join(root,'cli-config'),CI:'true',NO_UPDATE_NOTIFIER:'1'};
  for(const key of ['FIREBASE_SERVICE_ACCOUNT_JSON','GOOGLE_SERVICES_JSON','FIREBASE_TOKEN','COOLIFY_TOKEN'])delete child[key];
  async function cli(args){
   try{
    const output=await invoke('npx',['-y','firebase-tools@latest',...args,'--project',FIREBASE_PROJECT,'--json','--non-interactive'],{cwd:root,env:child,timeout:240000,maxBuffer:2*1024*1024});
    const value=JSON.parse(output.stdout);if(value.status!=='success')throw Error('CLI_FAILED');return value.result;
   }catch(error){
    const diagnostic=String(error.stdout??'');
    throw Error(/\b403\b|PERMISSION_DENIED/.test(diagnostic)?'FIREBASE_ANDROID_ACCESS_DENIED':'FIREBASE_ANDROID_CLI_FAILED');
   }
  }
  const apps=await cli(['apps:list','ANDROID']);if(!Array.isArray(apps))throw Error('FIREBASE_ANDROID_APP_NOT_FOUND');
  let matching=apps.filter(a=>a.packageName==='ro.nitido.app');
  if(!matching.length&&apps.length===1&&!apps[0].packageName)matching=apps;
  if(matching.length!==1||typeof matching[0].appId!=='string')throw Error('FIREBASE_ANDROID_APP_NOT_UNIQUE');
  const config=await cli(['apps:sdkconfig','ANDROID',matching[0].appId]);
  if(typeof config?.fileContents!=='string')throw Error('FIREBASE_ANDROID_CONFIG_RESPONSE_INVALID');
  const verified=validateFirebaseConfig(config.fileContents);
  if(verified.projectId!==FIREBASE_PROJECT||verified.androidAppId!==matching[0].appId)throw Error('FIREBASE_ANDROID_PROJECT_MISMATCH');
  return config.fileContents;
 }finally{await rm(root,{recursive:true,force:true})}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){prepareFirebase().then(r=>console.log(JSON.stringify({status:'configured',...r}))).catch(e=>{console.error(/^FIREBASE_ANDROID_[A-Z_]+$/.test(e.message)?e.message:'FIREBASE_ANDROID_CONFIG_FAILED');process.exitCode=1})}
