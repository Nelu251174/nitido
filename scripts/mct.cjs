// Owner requested Constanta only; stop Cluj/Iasi collection and ready campaigns.
// No contact export, no message dispatch, no deletion, no change to other regions.
const fs=require('node:fs');
const Database=require('better-sqlite3');
const {randomUUID}=require('node:crypto');
const TARGETS=['CJ','IS'];
const marker='NITIDO_CITY_SCOPE_20261029';
const dir='/app/data/owner-city-scope-20261029';
const key=s=>String(s??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
const code=p=>p.county||({constanta:'CT',cluj:'CJ','cluj-napoca':'CJ',iasi:'IS'})[key(p.city)]||'';
const db=new Database('/app/data/nitido.db',{fileMustExist:true});db.pragma('busy_timeout=5000');
const exists=n=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(n);
function snapshot(){
 const campaigns=exists('marketing_campaigns')?db.prepare('SELECT id,state,version,payload FROM marketing_campaigns').all().map(r=>{const p=JSON.parse(r.payload);return {id:r.id,county:code(p),city:p.city||'',state:r.state,version:r.version};}).filter(r=>['CT',...TARGETS].includes(r.county)):[];
 const counties=exists('marketing_county_jobs')?db.prepare("SELECT id,county_code,state FROM marketing_county_jobs WHERE county_code IN ('CT','CJ','IS')").all():[];
 const ids=campaigns.map(r=>r.id);
 const sends=exists('marketing_outbox')&&ids.length?db.prepare(`SELECT campaign_id,mode,status,COUNT(*) count,SUM(provider_id IS NOT NULL) providerAccepted FROM marketing_outbox WHERE campaign_id IN (${ids.map(()=>'?').join(',')}) GROUP BY campaign_id,mode,status`).all(...ids):[];
 return {campaigns,counties,sends};
}
(async()=>{
 if(process.env.NEXT_PUBLIC_SITE_URL!=='https://nitido.ro')throw Error('WRONG_TARGET');
 fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const checkpoint=dir+'/before.db';if(!fs.existsSync(checkpoint)){await db.backup(checkpoint);fs.chmodSync(checkpoint,0o600);const b=new Database(checkpoint,{readonly:true});if(b.pragma('integrity_check',{simple:true})!=='ok')throw Error('BACKUP_FAILED');b.close();}
 const before=snapshot(),changed={campaigns:0,counties:0};
 db.transaction(()=>{
  for(const r of before.campaigns.filter(r=>TARGETS.includes(r.county)&&r.state==='ready')){
   changed.campaigns+=db.prepare("UPDATE marketing_campaigns SET state='paused',version=version+1,updated_at=? WHERE id=? AND version=? AND state='ready'").run(new Date().toISOString(),r.id,r.version).changes;
   db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),'marketing.campaign.state',r.id,JSON.stringify({actor:'owner-request-20261029',state:'paused',reason:'Constanta requested; Cluj and Iasi unauthorized for this campaign'}));
  }
  if(exists('marketing_county_jobs'))for(const r of before.counties.filter(r=>TARGETS.includes(r.county_code)&&!['completed','review','paused'].includes(r.state))){
   changed.counties+=db.prepare("UPDATE marketing_county_jobs SET state='paused',updated_at=? WHERE id=? AND state=?").run(new Date().toISOString(),r.id,r.state).changes;
   db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),'marketing.county.state',r.id,JSON.stringify({actor:'owner-request-20261029',action:'pause',county:r.county_code,reason:'Constanta requested'}));
  }
 }).immediate();
 const after=snapshot();
 if(after.campaigns.some(r=>TARGETS.includes(r.county)&&r.state==='ready')||after.counties.some(r=>TARGETS.includes(r.county_code)&&!['completed','review','paused'].includes(r.state)))throw Error('PAUSE_VERIFICATION_FAILED');
 const result={marker,status:'passed',changed,before,after,emailsSentByThisTask:0,createdAt:new Date().toISOString()};
 fs.writeFileSync(dir+'/result.json',JSON.stringify(result),{mode:0o600});
 const line=JSON.stringify(result);console.log(line);fs.appendFileSync('/proc/1/fd/1',line+'\n');
})().catch(()=>{console.error(marker+':FAILED');process.exitCode=1;}).finally(()=>db.close());
