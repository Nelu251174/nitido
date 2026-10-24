// Owner-authorized start of the built-in Constanța collection job. No source fetch, messages or credentials.
const Database=require('better-sqlite3'),{randomUUID}=require('node:crypto');
const allowed=['https://nitido.ro','https://sandbox.nitido.ro'];
if(!allowed.includes(process.env.NEXT_PUBLIC_SITE_URL)||process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw Error('MARKETING_ORIGIN_OR_DELIVERY_GUARD');
if(process.env.NEXT_PUBLIC_SITE_URL==='https://nitido.ro'&&process.env.NITIDO_MARKETING_ADMIN_ENABLED!=='true')throw Error('MARKETING_NOT_ENABLED');
const db=new Database('/app/data/nitido.db',{fileMustExist:true});
try{
 const result=db.transaction(()=>{
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE name='marketing_city_jobs'").get())throw Error('CITY_WORKER_NOT_READY');
  const active=db.prepare("SELECT id,city_key,state FROM marketing_city_jobs WHERE state IN ('queued','discovering','collecting','waiting') LIMIT 1").get();
  if(active){if(active.city_key!=='constanta')throw Error('OTHER_CITY_ALREADY_RUNNING');return {jobId:active.id,city:'Constanța',state:active.state,replayed:true};}
  if(db.prepare("SELECT 1 FROM sqlite_master WHERE name='marketing_discovery'").get()&&db.prepare("SELECT 1 FROM marketing_discovery WHERE status IN ('pending','running','cancel_requested')").get())throw Error('OTHER_COLLECTION_ALREADY_RUNNING');
  const id=randomUUID(),time=new Date().toISOString(),actor='owner-authorized:marketing-constanta';
  db.prepare("INSERT INTO marketing_city_jobs(id,city,city_key,state,created_at,updated_at,created_by) VALUES(?,'Constanța','constanta','queued',?,?,?)").run(id,time,time,actor);
  db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),'marketing.city.started',id,JSON.stringify({actor}));
  return {jobId:id,city:'Constanța',state:'queued',replayed:false};
 }).immediate();console.log(JSON.stringify({...result,realMarketingEmailsSent:0,consentAutomaticallyGranted:false}));
}catch(error){console.error(/^[A-Z_]+$/.test(error.message)?error.message:'CITY_START_FAILED');process.exitCode=1;}finally{db.close();}
