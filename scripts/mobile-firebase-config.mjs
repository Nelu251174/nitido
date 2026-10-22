import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
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
 const raw=env.GOOGLE_SERVICES_JSON?.trim()?env.GOOGLE_SERVICES_JSON:await readFile(target,'utf8').catch(()=>{throw Error('FIREBASE_ANDROID_CONFIG_REQUIRED')});
 const result=validateFirebaseConfig(raw);await writeFile(target,raw,{mode:0o600});return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){prepareFirebase().then(r=>console.log(JSON.stringify({status:'configured',...r}))).catch(e=>{console.error(/^FIREBASE_ANDROID_[A-Z_]+$/.test(e.message)?e.message:'FIREBASE_ANDROID_CONFIG_FAILED');process.exitCode=1})}
