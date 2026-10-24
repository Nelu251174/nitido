// Owner-requested, read-only diagnostic. Never prints addresses, tokens or email bodies.
const Database=require('better-sqlite3');
const {createHash}=require('node:crypto');
const db=new Database('/app/data/nitido.db',{readonly:true,fileMustExist:true});
const hash=s=>createHash('sha256').update(s).digest('hex');
async function get(path){
 try{
  const r=await fetch('https://api.resend.com'+path,{headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY},signal:AbortSignal.timeout(10000)});
  if(!r.ok)return {status:r.status};
  return {status:r.status,data:await r.json()};
 }catch{return {status:'unavailable'}}
}
(async()=>{
 const now=Date.now(),email=(process.env.NITIDO_ADMIN_EMAIL||'').trim().toLowerCase();
 const result={marker:'NITIDO_ADMIN_RECOVERY_DIAG_20261024',scope:process.env.NEXT_PUBLIC_SITE_URL==='https://nitido.ro'?'live':'other',configured:!!(email&&process.env.RESEND_API_KEY&&process.env.RESEND_FROM)};
 if(result.scope!=='live')throw Error('WRONG_TARGET');
 const support='support@nitido.ro',staff=db.prepare('SELECT active FROM admin_staff WHERE email=?').get(support);
 let staffConfigured=false;try{staffConfigured=JSON.parse(process.env.NITIDO_ADMIN_STAFF_ACCOUNTS_JSON||'[]').some(x=>x.email?.trim().toLowerCase()===support&&x.passwordHash&&x.totpSecret)}catch{}
 result.requestedAddress={matchesOwner:email===support,staffActive:staff?.active===1,staffConfigured};
 const limits=db.prepare('SELECT attempts,reset_ms FROM admin_password_recovery_limits WHERE key_hash=?');
 for(const [name,key] of [['requests','request-global'],['ownerRequests','request:bootstrap_admin']]){
  const row=limits.get(hash(key));result[name]={attempts:row&&row.reset_ms>now?row.attempts:0};
 }
 result.links=db.prepare('SELECT COUNT(*) issued,SUM(ready) accepted,SUM(used_ms IS NOT NULL) consumed FROM admin_password_reset_tokens WHERE created_ms>? AND email=?').get(now-2*3600000,email);
 const mails=await get('/emails?limit=30');result.providerReadStatus=mails.status;
 if(mails.status===200){
  const rows=Array.isArray(mails.data?.data)?mails.data.data:[];
  result.recoveryMailEvents=rows.filter(m=>m.subject==='Recuperare parolă ADMIN — NITIDO'&&Array.isArray(m.to)&&m.to.some(x=>x.toLowerCase()===email)&&Date.parse(m.created_at)>now-2*3600000).map(m=>({createdAt:m.created_at,event:['sent','delivered','delivery_delayed','bounced','complained','failed','scheduled','suppressed','opened','clicked'].includes(m.last_event)?m.last_event:'other'}));
 }
 console.log(JSON.stringify(result));
})().catch(()=>{console.log(JSON.stringify({marker:'NITIDO_ADMIN_RECOVERY_DIAG_20261024',error:'DIAGNOSTIC_FAILED'}));process.exitCode=1}).finally(()=>db.close());
