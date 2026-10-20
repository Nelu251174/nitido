import {pathToFileURL} from 'node:url';

/** Local bounded compensation endpoint only. No capture, refund, transfer or new authorization. */
export async function runCoverageRecovery({env=process.env,request=fetch}={}){
 const secret=env.CRON_SECRET,port=env.PORT??'3000';
 if(typeof secret!=='string'||secret.trim().length<32)throw Error('Authorization coverage maintenance secret not configured');
 if(!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535)throw Error('Invalid PORT');
 const r=await request(`http://127.0.0.1:${port}/api/cron/authorization-coverage`,{method:'POST',redirect:'error',headers:{'x-cron-secret':secret},signal:AbortSignal.timeout(55000)});
 if(!r.ok)throw Error(`Authorization coverage maintenance failed (HTTP ${r.status})`);
 const data=await r.json();if(!Number.isSafeInteger(data.attempted)||!Number.isSafeInteger(data.released)||data.attempted<0||data.attempted>5||data.released<0||data.released>data.attempted)throw Error('Invalid authorization cleanup result');
 return {status:'completed',attempted:data.attempted,released:data.released};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await runCoverageRecovery()));}catch(error){console.error(error.message);process.exitCode=1}}
