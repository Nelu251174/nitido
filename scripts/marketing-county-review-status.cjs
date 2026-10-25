// Read-only review aggregates. No contact identities, addresses, URLs, or credentials are logged.
const Database=require('better-sqlite3');
if(!['https://sandbox.nitido.ro','https://nitido.ro'].includes(process.env.NEXT_PUBLIC_SITE_URL))throw Error('ORIGIN_GUARD');
const db=new Database('/app/data/nitido.db',{readonly:true,fileMustExist:true});
try{
 const job=db.prepare("SELECT id,state,total FROM marketing_county_jobs WHERE county_code='CT'").get();if(!job)throw Error('JOB_MISSING');
 const sources=db.prepare("SELECT CASE WHEN identity LIKE 'osm:%' THEN 'osm' ELSE 'directory' END source,COUNT(*) count,SUM(website<>'') withWebsite,SUM(json_array_length(emails)>0) suppliedEmail,SUM(warning<>'') warnings FROM marketing_county_items WHERE job_id=? GROUP BY 1").all(job.id);
 const sites=db.prepare("SELECT warning,COUNT(*) count,SUM(json_array_length(result)) foundEmails FROM marketing_county_sites WHERE job_id=? GROUP BY warning").all(job.id);
 const emailChecks=db.prepare("SELECT e.status,e.domain_status,e.reason,COUNT(DISTINCT e.email) count FROM marketing_email_checks e JOIN marketing_county_item_emails x ON x.email=e.email JOIN marketing_county_items i ON i.id=x.item_id WHERE i.job_id=? GROUP BY e.status,e.domain_status,e.reason").all(job.id);
 const hostKinds=db.prepare("SELECT CASE WHEN website LIKE '%whatsapp.%' OR website LIKE '%wa.me/%' THEN 'messaging' WHEN website LIKE '%facebook.%' OR website LIKE '%instagram.%' THEN 'social' WHEN website LIKE '%google.%' OR website LIKE '%maps.%' THEN 'map' ELSE 'other' END kind,COUNT(DISTINCT website) count FROM marketing_county_items WHERE job_id=? AND website<>'' GROUP BY 1").all(job.id);
 const webPages=db.prepare("SELECT 1 FROM sqlite_master WHERE name='marketing_county_web_pages'").get()?db.prepare('SELECT state,reason,COUNT(*) count FROM marketing_county_web_pages WHERE job_id=? GROUP BY state,reason').all(job.id):[];
 const webHosts=db.prepare("SELECT 1 FROM sqlite_master WHERE name='marketing_county_web_hosts'").get()?db.prepare('SELECT robots_state,reason,COUNT(*) count FROM marketing_county_web_hosts GROUP BY robots_state,reason').all():[];
 console.log('MKT_REVIEW_STATUS '+JSON.stringify({state:job.state,total:job.total,sources,sites,emailChecks,hostKinds,webPages,webHosts,delivery:process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true'?'enabled':'blocked'}));
}finally{db.close();}
