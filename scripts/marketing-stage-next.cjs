// Owner-authorized queue preparation only. No source reads, workers or changes to active counties.
const {randomUUID}=require('node:crypto');
function stageNextCounties(db,extend=false){return db.transaction(()=>{
 const current=db.prepare("SELECT county_code,position,state,created_by FROM marketing_county_jobs WHERE county_code IN ('CT','B') ORDER BY position").all();
 if(current.length!==2||current[0].county_code!=='CT'||current[0].position!==0||current[1].county_code!=='B'||current[1].position!==1)throw Error('ACTIVE_PLAN_MISMATCH');
 let planned=[{code:'BV',position:9},{code:'IF',position:25}],after=['CT','B'],dependencies=current;
 if(extend){
  const prior=db.prepare("SELECT county_code,position,state FROM marketing_county_jobs WHERE county_code IN ('BV','IF') ORDER BY position").all();
  if(prior.length!==2||prior[0].county_code!=='BV'||prior[1].county_code!=='IF'||prior[0].position>=prior[1].position)throw Error('PREVIOUS_PLAN_MISSING');
  after.push('BV','IF');dependencies=[...current,...prior];planned=['CJ','IS','TM'].map((code,i)=>({code,position:prior[1].position+i+1}));
 }
 if(dependencies.every(j=>j.state==='completed'))throw Error('PREVIOUS_COUNTIES_ALREADY_FINISHED');
 const at=new Date().toISOString(),actor=current[0].created_by;
 for(const p of planned){
  const old=db.prepare('SELECT id,state,position FROM marketing_county_jobs WHERE county_code=?').get(p.code);
  if(old){if(old.state!=='queued'||old.position!==p.position||db.prepare('SELECT 1 FROM marketing_county_dispatch WHERE job_id=? AND independent=1').get(old.id))throw Error('COUNTY_ALREADY_STARTED');continue;}
  if(db.prepare('SELECT 1 FROM marketing_county_jobs WHERE position=?').get(p.position))throw Error('QUEUE_POSITION_OCCUPIED');
  const id=randomUUID(),message=extend?'Pregătit în coadă după Brașov și Ilfov. Așteaptă finalizarea județelor anterioare.':'Pregătit în coadă. Va începe după finalizarea Constanței și Bucureștiului.';
  db.prepare('INSERT INTO marketing_county_jobs(id,county_code,position,message,created_at,updated_at,created_by) VALUES(?,?,?,?,?,?,?)').run(id,p.code,p.position,message,at,at,actor);
  db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),'marketing.county.queued',id,JSON.stringify({actor:extend?'owner-authorized:cluj-iasi-timis-after-brasov-ilfov':'owner-authorized:brasov-ilfov-after-ct-b',after}));
 }
 return {counties:planned.map(p=>p.code),state:'queued',after,delivery:'blocked'};
}).immediate();}
module.exports={stageNextCounties};
if(require.main===module||process.argv[1]===undefined||process.argv.slice(1).includes('--extend')){
 const Database=require('better-sqlite3');
 if(!['https://sandbox.nitido.ro','https://nitido.ro'].includes(process.env.NEXT_PUBLIC_SITE_URL)||process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw Error('ORIGIN_DELIVERY_GUARD');
 const db=new Database('/app/data/nitido.db',{fileMustExist:true});db.pragma('busy_timeout=5000');
 try{console.log('MKT_NEXT_COUNTIES '+JSON.stringify(stageNextCounties(db,process.argv.includes('--extend'))));}finally{db.close();}
}
