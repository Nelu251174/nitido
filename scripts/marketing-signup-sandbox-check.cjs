// Exact pending fixture cleanup after the public sandbox form check. Never used on LIVE.
const Database=require('better-sqlite3');
if(process.env.NEXT_PUBLIC_SITE_URL!=='https://sandbox.nitido.ro'||process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw Error('SANDBOX_DELIVERY_GUARD');
const db=new Database('/app/data/nitido.db',{fileMustExist:true});db.pragma('busy_timeout=5000');
try{const result=db.transaction(()=>{
 const email='marketing-e2e-20261025-0849@nitido.ro';
 const row=db.prepare("SELECT state,category,county_code,contact_id,confirmation_hash FROM marketing_signups WHERE email=? AND name='TEST Marketing Sandbox'").get(email);
 if(!row||row.state!=='pending'||row.category!=='individual'||row.county_code!=='CT'||row.contact_id||row.confirmation_hash)throw Error('PENDING_FIXTURE_INVALID');
 if(db.prepare('SELECT 1 FROM marketing_contacts WHERE email=?').get(email))throw Error('FIXTURE_CONTACT_CREATED');
 const deleted=db.prepare("DELETE FROM marketing_signups WHERE email=? AND name='TEST Marketing Sandbox' AND state='pending' AND contact_id IS NULL AND confirmation_hash IS NULL").run(email).changes;
 return {receivedPending:true,contactCreated:false,confirmationTokenCreated:false,fixtureRemoved:deleted===1,remainingSignups:db.prepare('SELECT COUNT(*) n FROM marketing_signups').get().n,delivery:'blocked'};
}).immediate();console.log('MKT_SIGNUP_SANDBOX_CHECK '+JSON.stringify(result));}finally{db.close();}
