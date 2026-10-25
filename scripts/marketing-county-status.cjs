// Read-only aggregates; no application initialization, email addresses, or message transport.
const Database=require('better-sqlite3'),fs=require('node:fs');
const scope={'https://nitido.ro':'live','https://sandbox.nitido.ro':'sandbox'}[process.env.NEXT_PUBLIC_SITE_URL];if(!scope)throw Error('ORIGIN_GUARD');
const db=new Database('/app/data/nitido.db',{readonly:true,fileMustExist:true});
try{
 const exists=name=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
 const jobs=exists('marketing_county_jobs')?db.prepare('SELECT id,county_code,state,total,part_cursor,message,updated_at,next_attempt_at FROM marketing_county_jobs ORDER BY position').all().map(j=>{
  const inventory=db.prepare("SELECT COUNT(*) inventory,COALESCE(SUM(status='done'),0) processed,COALESCE(SUM(warning<>''),0) warnings FROM marketing_county_items WHERE job_id=?").get(j.id);
  const emails=db.prepare("SELECT e.status,COUNT(DISTINCT e.email) count FROM marketing_email_checks e JOIN marketing_county_item_emails x ON x.email=e.email JOIN marketing_county_items i ON i.id=x.item_id WHERE i.job_id=? GROUP BY e.status").all(j.id);
  const directory=exists('marketing_directory_pages')?db.prepare("SELECT kind,state,COUNT(*) count FROM marketing_directory_pages WHERE job_id=? GROUP BY kind,state").all(j.id):[];
  const sourceIssues=exists('marketing_directory_pages')?db.prepare("SELECT kind,reason,COUNT(*) count FROM marketing_directory_pages WHERE job_id=? AND reason<>'' GROUP BY kind,reason").all(j.id):[];
  const dispatch=exists('marketing_county_dispatch')?db.prepare('SELECT independent,last_turn FROM marketing_county_dispatch WHERE job_id=?').get(j.id):null;
  return {dispatch,directory,sourceIssues,...Object.fromEntries(Object.entries(j).filter(([k])=>k!=='id')),...inventory,emails};
 }):[];
 const sourcePreparation=exists('marketing_county_source_lock')?db.prepare('SELECT j.county_code county,s.until_ms untilMs FROM marketing_county_source_lock s JOIN marketing_county_jobs j ON j.id=s.job_id WHERE s.until_ms>?').get(Date.now())??null:null;
 const collector=exists('marketing_collection_lock')&&db.prepare('SELECT 1 FROM marketing_collection_lock WHERE until_ms>?').get(Date.now())?'busy':'idle';
 console.log('MKT_COUNTY_STATUS '+JSON.stringify({scope,collector,sourcePreparation,buildId:fs.readFileSync('/app/.next/BUILD_ID','utf8').trim(),delivery:process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true'?'enabled':'blocked',jobs,outbox:exists('marketing_outbox')?db.prepare('SELECT mode,status,COUNT(*) count FROM marketing_outbox GROUP BY mode,status').all():[]}));
}finally{db.close();}
