// Fixed, owner-approved NITIDO operations through the existing CI identity.
import fs from 'node:fs/promises';
const API='https://coolify.nitido.ro/api/v1',APP='zxnelxi2cejranyvfpw0scac';
const SOURCE='b978d3da887427f8a612207424ea31f5fc3a2b45';
const MARKER='NITIDO_PILOT_20261024_V1';
const out='.pilot-evidence';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function safeRows(logs,action){
 const rows=[];
 for(const line of logs.split('\n')){const start=line.indexOf('{"marker":"'+MARKER+'"');if(start<0)continue;try{
  const raw=JSON.parse(line.slice(start,line.lastIndexOf('}')+1));if(raw.marker!==MARKER||raw.action!==action)continue;
  const row={action};for(const k of ['status','reason','sound','reused','messagesAccepted','deviceReceptionConfirmed','deliveryConfirmed'])if(raw[k]!==undefined)row[k]=raw[k];
  if(Array.isArray(raw.results))row.results=raw.results.filter(x=>['firm_gss3cxi4mv1cy43e','firm_z5w23tk7mv9hrpea'].includes(x.firmId)).map(x=>({firmId:x.firmId,status:x.status,...(x.reason?{reason:x.reason}:{}),reused:x.reused??false}));
  rows.push(row);
 }catch{}}
 return rows;
}
async function call(endpoint,method='GET',body){
 const r=await fetch(API+endpoint,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Bearer '+process.env.COOLIFY_TOKEN,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw Error('COOLIFY_HTTP_'+r.status);return r.status===204?null:r.json();
}
async function run(){
 if(!process.env.COOLIFY_TOKEN||!/^[a-f\d]{40}$/.test(process.env.GITHUB_SHA??''))throw Error('CI_IDENTITY_UNAVAILABLE');
 const app=await call('/applications/'+APP);if(app.status!=='running:healthy'||app.git_commit_sha!==SOURCE)throw Error('APP_TARGET_MISMATCH');
 await call('/applications/'+APP+'/logs?lines=1'); // require existing permission; never work around denied reads
 await fs.mkdir(out,{recursive:true});const evidence={source:SOURCE,runner:process.env.GITHUB_SHA,createdAt:new Date().toISOString(),operations:[]};
 for(const action of ['ios','android','mail']){
  const command='node -e \'fetch("https://raw.githubusercontent.com/Nelu251174/nitido/'+process.env.GITHUB_SHA+'/scripts/pc.cjs").then(r=>{if(!r.ok)throw Error(r.status);return r.text()}).then(eval)\' '+action;
  if(command.length>=255)throw Error('COMMAND_TOO_LONG');
  const task=await call('/applications/'+APP+'/scheduled-tasks','POST',{name:'Approved owner pilot operation 20261024: '+action,command,frequency:'0 0 1 1 *',enabled:false,timeout:90});
  const endpoint='/applications/'+APP+'/scheduled-tasks/'+task.uuid;let settled=false;const record={action,taskUuid:task.uuid};evidence.operations.push(record);
  try{
   await call(endpoint+'/execute','POST',{});
   for(let i=0;i<40;i++){await pause(1500);const value=await call(endpoint+'/executions');const latest=(Array.isArray(value)?value:value.data)?.[0];if(['success','failed'].includes(latest?.status)){settled=true;record.executionStatus=latest.status;record.finishedAt=latest.finished_at;break}}
   if(!settled)throw Error('OPERATION_TIMEOUT');
   for(let i=0;i<4&&!record.result;i++){if(i)await pause(1500);const logs=await call('/applications/'+APP+'/logs?lines=250');record.result=safeRows(logs.logs,action).at(-1);}
   if(!record.result)record.result={action,status:'result_unavailable'};
  }catch(e){record.error=/^[A-Z_0-9]+$/.test(e.message)?e.message:'OPERATION_UNAVAILABLE'}
  finally{if(settled){await call(endpoint,'DELETE');record.taskRemoved=true}await fs.writeFile(out+'/operations.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(record))}
 }
}
run().catch(e=>{console.error(JSON.stringify({status:'blocked',reason:/^[A-Z_0-9]+$/.test(e.message)?e.message:'OPERATION_UNAVAILABLE'}));process.exitCode=1});
