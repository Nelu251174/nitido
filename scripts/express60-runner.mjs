import {pathToFileURL} from 'node:url';

/** Existing local maintenance endpoint only; never contacts a payment provider. */
export async function runExpress60({env=process.env,request=fetch}={}){
 const secret=env.CRON_SECRET,port=env.PORT??'3000';
 if(typeof secret!=='string'||secret.trim().length<32)throw Error('Express60 maintenance secret not configured');
 if(!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535)throw Error('Invalid PORT');
 const r=await request(`http://127.0.0.1:${port}/api/cron/express60`,{method:'POST',redirect:'error',headers:{'x-cron-secret':secret},signal:AbortSignal.timeout(55000)});
 if(!r.ok)throw Error(`Express60 maintenance failed (HTTP ${r.status})`);
 const data=await r.json();if(!Number.isSafeInteger(data.breached)||data.breached<0)throw Error('Invalid Express60 maintenance result');
 return {status:'completed',breached:data.breached};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await runExpress60()));}catch(error){console.error(error.message);process.exitCode=1}}
