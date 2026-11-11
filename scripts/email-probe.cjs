const Database=require('better-sqlite3');
const target='nelutofan@gmail.com';
(async()=>{
 const output={scope:'Read-only NITIDO email diagnosis; no messages sent, no account/token changes',configuration:{keyPresent:Boolean(process.env.RESEND_API_KEY),senderPresent:Boolean(process.env.RESEND_FROM)}};
 try{const site=new URL(process.env.NEXT_PUBLIC_SITE_URL||'');output.configuration.siteHttps=site.protocol==='https:';output.configuration.siteHostMatches=site.hostname==='nitido.ro'}catch{output.configuration.siteHttps=false;output.configuration.siteHostMatches=false}
 const senderDomain=(process.env.RESEND_FROM||'').match(/@([A-Za-z0-9.-]+)/)?.[1]?.toLowerCase()||null;output.configuration.senderDomain=senderDomain;
 const db=new Database('/app/data/nitido.db',{readonly:true,fileMustExist:true});
 const removed=Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='admin_removed_accounts'").get());
 const u=db.prepare(`SELECT id,role,created_at FROM users WHERE email=? COLLATE NOCASE ${removed?'AND NOT EXISTS(SELECT 1 FROM admin_removed_accounts r WHERE r.user_id=users.id)':''} ORDER BY created_at DESC LIMIT 1`).get(target);
 output.account={found:Boolean(u),...(u?{role:u.role,createdAt:u.created_at}:{})};
 if(u){const v=db.prepare('SELECT expires_at,verified_at,token_hash IS NOT NULL AS tokenPresent,email=? AS emailMatches FROM email_verifications WHERE user_id=?').get(target,u.id);output.verification={recordExists:Boolean(v),...(v?{verified:Boolean(v.verified_at),tokenPresent:Boolean(v.tokenPresent),emailMatches:Boolean(v.emailMatches),expiresInFuture:Number(v.expires_at)>Date.now()}:{})};const owner=db.prepare('SELECT email_status,last_error FROM admin_owner_events WHERE user_id=? ORDER BY created_ms DESC LIMIT 1').get(u.id);output.ownerNotification=owner?{status:owner.email_status,error:/^[A-Z0-9_]{1,80}$/.test(owner.last_error||'')?owner.last_error:null}:null}
 const holdExists=Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='marketing_provider_hold'").get());
 if(holdExists){const h=db.prepare('SELECT code,retry_at,updated_at FROM marketing_provider_hold WHERE id=1').get();output.providerHold=h?{code:/^[a-z_]{1,80}$/.test(h.code||'')?h.code:null,retryAt:h.retry_at,updatedAt:h.updated_at}:null}
 const indexes=db.pragma('index_list(email_verifications)');output.verificationSchema={uniqueEmail:indexes.some(i=>i.unique&&db.pragma('index_info("'+i.name.replaceAll('"','""')+'")').some(c=>c.name==='email'))};
 db.close();
 if(output.configuration.keyPresent){
  try{const r=await fetch('https://api.resend.com/domains',{headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY},signal:AbortSignal.timeout(8000)});output.senderDomainRead={http:r.status};if(r.ok){const d=await r.json();output.senderDomainRead.matches=(d.data||[]).filter(v=>v.name===senderDomain).map(v=>({domain:v.name,status:v.status}))}}catch{output.senderDomainRead={transportError:true}}

  try{
   const response=await fetch('https://api.resend.com/emails?limit=30',{headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY},signal:AbortSignal.timeout(10000)});output.providerRead={http:response.status};
   if(response.ok){const value=await response.json();output.providerRead.hasMore=Boolean(value.has_more);output.providerRead.matchingVerificationMessages=(value.data||[]).filter(m=>{const to=Array.isArray(m.to)?m.to:[m.to];return to.some(v=>typeof v==='string'&&v.toLowerCase()===target)&&typeof m.subject==='string'&&/N[IÍ]TIDO.*confirm/i.test(m.subject)}).map(m=>({createdAt:m.created_at,event:typeof m.last_event==='string'&&/^[a-z_]+$/.test(m.last_event)?m.last_event:null}));}
  }catch{output.providerRead={transportError:true}}
 }
 console.log(JSON.stringify(output));
})().catch(()=>{console.log(JSON.stringify({scope:'read-only diagnosis',error:'DIAGNOSTIC_FAILED'}));process.exitCode=1});
