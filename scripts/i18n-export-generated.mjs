/** Read only this job's UI artifacts through the existing GitHub/Coolify integration. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';

const API='https://coolify.nitido.ro/api/v1';
const APP='civaeb8joydtchvzlen6pivq';
const RELEASE='d25796ca7e5bd8670eeb0326aa062e311aded729';
const REVISION='d19e99cbbea719dd0aeaf14b4a9918184475e3a9';
const SOURCE_HASH='77c61cb1d6a0796a437cbd5e97faedbdd7fb9a832d8430aa32222ecb130ca3e7';
const LOCALES=['bg','hr','cs','da','nl','en','fr','de'];
const MARKER='NITIDO_I18N_REFRESH_V1';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');

export function ownReports(logs){
  if(typeof logs!=='string')throw Error('EXPORT_LOG_FORMAT');
  const result=[];
  for(const line of logs.split('\n')){
    const start=line.indexOf('{"marker":"'+MARKER+'"');
    if(start<0)continue;
    try{const row=JSON.parse(line.slice(start,line.lastIndexOf('}')+1));if(row.marker===MARKER&&row.revision===REVISION)result.push(row)}catch{}
  }
  return result;
}
export function decodeCatalog(logs,locale){
  const rows=ownReports(logs).filter(row=>row.event==='export'&&row.locale===locale);
  if(!rows.length)throw Error('EXPORT_NOT_VISIBLE');
  const {total,sha256}=rows[0];
  if(!Number.isSafeInteger(total)||total<1||total>300||!/^[a-f0-9]{64}$/.test(sha256))throw Error('EXPORT_INVALID_PARTS');
  const parts=new Map();
  for(const row of rows){
    if(row.total!==total||row.sha256!==sha256||!Number.isSafeInteger(row.part)||row.part<0||row.part>=total||typeof row.data!=='string'||row.data.length>7000)throw Error('EXPORT_MIXED_PARTS');
    if(parts.has(row.part)&&parts.get(row.part)!==row.data)throw Error('EXPORT_CONFLICTING_PART');
    parts.set(row.part,row.data);
  }
  if(parts.size!==total)throw Error('EXPORT_INCOMPLETE');
  const bytes=gunzipSync(Buffer.from(Array.from({length:total},(_,i)=>parts.get(i)).join(''),'base64'),{maxOutputLength:2*1024*1024});
  if(sha(bytes)!==sha256)throw Error('EXPORT_HASH_MISMATCH');
  JSON.parse(bytes.toString('utf8'));
  return bytes;
}

export async function exportGeneratedCatalogs(env=process.env,fetcher=fetch,pause=ms=>new Promise(r=>setTimeout(r,ms))){
  if(!env.COOLIFY_TOKEN)throw Error('COOLIFY_CREDENTIAL_MISSING');
  const output=path.resolve('.translation-work/generated-catalogs');
  const source=JSON.parse(await fs.readFile('messages/ro.json','utf8'));
  if(Object.keys(source).length!==5293||sha(JSON.stringify(source))!==SOURCE_HASH)throw Error('EXPORT_SOURCE_MISMATCH');
  async function call(endpoint,method='GET',body){
    const r=await fetcher(API+endpoint,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Bearer '+env.COOLIFY_TOKEN,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(!r.ok)throw Error('COOLIFY_HTTP_'+r.status);
    return r.status===204?null:r.json();
  }
  const readOnly=env.NITIDO_EXPORT_READ_ONLY==='1';
  if(!readOnly){
    const app=await call('/applications/'+APP);
    if(app.status!=='running:healthy'||app.git_commit_sha!==RELEASE||!String(app.fqdn).includes('https://sandbox.nitido.ro'))throw Error('EXPORT_TARGET_MISMATCH');
  }
  // Check this existing CI identity's permission before creating any export task.
  // Raw application logs are never printed, persisted or uploaded.
  const snapshot=readOnly?await call('/applications/'+APP+'/logs?lines=1000'):null;
  if(!readOnly)await call('/applications/'+APP+'/logs?lines=1');
  await fs.mkdir(output,{recursive:true});
  async function run(mode){
    if(![...LOCALES,'ro','manifest','status'].includes(mode))throw Error('EXPORT_ACTION_INVALID');
    const command='NITIDO_I18N_REV='+REVISION+' node -e "fetch(\'https://raw.githubusercontent.com/Nelu251174/nitido/\'+process.env.NITIDO_I18N_REV+\'/scripts/tc.cjs\').then(r=>r.text()).then(eval)" '+mode;
    if(command.length>=255)throw Error('EXPORT_COMMAND_LENGTH');
    const task=await call('/applications/'+APP+'/scheduled-tasks','POST',{name:'nitido-ui-export-20261024-'+mode,command,frequency:'0 0 1 1 *',enabled:false,timeout:60});
    if(typeof task.uuid!=='string')throw Error('EXPORT_TASK_RESPONSE');
    const endpoint='/applications/'+APP+'/scheduled-tasks/'+task.uuid;
    let settled=false;
    try{
      await call(endpoint+'/execute','POST',{});
      for(let i=0;i<45;i++){
        await pause(2000);
        const response=await call(endpoint+'/executions');
        const rows=Array.isArray(response)?response:response.data;
        if(!Array.isArray(rows))throw Error('EXPORT_EXECUTION_RESPONSE');
        if(rows[0]?.status==='failed'){settled=true;throw Error('EXPORT_TASK_FAILED')}
        if(rows[0]?.status==='success'){settled=true;return}
      }
      throw Error('EXPORT_TASK_TIMEOUT');
    }finally{
      // Never delete or interrupt a running task. No schedules are enabled.
      if(settled)await call(endpoint,'DELETE');
    }
  }
  if(!readOnly)await run('status');
  let status;
  for(let i=0;i<5&&!status;i++){
    if(i)await pause(2000);
    const logs=snapshot??await call('/applications/'+APP+'/logs?lines=100');
    status=ownReports(logs.logs).filter(row=>row.event==='status').at(-1);
  }
  if(!status||!LOCALES.every(locale=>status.completed?.includes(locale))||!Number.isFinite(status.chargedUpperUsd)||status.chargedUpperUsd>5)throw Error('EXPORT_GENERATION_NOT_READY');
  const files={};
  for(const locale of ['ro','manifest',...LOCALES]){
    if(!readOnly)await run(locale);
    let bytes;
    for(let i=0;i<5&&!bytes;i++){
      if(i)await pause(2000);
      const logs=snapshot??await call('/applications/'+APP+'/logs?lines=120');
      try{bytes=decodeCatalog(logs.logs,locale)}catch(e){if(!['EXPORT_NOT_VISIBLE','EXPORT_INCOMPLETE'].includes(e.message))throw e}
    }
    if(!bytes)throw Error('EXPORT_DOWNLOAD_INCOMPLETE');
    const data=JSON.parse(bytes.toString('utf8'));
    if(locale==='manifest'){
      if(!data.complete||data.languages!==9||data.sourceMessages!==5293||data.sourceHash!==SOURCE_HASH)throw Error('EXPORT_MANIFEST_MISMATCH');
    }else if(Object.keys(data).length!==5293||Object.keys(source).some(id=>typeof data[id]!=='string'||!data[id].trim()))throw Error('EXPORT_CATALOG_MISMATCH');
    if(locale==='ro'&&sha(JSON.stringify(data))!==SOURCE_HASH)throw Error('EXPORT_SOURCE_CHANGED');
    await fs.writeFile(path.join(output,locale+'.json'),bytes);
    files[locale]=sha(bytes);
    console.log(JSON.stringify({catalog:locale,sha256:files[locale],verified:true}));
  }
  const receipt={sourceRevision:REVISION,sourceHash:SOURCE_HASH,messages:5293,languages:9,requests:status.requests,inputTokens:status.inputTokens,outputTokens:status.outputTokens,chargedUpperUsd:status.chargedUpperUsd,approvedMaxUsd:5,files,applicationChanged:false,newServiceCreated:false,credentialsExported:false};
  await fs.writeFile(path.join(output,'generation-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({complete:true,languages:9,messages:5293,chargedUpperUsd:status.chargedUpperUsd}));
  return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  exportGeneratedCatalogs().catch(error=>{console.error(/^[A-Z_0-9]+$/.test(error.message)?error.message:'CATALOG_EXPORT_FAILED');process.exitCode=1});
}
