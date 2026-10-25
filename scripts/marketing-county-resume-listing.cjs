// Owner-authorized, narrow repair of a verified HTML parser failure. No email or other-module writes.
const Database=require('better-sqlite3'),{randomUUID}=require('node:crypto');
const site=process.env.NEXT_PUBLIC_SITE_URL;
if(!['https://sandbox.nitido.ro','https://nitido.ro'].includes(site)||process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw Error('ORIGIN_DELIVERY_GUARD');
if(site==='https://nitido.ro'&&process.env.NITIDO_MARKETING_ADMIN_ENABLED!=='true')throw Error('MARKETING_NOT_ENABLED');
const db=new Database('/app/data/nitido.db',{fileMustExist:true});db.pragma('busy_timeout=5000');
try{const result=db.transaction(()=>{
 const j=db.prepare("SELECT * FROM marketing_county_jobs WHERE county_code='CT'").get();if(!j)throw Error('COUNTY_JOB_MISSING');
 if(j.state!=='paused')return {state:j.state,replayed:true};
 const target='https://www.ghidul.ro/firme-afaceri/audit-contabili/constanta/';
 const p=db.prepare("SELECT * FROM marketing_directory_pages WHERE job_id=? AND url=? AND kind='listing' AND state='blocked'").get(j.id,target);
 if(!p||p.reason!=='Catalogul indică mai multe firme decât pagina primită, fără paginare verificabilă.')throw Error('UNREVIEWED_SOURCE_FAILURE');
 if(db.prepare("SELECT 1 FROM marketing_directory_pages WHERE job_id=? AND state='blocked' AND url<>?").get(j.id,target))throw Error('OTHER_SOURCE_FAILURE');
 const at=new Date().toISOString(),host=db.prepare("SELECT next_attempt_at FROM marketing_directory_host WHERE host='https://www.ghidul.ro'").get();
 if(p.next_attempt_at&&p.next_attempt_at>at||host?.next_attempt_at&&host.next_attempt_at>at)throw Error('SOURCE_RETRY_PAUSE_ACTIVE');
 if(j.part_cursor!==JSON.parse(j.manifest).parts.length||db.prepare("SELECT 1 FROM marketing_county_items WHERE job_id=? AND status<>'done'").get(j.id))throw Error('INVENTORY_NOT_READY');
 db.prepare("UPDATE marketing_directory_pages SET state='pending',attempts=0,reason='' WHERE job_id=? AND url=?").run(j.id,target);
 db.prepare("UPDATE marketing_county_jobs SET state='directory',message='',next_attempt_at=NULL,updated_at=? WHERE id=?").run(at,j.id);
 db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),'marketing.county.listing.parser.resumed',j.id,JSON.stringify({actor:'owner-authorized:marketing-county-parser',verifiedHtmlRows:9}));
 return {county:'CT',state:'directory',retriedListings:1};
}).immediate();console.log('MKT_COUNTY_RESUMED '+JSON.stringify({...result,delivery:'blocked'}));}finally{db.close();}
