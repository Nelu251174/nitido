// Owner explicitly activated all five planned counties on 2026-10-25.
// Uses the existing scheduler only; never starts a concurrent worker or changes contact consent.
const {randomUUID}=require('node:crypto');
const CODES=['BV','IF','CJ','IS','TM'];
function activatePlanned(db){return db.transaction(()=>{
 const jobs=db.prepare(`SELECT id,county_code,state FROM marketing_county_jobs WHERE county_code IN (${CODES.map(()=>'?').join(',')})`).all(...CODES);
 if(jobs.length!==CODES.length)throw Error('PLANNED_COUNTIES_MISSING');
 if(jobs.some(j=>!['queued','preparing','importing','collecting','directory','verifying'].includes(j.state)))throw Error('COUNTY_REQUIRES_REVIEW');
 const activated=[],alreadyActive=[],at=new Date().toISOString();
 for(const code of CODES){const j=jobs.find(j=>j.county_code===code),d=db.prepare('SELECT independent FROM marketing_county_dispatch WHERE job_id=?').get(j.id);
  if(d?.independent===1){alreadyActive.push(code);continue;}
  if(j.state!=='queued')throw Error('COUNTY_STATE_CHANGED');
  db.prepare('INSERT INTO marketing_county_dispatch(job_id,independent) VALUES(?,1) ON CONFLICT(job_id) DO UPDATE SET independent=1').run(j.id);
  db.prepare('UPDATE marketing_county_jobs SET message=?,updated_at=? WHERE id=?').run('Pornire separată autorizată pentru toate județele pregătite. Procesarea continuă în ture, fără a aștepta finalizarea CT/B.',at,j.id);
  db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),'marketing.county.activate',j.id,JSON.stringify({actor:'owner-authorized:activate-all-planned-20261025',county:code}));activated.push(code);
 }
 return {activated,alreadyActive,delivery:'blocked',scheduler:'existing-exclusive'};
}).immediate();}
module.exports={activatePlanned};
if(require.main===module||process.argv[1]===undefined){
 if(!['https://sandbox.nitido.ro','https://nitido.ro'].includes(process.env.NEXT_PUBLIC_SITE_URL)||process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw Error('ORIGIN_DELIVERY_GUARD');
 const Database=require('better-sqlite3'),db=new Database('/app/data/nitido.db',{fileMustExist:true});db.pragma('busy_timeout=5000');try{console.log('MKT_ALL_COUNTIES_ACTIVATED '+JSON.stringify(activatePlanned(db)));}finally{db.close();}
}
