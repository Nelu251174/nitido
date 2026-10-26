// Narrow owner-authorized repair: a verified HTTP 200 profile without identity or access challenge.
const {randomUUID}=require('node:crypto');
function resumeProfileGap(db){return db.transaction(()=>{
 const j=db.prepare("SELECT * FROM marketing_county_jobs WHERE county_code='B'").get();if(!j)throw Error('COUNTY_MISSING');
 if(['collecting','directory','verifying'].includes(j.state))return {county:'B',state:j.state,alreadyActive:true};
 if(j.state!=='paused'||j.message==='Pauză scurtă pentru actualizarea colectării tuturor județelor.')throw Error('COUNTY_NOT_SOURCE_PAUSED');
 const rows=db.prepare("SELECT kind,reason,next_attempt_at FROM marketing_directory_pages WHERE job_id=? AND state='blocked'").all(j.id);
 const reason='Profilul firmei nu poate fi identificat în catalog.';
 if(!rows.length||rows.some(r=>r.kind!=='profile'||r.reason!==reason))throw Error('UNREVIEWED_SOURCE_FAILURE');
 const at=new Date().toISOString(),host=db.prepare("SELECT next_attempt_at FROM marketing_directory_host WHERE host='https://www.ghidul.ro'").get();
 if(rows.some(r=>r.next_attempt_at&&r.next_attempt_at>at)||host?.next_attempt_at&&host.next_attempt_at>at)throw Error('SOURCE_RETRY_PAUSE_ACTIVE');
 const manifest=JSON.parse(j.manifest);if(manifest.countyCode!=='B'||j.part_cursor!==manifest.parts.length)throw Error('INVENTORY_NOT_READY');
 db.prepare("UPDATE marketing_directory_pages SET state='needs_review' WHERE job_id=? AND kind='profile' AND state='blocked' AND reason=?").run(j.id,reason);
 db.prepare("UPDATE marketing_county_jobs SET state='collecting',message='Profilul neidentificabil rămâne de verificat. Colectarea celorlalte pagini permise continuă.',updated_at=? WHERE id=?").run(at,j.id);
 db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),'marketing.county.profile.review.resumed',j.id,JSON.stringify({actor:'owner-authorized:continue-all-counties-20261025',reviewProfiles:rows.length}));
 return {county:'B',state:'collecting',reviewProfiles:rows.length,delivery:'blocked'};
}).immediate();}
module.exports={resumeProfileGap};
if(require.main===module||process.argv[1]===undefined){if(!['https://sandbox.nitido.ro','https://nitido.ro'].includes(process.env.NEXT_PUBLIC_SITE_URL)||process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw Error('ORIGIN_DELIVERY_GUARD');const Database=require('better-sqlite3'),db=new Database('/app/data/nitido.db',{fileMustExist:true});db.pragma('busy_timeout=5000');try{console.log('MKT_PROFILE_GAP_RESUMED '+JSON.stringify(resumeProfileGap(db)));}finally{db.close();}}
