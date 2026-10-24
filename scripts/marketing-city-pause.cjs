// Pause only the sandbox Constanța collector for an authorized Marketing deployment.
if(process.env.NEXT_PUBLIC_SITE_URL!=='https://sandbox.nitido.ro'||process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw Error('SANDBOX_MARKETING_GUARD');
const Database=require('better-sqlite3'),{randomUUID}=require('node:crypto');
const db=new Database('/app/data/nitido.db',{fileMustExist:true});
try{
 const state=db.transaction(()=>{
  const job=db.prepare("SELECT id,state FROM marketing_city_jobs WHERE city_key='constanta' ORDER BY created_at DESC LIMIT 1").get();
  if(!job)return 'absent';
  if(['queued','discovering','collecting','waiting'].includes(job.state)){
   db.prepare("UPDATE marketing_city_jobs SET state='paused',updated_at=? WHERE id=?").run(new Date().toISOString(),job.id);
   db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),'marketing.city.pause',job.id,JSON.stringify({actor:'owner-authorized:marketing-source-release'}));return 'paused';
  }
  return job.state;
 }).immediate();
 const lock=db.prepare('SELECT until_ms FROM marketing_collection_lock WHERE id=1').get();
 console.log(JSON.stringify({state,collector:lock&&lock.until_ms>Date.now()?'busy':'idle',delivery:'blocked'}));
}finally{db.close();}
