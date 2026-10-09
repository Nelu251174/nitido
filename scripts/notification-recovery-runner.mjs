import {pathToFileURL} from 'node:url';

export async function runNotificationRecovery({env=process.env,request=fetch}={}){
 const secret=env.CRON_SECRET,port=env.PORT??'3000';
 if(env.NITIDO_NOTIFICATION_RECOVERY_ENABLED!=='true'||env.NEXT_PUBLIC_SITE_URL!=='https://sandbox.nitido.ro'||typeof secret!=='string'||secret.trim().length<32)throw Error('Recuperarea notificărilor sandbox nu este configurată.');
 if(!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535)throw Error('PORT invalid.');
 let response;
 try{response=await request(`http://127.0.0.1:${port}/api/cron/notifications`,{method:'POST',redirect:'error',headers:{'x-cron-secret':secret},signal:AbortSignal.timeout(55000)});}
 catch{throw Error('Răspuns neconfirmat. Verifică notificările în ADMIN.');}
 if(!response.ok)throw Error(`Recuperare neconfirmată (HTTP ${response.status}).`);
 let data;try{data=await response.json();}catch{throw Error('Răspuns invalid.');}
 if(data?.status!=='completed'||['recovered','quarantined','pushSelected','smsSelected'].some(key=>!Number.isSafeInteger(data[key])||data[key]<0)||data.recovered+data.quarantined>200||data.pushSelected>1||data.smsSelected>1)throw Error('Rezultat invalid.');
 return {status:data.status,recovered:data.recovered,quarantined:data.quarantined,pushSelected:data.pushSelected,smsSelected:data.smsSelected};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(await runNotificationRecovery()));}catch(error){console.error(error.message);process.exitCode=1;}
}
