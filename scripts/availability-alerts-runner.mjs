// Executes inside the existing application container; the secret only reaches loopback.
const secret=process.env.NITIDO_AVAILABILITY_CRON_SECRET,port=process.env.PORT??'3000';
try{
  if(!secret||secret.length<32||!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535)throw Error('Configurația procesării alertelor este incompletă.');
  const r=await fetch(`http://127.0.0.1:${port}/api/cron/availability-alerts`,{method:'POST',redirect:'error',headers:{'x-cron-secret':secret},signal:AbortSignal.timeout(55000)});
  if(!r.ok)throw Error(`Procesare neconfirmată: HTTP ${r.status}`);
  const b=await r.json();if(!['completed','disabled'].includes(b.status)||['queued','sent','suppressed'].some(k=>!Number.isSafeInteger(b[k])||b[k]<0))throw Error('Rezultat neconfirmat.');
  console.log(JSON.stringify(b));
}catch(e){console.error(e instanceof Error&&/^Configurația|^Procesare neconfirmată|^Rezultat neconfirmat/.test(e.message)?e.message:'Procesare neconfirmată. Verifică istoricul alertelor.');process.exitCode=1;}
