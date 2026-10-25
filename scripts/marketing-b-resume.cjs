// Narrow, owner-authorized replay after verified empty listing labels were fixed.
// Preserves source deadlines, access restrictions, all existing data and the sole scheduler.
const Database=require('better-sqlite3'),{randomUUID}=require('node:crypto');
if(!['https://sandbox.nitido.ro','https://nitido.ro'].includes(process.env.NEXT_PUBLIC_SITE_URL)||process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw Error('ORIGIN_DELIVERY_GUARD');
const db=new Database('/app/data/nitido.db',{fileMustExist:true});db.pragma('busy_timeout=5000');
try{const result=db.transaction(()=>{
 const job=db.prepare("SELECT * FROM marketing_county_jobs WHERE county_code='B'").get();if(!job)throw Error('COUNTY_JOB_MISSING');
 if(job.state!=='paused')return {county:'B',state:job.state,replayed:true};
 const reason='Datele unui rând din catalog sunt incomplete. Colectarea necesită verificare.';
 const pages=db.prepare("SELECT url,next_attempt_at,reason,kind FROM marketing_directory_pages WHERE job_id=? AND state='blocked'").all(job.id);
 if(pages.length!==1||pages[0].kind!=='listing'||pages[0].reason!==reason)throw Error('UNREVIEWED_SOURCE_FAILURE');
 const at=new Date().toISOString(),host=db.prepare("SELECT next_attempt_at FROM marketing_directory_host WHERE host='https://www.ghidul.ro'").get();
 if(pages[0].next_attempt_at&&pages[0].next_attempt_at>at||host?.next_attempt_at&&host.next_attempt_at>at)throw Error('SOURCE_RETRY_PAUSE_ACTIVE');
 const state=db.prepare("SELECT 1 FROM marketing_county_items WHERE job_id=? AND status<>'done' LIMIT 1").get(job.id)?'collecting':'directory';
 db.prepare("UPDATE marketing_directory_pages SET state='pending',attempts=0,reason='' WHERE job_id=? AND url=?").run(job.id,pages[0].url);
 db.prepare("UPDATE marketing_county_jobs SET state=?,message='',updated_at=? WHERE id=?").run(state,at,job.id);
 db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),'marketing.county.empty-label.resumed',job.id,JSON.stringify({actor:'owner-authorized:marketing-parser-repair',listingCount:1}));
 return {county:'B',state,retriedListings:1,delivery:'blocked'};
}).immediate();console.log('MKT_B_RESUMED '+JSON.stringify(result));}finally{db.close();}
