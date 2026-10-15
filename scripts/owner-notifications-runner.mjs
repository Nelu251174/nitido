import {pathToFileURL} from 'node:url';
export async function ownerRequest(body,{env=process.env,request=fetch}={}){
 const secret=env.NITIDO_OWNER_ALERTS_CRON_SECRET,port=env.PORT??'3000';
 if(env.NITIDO_OWNER_NOTIFICATIONS_ENABLED!=='true'||!['https://nitido.ro','https://sandbox.nitido.ro'].includes(env.NEXT_PUBLIC_SITE_URL)||typeof secret!=='string'||secret.length<32)throw Error('OWNER_ALERTS_NOT_CONFIGURED');
 if(!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535)throw Error('INVALID_PORT');
 let response;try{response=await request(`http://127.0.0.1:${port}/api/cron/owner-notifications`,{method:'POST',redirect:'error',headers:{'x-owner-cron-secret':secret,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(55000)});}catch{throw Error('OWNER_ALERTS_RESPONSE_UNKNOWN');}
 if(!response.ok)throw Error('OWNER_ALERTS_HTTP_'+response.status);
 const data=await response.json();
 if(!['completed','disabled'].includes(data?.status)||['selected','accepted','failed','suppressed','uncertain'].some(k=>!Number.isSafeInteger(data[k])||data[k]<0||data[k]>5))throw Error('OWNER_ALERTS_INVALID_RESULT');
 return {status:data.status,selected:data.selected,accepted:data.accepted,failed:data.failed,suppressed:data.suppressed,uncertain:data.uncertain};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.argv.slice(2).some(a=>a!=='--test'))throw Error('INVALID_ARGUMENT');console.log(JSON.stringify(await ownerRequest(process.argv.includes('--test')?{action:'test'}:undefined)));}catch(e){console.error(e.message);process.exitCode=1;}
}
