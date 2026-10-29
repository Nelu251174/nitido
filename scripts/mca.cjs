// Explicit owner correction: keep CT, CJ, IS and B active together.
// Restore only campaign states paused by mct.cjs. No new message queue or dispatch.
const {randomUUID}=require('node:crypto');
const CODES=['CT','CJ','IS','B'],TERMINAL=['completed','review'];
function applyCityActivation(db,prior,at=new Date().toISOString()){
 if(prior?.marker!=='NITIDO_CITY_SCOPE_20261029'||prior.status!=='passed')throw Error('PRIOR_CORRECTION_NOT_VERIFIED');
 return db.transaction(()=>{
  const result={restoredCampaigns:0,resumedCollections:0,activatedCollections:0,cities:[],newMailRuns:0};
  const audit=(action,id,details)=>db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),action,id,JSON.stringify({actor:'owner-corrected-scope-20261029',...details}));
  for(const old of prior.before.campaigns.filter(c=>['CJ','IS'].includes(c.county)&&c.state==='ready')){
   const paused=prior.after.campaigns.find(c=>c.id===old.id),current=db.prepare('SELECT state,version FROM marketing_campaigns WHERE id=?').get(old.id);
   if(!current||!paused||paused.state!=='paused')throw Error('CAMPAIGN_RECOVERY_RECORD_MISSING');
   if(current.state==='ready')continue;
   if(current.state!=='paused'||current.version!==paused.version)throw Error('CAMPAIGN_CHANGED_AFTER_PAUSE');
   db.prepare("UPDATE marketing_campaigns SET state='ready',version=version+1,updated_at=? WHERE id=? AND state='paused' AND version=?").run(at,old.id,paused.version);
   audit('marketing.campaign.state',old.id,{state:'ready',reason:'Restore campaign paused after an incorrect scope interpretation'});result.restoredCampaigns++;
  }
  for(const code of CODES){
   let job=db.prepare('SELECT * FROM marketing_county_jobs WHERE county_code=?').get(code);
   if(!job){const id=randomUUID(),position=code==='CT'?0:code==='B'?1:db.prepare('SELECT COALESCE(MAX(position),1)+1 n FROM marketing_county_jobs').get().n;
    db.prepare("INSERT INTO marketing_county_jobs(id,county_code,position,state,created_at,updated_at,created_by) VALUES(?,?,?,'queued',?,?,?)").run(id,code,position,at,at,'owner-corrected-scope-20261029');
    audit('marketing.county.queued',id,{county:code});job=db.prepare('SELECT * FROM marketing_county_jobs WHERE id=?').get(id);
   }
   if(job.state==='paused'){
    const original=prior.before.counties.find(c=>c.id===job.id&&c.county_code===code);
    const state=original&&['queued','preparing','importing','collecting'].includes(original.state)?original.state:job.manifest?'importing':'queued';
    // Preserve source cooldowns, cursors and data already collected.
    db.prepare('UPDATE marketing_county_jobs SET state=?,updated_at=? WHERE id=?').run(state,at,job.id);
    audit('marketing.county.resume',job.id,{county:code,sourceDeadlinePreserved:true});result.resumedCollections++;
    job={...job,state};
   }
   if(!TERMINAL.includes(job.state)){
    const independent=db.prepare('SELECT independent FROM marketing_county_dispatch WHERE job_id=?').get(job.id);
    if(!independent?.independent){
     db.prepare('INSERT INTO marketing_county_dispatch(job_id,independent) VALUES(?,1) ON CONFLICT(job_id) DO UPDATE SET independent=1').run(job.id);
     audit('marketing.county.activate',job.id,{county:code});result.activatedCollections++;
    }
   }
   const actual=db.prepare('SELECT county_code,state,next_attempt_at FROM marketing_county_jobs WHERE id=?').get(job.id);
   if(actual.state==='paused'||(!TERMINAL.includes(actual.state)&&!db.prepare('SELECT 1 FROM marketing_county_dispatch WHERE job_id=? AND independent=1').get(job.id)))throw Error('CITY_ACTIVATION_NOT_CONFIRMED');
   result.cities.push(actual);
  }
  return result;
 }).immediate();
}
module.exports={applyCityActivation};
if(process.env.NITIDO_CITY_CORRECTION_TEST!=='true'){
 const fs=require('node:fs'),Database=require('better-sqlite3');
 (async()=>{
  if(process.env.NEXT_PUBLIC_SITE_URL!=='https://nitido.ro')throw Error('WRONG_TARGET');
  const dir='/app/data/owner-city-reactivation-20261029';fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const db=new Database('/app/data/nitido.db',{fileMustExist:true});db.pragma('busy_timeout=5000');
  try{
   const backup=dir+'/before.db';if(!fs.existsSync(backup)){await db.backup(backup);fs.chmodSync(backup,0o600);const restored=new Database(backup,{readonly:true});try{if(restored.pragma('integrity_check',{simple:true})!=='ok')throw Error('BACKUP_FAILED');}finally{restored.close();}}
   const prior=JSON.parse(fs.readFileSync('/app/data/owner-city-scope-20261029/result.json','utf8'));
   const result={marker:'NITIDO_CITIES_REACTIVATED_20261029',status:'passed',...applyCityActivation(db,prior),createdAt:new Date().toISOString()};
   fs.writeFileSync(dir+'/result.json',JSON.stringify(result),{mode:0o600});console.log(JSON.stringify(result));
  }finally{db.close();}
 })().catch(e=>{console.error(/^[A-Z_]+$/.test(e.message)?e.message:'CITY_REACTIVATION_FAILED');process.exitCode=1;});
}
