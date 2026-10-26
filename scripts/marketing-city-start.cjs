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
  const time=new Date().toISOString(),actor='owner-authorized:marketing-constanta';
  const paused=db.prepare("SELECT id,total,next_attempt_at FROM marketing_city_jobs WHERE city_key='constanta' AND state='paused' ORDER BY created_at DESC LIMIT 1").get();
  if(paused?.next_attempt_at&&paused.next_attempt_at>time)throw Error('SOURCE_RETRY_PAUSE_ACTIVE');
  if(paused){db.prepare("UPDATE marketing_city_jobs SET state=?,message='',next_attempt_at=NULL,attempts=0,updated_at=? WHERE id=?").run(paused.total?'collecting':'queued',time,paused.id);db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),'marketing.city.resumed',paused.id,JSON.stringify({actor}));return {jobId:paused.id,city:'Constanța',state:paused.total?'collecting':'queued',resumed:true};}
  const id=randomUUID();
  db.prepare("INSERT INTO marketing_city_jobs(id,city,city_key,state,created_at,updated_at,created_by) VALUES(?,'Constanța','constanta','queued',?,?,?)").run(id,time,time,actor);
  db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),'marketing.city.started',id,JSON.stringify({actor}));
  return {jobId:id,city:'Constanța',state:'queued',replayed:false};
 }).immediate();console.log(JSON.stringify({...result,realMarketingEmailsSent:0,consentAutomaticallyGranted:false}));
}catch(error){console.error(/^[A-Z_]+$/.test(error.message)?error.message:'CITY_START_FAILED');process.exitCode=1;}finally{db.close();}
