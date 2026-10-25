// Owner-authorized preparation of the next counties. No source reads, worker starts, or changes to active counties.
const Database=require('better-sqlite3'),{randomUUID}=require('node:crypto');
if(!['https://sandbox.nitido.ro','https://nitido.ro'].includes(process.env.NEXT_PUBLIC_SITE_URL)||process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw Error('ORIGIN_DELIVERY_GUARD');
const db=new Database('/app/data/nitido.db',{fileMustExist:true});db.pragma('busy_timeout=5000');
try{const result=db.transaction(()=>{
 const current=db.prepare("SELECT county_code,position,state,created_by FROM marketing_county_jobs WHERE county_code IN ('CT','B') ORDER BY position").all();
 if(current.length!==2||current[0].county_code!=='CT'||current[0].position!==0||current[1].county_code!=='B'||current[1].position!==1)throw Error('ACTIVE_PLAN_MISMATCH');
 if(current.every(j=>j.state==='completed'))throw Error('CURRENT_COUNTIES_ALREADY_FINISHED');
 const planned=[{code:'BV',position:9},{code:'IF',position:25}],at=new Date().toISOString(),actor=current[0].created_by;
 for(const p of planned){
  const old=db.prepare('SELECT id,state,position FROM marketing_county_jobs WHERE county_code=?').get(p.code);
  if(old){if(old.state!=='queued'||old.position!==p.position||db.prepare('SELECT 1 FROM marketing_county_dispatch WHERE job_id=? AND independent=1').get(old.id))throw Error('COUNTY_ALREADY_STARTED');continue;}
  const id=randomUUID();db.prepare('INSERT INTO marketing_county_jobs(id,county_code,position,message,created_at,updated_at,created_by) VALUES(?,?,?,?,?,?,?)').run(id,p.code,p.position,'Pregătit în coadă. Va începe după finalizarea Constanței și Bucureștiului.',at,at,actor);
  db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),'marketing.county.queued',id,JSON.stringify({actor:'owner-authorized:brasov-ilfov-after-ct-b',after:['CT','B']}));
 }
 return {counties:planned.map(p=>p.code),state:'queued',after:['CT','B'],delivery:'blocked'};
}).immediate();console.log('MKT_NEXT_COUNTIES '+JSON.stringify(result));}finally{db.close();}
