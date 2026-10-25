// Sandbox-only checkpoint of Marketing's existing worker for a reviewed deployment.
const Database=require('better-sqlite3'),{randomUUID}=require('node:crypto');
if(process.env.NEXT_PUBLIC_SITE_URL!=='https://sandbox.nitido.ro'||process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw Error('SANDBOX_DELIVERY_GUARD');
const db=new Database('/app/data/nitido.db',{fileMustExist:true}),marker='Pauză pentru publicarea verificării paginilor de contact.';
try{const result=db.transaction(()=>{
 const j=db.prepare("SELECT id,state,message FROM marketing_county_jobs WHERE county_code='CT'").get();if(!j)throw Error('JOB_MISSING');
 const resume=process.argv.includes('--resume');
 if(resume){if(j.state!=='paused'||j.message!==marker)throw Error('NOT_DEPLOYMENT_CHECKPOINT');db.prepare("UPDATE marketing_county_jobs SET state='collecting',message='Verificarea paginilor publice de contact continuă din progresul salvat.',updated_at=? WHERE id=?").run(new Date().toISOString(),j.id);}
 else{if(j.state!=='collecting')throw Error('NOT_COLLECTING');db.prepare("UPDATE marketing_county_jobs SET state='paused',message=?,updated_at=? WHERE id=?").run(marker,new Date().toISOString(),j.id);}
 db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),resume?'marketing.county.website.deployment.resumed':'marketing.county.website.deployment.paused',j.id,JSON.stringify({actor:'owner-authorized:marketing-county-review'}));return {state:resume?'collecting':'paused',delivery:'blocked'};
}).immediate();console.log('MKT_REVIEW_CHECKPOINT '+JSON.stringify(result));}finally{db.close();}
