// Read-only county/category funnel. Never logs contact identities, domains, URLs or emails.
const Database=require('better-sqlite3');
if(!['https://sandbox.nitido.ro','https://nitido.ro'].includes(process.env.NEXT_PUBLIC_SITE_URL))throw Error('ORIGIN_GUARD');
const db=new Database('/app/data/nitido.db',{readonly:true,fileMustExist:true});
try{
 const jobs=db.prepare("SELECT id,county_code,state FROM marketing_county_jobs WHERE county_code IN ('CT','B') ORDER BY position").all().map(j=>({county:j.county_code,state:j.state,
 contacts:db.prepare("SELECT c.category,COUNT(DISTINCT c.id) contacts,COUNT(DISTINCT NULLIF(c.email,'')) emails,COUNT(DISTINCT CASE WHEN c.email='' THEN c.id END) withoutEmail,COUNT(DISTINCT CASE WHEN e.status='verified' THEN c.email END) verified FROM marketing_contacts c JOIN marketing_contact_regions r ON r.contact_id=c.id LEFT JOIN marketing_email_checks e ON e.email=c.email WHERE r.county_key=? GROUP BY c.category").all(j.county_code==='B'?'bucuresti':'constanta'),
 inventory:db.prepare("SELECT category,status,COUNT(*) count,COALESCE(SUM(website<>''),0) websites,COALESCE(SUM(emails<>'[]'),0) sourceEmails FROM marketing_county_items WHERE job_id=? GROUP BY category,status").all(j.id),
 directory:db.prepare("SELECT kind,state,CASE WHEN url LIKE '%/curatenie-servicii/%' OR parent LIKE '%/curatenie-servicii/%' THEN 'cleaning' ELSE 'other' END audience,COUNT(*) count FROM marketing_directory_pages WHERE job_id=? GROUP BY 1,2,3").all(j.id),
 checks:db.prepare("SELECT e.status,COUNT(DISTINCT e.email) count FROM marketing_email_checks e JOIN marketing_county_item_emails x ON x.email=e.email JOIN marketing_county_items i ON i.id=x.item_id WHERE i.job_id=? GROUP BY 1").all(j.id)
 }));
 const host=db.prepare("SELECT next_attempt_at,robots FROM marketing_directory_host WHERE host='https://www.ghidul.ro'").get();
 console.log('MKT_FUNNEL_STATUS '+JSON.stringify({jobs,directoryHost:{waiting:!!host?.next_attempt_at&&host.next_attempt_at>new Date().toISOString(),crawlDelay:Math.max(3,...[...(host?.robots??'').matchAll(/^\s*crawl-delay\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*$/gim)].map(m=>Number(m[1])))},delivery:process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true'?'enabled':'blocked'}));
}finally{db.close();}
