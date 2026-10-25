// Read-only anonymous frontier aggregates. No identities, domains, URLs or email addresses are logged.
const Database=require('better-sqlite3');
if(!['https://sandbox.nitido.ro','https://nitido.ro'].includes(process.env.NEXT_PUBLIC_SITE_URL))throw Error('ORIGIN_GUARD');
const db=new Database('/app/data/nitido.db',{readonly:true,fileMustExist:true});
try{
 const job=db.prepare("SELECT id,state FROM marketing_county_jobs WHERE county_code='CT'").get();if(!job)throw Error('JOB_MISSING');
 const items=db.prepare("SELECT COUNT(*) count,COUNT(DISTINCT website) websites FROM marketing_county_items WHERE job_id=? AND status='pending'").get(job.id);
 const sites=db.prepare("SELECT DISTINCT website FROM marketing_county_items WHERE job_id=? AND status='pending' AND website<>'' ORDER BY website").all(job.id),aggregates=[];
 for(const [index,site] of sites.entries()){
  const pages=db.prepare('SELECT url,state,reason,found,checked_at FROM marketing_county_web_pages WHERE job_id=? AND website=?').all(job.id,site.website);
  const stats={site:index+1,pages:pages.length,pending:0,done:0,blocked:0,repeatedSegments:0,maxSegments:0,maxLength:0,queryPages:0,duplicateQueryKeys:0,normalizedRepeatedPaths:0,foundEmailOccurrences:0,uniqueEmailCount:0,reasons:{},latestChecked:null};
  const emails=new Set(),normalized=new Set();
  for(const p of pages){
   stats[p.state]++;const u=new URL(p.url),parts=u.pathname.split('/').filter(Boolean),set=new Set(parts.map(x=>x.toLowerCase()));
   if(set.size<parts.length)stats.repeatedSegments++;
   stats.maxSegments=Math.max(stats.maxSegments,parts.length);stats.maxLength=Math.max(stats.maxLength,p.url.length);if(u.search)stats.queryPages++;
   const keys=[...u.searchParams.keys()];if(new Set(keys).size<keys.length)stats.duplicateQueryKeys++;
   normalized.add(u.origin+'/'+[...set].join('/')+u.search);
   const found=JSON.parse(p.found);stats.foundEmailOccurrences+=found.length;for(const f of found)emails.add(f.email);
   if(p.reason)stats.reasons[p.reason]=(stats.reasons[p.reason]??0)+1;
   if(p.checked_at&&(!stats.latestChecked||p.checked_at>stats.latestChecked))stats.latestChecked=p.checked_at;
  }
  stats.normalizedRepeatedPaths=normalized.size;stats.uniqueEmailCount=emails.size;aggregates.push(stats);
 }
 const cycleStops=db.prepare("SELECT COUNT(*) count FROM marketing_county_web_pages WHERE job_id=? AND reason='DUPLICATE_CONTENT_CYCLE'").get(job.id);
 console.log('MKT_FRONTIER_STATUS '+JSON.stringify({cycleStops,county:'CT',state:job.state,items,sites:aggregates,delivery:process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true'?'enabled':'blocked'}));
}finally{db.close();}
