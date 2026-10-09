import {pathToFileURL} from 'node:url';

/** Local container entrypoint. No configurable destination and no redirects. */
export async function runRecovery({env=process.env,request=fetch}={}){
 const secret=env.NITIDO_FINANCIAL_RECOVERY_SECRET,port=env.PORT??'3000';
 if(env.NITIDO_FINANCIAL_RECOVERY_ENABLED!=='true'||typeof secret!=='string'||secret.trim().length<32)throw Error('Recuperarea periodică nu este activată/configurată.');
 if(!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535)throw Error('PORT invalid.');
 let response;
 try{response=await request(`http://127.0.0.1:${port}/api/cron/financial-recovery`,{method:'POST',redirect:'error',headers:{'x-recovery-secret':secret},signal:AbortSignal.timeout(55000)});}
 catch{throw Error('Răspuns neconfirmat. Consultă istoricul înainte de reluare.');}
 if(!response.ok)throw Error(`Recuperare neconfirmată (HTTP ${response.status}).`);
 let data;try{data=await response.json();}catch{throw Error('Răspuns invalid.');}
 const names=['attempted','processed','deferred','failed'];
 if(!data||!['completed','busy','cooldown'].includes(data.status)||names.some(name=>!Number.isSafeInteger(data[name])||data[name]<0)||data.attempted!==data.processed+data.deferred+data.failed||data.attempted>10||data.status!=='completed'&&data.attempted!==0)throw Error('Rezultatul recuperării nu este valid.');
 return {status:data.status,...Object.fromEntries(names.map(name=>[name,data[name]]))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(await runRecovery()));}catch(error){console.error(error.message);process.exitCode=1;}
}
