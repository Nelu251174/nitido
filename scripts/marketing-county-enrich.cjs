// Explicit owner-authorized county website review. Reuses the application's sole worker and existing evidence.
const Database=require('better-sqlite3'),{randomUUID}=require('node:crypto');
const site=process.env.NEXT_PUBLIC_SITE_URL;
if(!['https://sandbox.nitido.ro','https://nitido.ro'].includes(site)||process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw Error('ORIGIN_DELIVERY_GUARD');
if(site==='https://nitido.ro'&&process.env.NITIDO_MARKETING_ADMIN_ENABLED!=='true')throw Error('MARKETING_NOT_ENABLED');
const db=new Database('/app/data/nitido.db',{fileMustExist:true});db.pragma('busy_timeout=5000');
try{const result=db.transaction(()=>{
 const job=db.prepare("SELECT * FROM marketing_county_jobs WHERE county_code='CT'").get();if(!job)throw Error('JOB_MISSING');
 if(job.state==='collecting'&&(job.message==='Verificarea paginilor publice de contact continuă din progresul salvat.'||db.prepare('SELECT 1 FROM marketing_county_web_pages WHERE job_id=?').get(job.id)))return {state:job.state,replayed:true};
 if(job.state!=='review')throw Error('COUNTY_NOT_IN_REVIEW');
 if(db.prepare("SELECT 1 FROM marketing_directory_pages WHERE job_id=? AND state<>'done'").get(job.id))throw Error('DIRECTORY_INCOMPLETE');
 const columns=db.prepare('PRAGMA table_info(marketing_county_items)').all();if(!columns.some(c=>c.name==='attempted_at')||!columns.some(c=>c.name==='next_attempt_at'))throw Error('REVIEW_WORKER_NOT_READY');
 const websites=db.prepare("UPDATE marketing_county_items SET status='pending',attempted_at='',next_attempt_at=NULL WHERE job_id=? AND website<>''").run(job.id).changes;
 const emailChecks=db.prepare("UPDATE marketing_email_checks SET status='pending',attempts=0,next_attempt_at=NULL WHERE source_status='verified' AND ((status='needs_review' AND domain_status='temporary') OR (status='verified' AND (email LIKE '.%' OR email LIKE '%..%@%' OR email LIKE '%.@%'))) AND EXISTS(SELECT 1 FROM marketing_county_item_emails x JOIN marketing_county_items i ON i.id=x.item_id WHERE x.email=marketing_email_checks.email AND i.job_id=?)").run(job.id).changes;
 db.prepare("UPDATE marketing_county_jobs SET state='collecting',next_attempt_at=NULL,message='Verificarea paginilor publice de contact continuă din progresul salvat.',updated_at=? WHERE id=?").run(new Date().toISOString(),job.id);
 db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),'marketing.county.website.review.started',job.id,JSON.stringify({actor:'owner-authorized:marketing-county-review',websites,emailChecks}));return {county:'CT',websites,emailChecks,state:'collecting'};
}).immediate();console.log('MKT_COUNTY_WEB_REVIEW '+JSON.stringify({...result,delivery:'blocked'}));}finally{db.close();}
