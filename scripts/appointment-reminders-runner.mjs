export async function runAppointmentReminders({env=process.env,request=fetch}={}){
 const secret=env.NITIDO_APPOINTMENT_CRON_SECRET,port=env.PORT??'3000';
 if(typeof secret!=='string'||secret.length<32||!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535)throw Error('Configurație reamintiri invalidă.');
 const r=await request(`http://127.0.0.1:${port}/api/cron/appointment-reminders`,{method:'POST',redirect:'error',headers:{'x-cron-secret':secret},signal:AbortSignal.timeout(55000)});
 if(!r.ok)throw Error(`Procesare neconfirmată: HTTP ${r.status}`);
 const b=await r.json();if(!['completed','disabled'].includes(b?.status)||['queued','sent','suppressed','blocked'].some(k=>!Number.isSafeInteger(b[k])||b[k]<0))throw Error('Rezultat neconfirmat.');
 return {status:b.status,queued:b.queued,sent:b.sent,suppressed:b.suppressed,blocked:b.blocked};
}
if(process.argv[1]&&import.meta.url===(await import('node:url')).pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await runAppointmentReminders()));}catch{console.error('Procesarea reamintirilor nu a fost confirmată. Verifică starea în administrare.');process.exitCode=1;}}
