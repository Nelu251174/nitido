// Explicit owner-authorized Marketing plan: whole Constanța county, followed by București.
const Database=require('better-sqlite3'),{randomUUID}=require('node:crypto');
const site=process.env.NEXT_PUBLIC_SITE_URL;
if(!['https://nitido.ro','https://sandbox.nitido.ro'].includes(site)||process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw Error('MARKETING_ORIGIN_OR_DELIVERY_GUARD');
if(site==='https://nitido.ro'&&process.env.NITIDO_MARKETING_ADMIN_ENABLED!=='true')throw Error('MARKETING_NOT_ENABLED');
const db=new Database('/app/data/nitido.db',{fileMustExist:true});db.pragma('busy_timeout=5000');
try{const result=db.transaction(()=>{
 if(!db.prepare("SELECT 1 FROM sqlite_master WHERE name='marketing_county_jobs'").get())throw Error('COUNTY_WORKER_NOT_READY');
 const actor='owner-authorized:marketing-counties',time=new Date().toISOString();
 for(const [code,position] of [['CT',0],['B',1]]){const id=randomUUID();const inserted=db.prepare('INSERT OR IGNORE INTO marketing_county_jobs(id,county_code,position,created_at,updated_at,created_by) VALUES(?,?,?,?,?,?)').run(id,code,position,time,time,actor).changes;if(inserted)db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),'marketing.county.queued',id,JSON.stringify({actor}));}
 return db.prepare('SELECT county_code,state,total FROM marketing_county_jobs ORDER BY position').all();
}).immediate();console.log('MKT_COUNTY_PLAN '+JSON.stringify({jobs:result,delivery:'blocked'}));}finally{db.close();}
