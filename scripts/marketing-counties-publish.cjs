// Short, owner-authorized Marketing deployment pause. Stores only job state in the existing audit table.
const Database=require('better-sqlite3'),{randomUUID}=require('node:crypto');
if(!['https://sandbox.nitido.ro','https://nitido.ro'].includes(process.env.NEXT_PUBLIC_SITE_URL)||process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw Error('ORIGIN_DELIVERY_GUARD');
const db=new Database('/app/data/nitido.db',{fileMustExist:true});db.pragma('busy_timeout=5000');
const marker='Pauză scurtă pentru actualizarea afișării progresului Market.',resume=process.argv.includes('--resume');
try{const result=db.transaction(()=>{
 const jobs=db.prepare("SELECT id,county_code,state,message FROM marketing_county_jobs WHERE county_code IN ('CT','B')").all(),changed=[];
 for(const j of jobs){
  if(resume){
   if(j.state!=='paused'||j.message!==marker)continue;
   const saved=db.prepare("SELECT details FROM admin_audit_log WHERE target_id=? AND action='marketing.county.progress.publish.paused' ORDER BY rowid DESC LIMIT 1").get(j.id);if(!saved)throw Error('SAVED_STATE_MISSING');
   const prior=JSON.parse(saved.details);if(!['queued','importing','collecting','directory','verifying'].includes(prior.state))throw Error('SAVED_STATE_INVALID');
   db.prepare('UPDATE marketing_county_jobs SET state=?,message=?,updated_at=? WHERE id=?').run(prior.state,prior.message,new Date().toISOString(),j.id);
   db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),'marketing.county.progress.publish.resumed',j.id,JSON.stringify({actor:'owner-authorized:marketing-progress-display'}));
  }else{
   if(j.state==='preparing')throw Error('SOURCE_STILL_PREPARING');
   if(['paused','review','completed'].includes(j.state))continue;
   if(!['queued','importing','collecting','directory','verifying'].includes(j.state))throw Error('JOB_STATE_INVALID');
   db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),'marketing.county.progress.publish.paused',j.id,JSON.stringify({actor:'owner-authorized:marketing-progress-display',state:j.state,message:j.message}));
   db.prepare("UPDATE marketing_county_jobs SET state='paused',message=?,updated_at=? WHERE id=?").run(marker,new Date().toISOString(),j.id);
  }
  changed.push(j.county_code);
 }
 return {action:resume?'resumed':'paused',counties:changed,delivery:'blocked'};
}).immediate();console.log('MKT_PROGRESS_PUBLISH '+JSON.stringify(result));}finally{db.close();}
