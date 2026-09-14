import {pathToFileURL} from 'node:url';

/** Runs inside the application container; never sends credentials to a configurable host. */
export async function runRecurring({env=process.env,request=fetch}={}){
  const secret=env.CRON_SECRET;
  if(typeof secret!=='string'||!secret.trim())throw new Error('CRON_SECRET lipsește. Generarea nu a fost pornită.');
  const port=env.PORT??'3000';
  if(!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535)throw new Error('PORT invalid. Generarea nu a fost pornită.');
  let response;
  try{
    response=await request(`http://127.0.0.1:${port}/api/cron/recurring`,{
      method:'POST',redirect:'error',headers:{'x-cron-secret':secret},signal:AbortSignal.timeout(55000),
    });
  }catch{throw new Error('Procesarea nu a fost confirmată: conexiune întreruptă sau timeout. Verifică istoricul vizitelor înainte de reluare.');}
  if(!response.ok)throw new Error(`Procesarea nu a fost confirmată (HTTP ${response.status}).`);
  let body;
  try{body=await response.json()}catch{throw new Error('Răspuns invalid de la procesarea recurenței.');}
  if(!body||!Number.isSafeInteger(body.created)||body.created<0)throw new Error('Numărul vizitelor create nu a fost confirmat.');
  return {created:body.created};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{console.log(JSON.stringify({status:'completed',...await runRecurring()}));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
