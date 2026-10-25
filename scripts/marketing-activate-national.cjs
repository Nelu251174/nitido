// Owner-authorized activation of Romania's 41 counties and București.
// Changes only Marketing queue/dispatch/audit rows; the existing scheduler does the collection.
const {randomUUID}=require('node:crypto');
const CODES=['CT','B','AB','AR','AG','BC','BH','BN','BT','BV','BR','BZ','CS','CL','CJ','CV','DB','DJ','GL','GR','GJ','HR','HD','IL','IS','IF','MM','MH','MS','NT','OT','PH','SM','SJ','SB','SV','TR','TM','TL','VS','VL','VN'];
const STATES=['queued','preparing','importing','collecting','directory','verifying','paused','review','completed'];
const ACTOR='owner-authorized:activate-national-20261025';
function activateNational(db){return db.transaction(()=>{
 const jobs=db.prepare('SELECT id,county_code,position,state FROM marketing_county_jobs').all();
 if(jobs.some(j=>!CODES.includes(j.county_code)||!STATES.includes(j.state)))throw Error('UNRECOGNIZED_COUNTY_PLAN');
 let position=Math.max(-1,...jobs.map(j=>j.position))+1;
 const at=new Date().toISOString(),created=[],activated=[],alreadyActive=[],held=[];
 const audit=(action,id,code)=>db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),action,id,JSON.stringify({actor:ACTOR,county:code}));
 for(const code of CODES){
  let j=jobs.find(j=>j.county_code===code);
  if(!j){
   j={id:randomUUID(),county_code:code,position:position++,state:'queued'};
   db.prepare('INSERT INTO marketing_county_jobs(id,county_code,position,created_at,updated_at,created_by) VALUES(?,?,?,?,?,?)').run(j.id,code,j.position,at,at,ACTOR);
   audit('marketing.county.queued',j.id,code);created.push(code);
  }
  const dispatch=db.prepare('SELECT independent FROM marketing_county_dispatch WHERE job_id=?').get(j.id);
  if(dispatch?.independent===1)alreadyActive.push(code);
  else{
   db.prepare('INSERT INTO marketing_county_dispatch(job_id,independent) VALUES(?,1) ON CONFLICT(job_id) DO UPDATE SET independent=1').run(j.id);
   if(j.state==='queued')db.prepare('UPDATE marketing_county_jobs SET message=?,updated_at=? WHERE id=?').run('Pornire națională aprobată. Inventarul public se pregătește în ture, iar județele deja pornite continuă.',at,j.id);
   audit('marketing.county.activate',j.id,code);activated.push(code);
  }
  // Activation never clears source refusals/deadlines, resumes an explicitly paused job or declares completion.
  if(['paused','review','completed'].includes(j.state))held.push({county:code,state:j.state});
 }
 return {regions:CODES.length,created,activated,alreadyActive,held,delivery:'blocked',scheduler:'existing-exclusive'};
}).immediate();}
module.exports={activateNational,CODES};
if(require.main===module||process.argv[1]===undefined){
 if(!['https://sandbox.nitido.ro','https://nitido.ro'].includes(process.env.NEXT_PUBLIC_SITE_URL)||process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw Error('ORIGIN_DELIVERY_GUARD');
 const db=new(require('better-sqlite3'))('/app/data/nitido.db',{fileMustExist:true});db.pragma('busy_timeout=5000');
 try{console.log('MKT_NATIONAL_ACTIVATED '+JSON.stringify(activateNational(db)));}finally{db.close();}
}
