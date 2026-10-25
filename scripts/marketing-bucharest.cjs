// Explicit owner-authorized start of București alongside unfinished Constanța. No collector or transport is started here.
const Database=require('better-sqlite3'),{randomUUID}=require('node:crypto');
if(!['https://sandbox.nitido.ro','https://nitido.ro'].includes(process.env.NEXT_PUBLIC_SITE_URL)||process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw Error('ORIGIN_DELIVERY_GUARD');
const db=new Database('/app/data/nitido.db',{fileMustExist:true});db.pragma('busy_timeout=5000');
const marker='Pauză pentru publicarea pornirii separate București.';
try{const result=db.transaction(()=>{
 const ct=db.prepare("SELECT id,state,message FROM marketing_county_jobs WHERE county_code='CT'").get();if(!ct)throw Error('CT_MISSING');
 let action,target;
 if(process.argv.includes('--pause-ct')){
  if(ct.state==='review'||ct.state==='paused')return {checkpoint:ct.state,changed:false};
  if(ct.state!=='collecting')throw Error('CT_NOT_COLLECTING');
  db.prepare("UPDATE marketing_county_jobs SET state='paused',message=?,updated_at=? WHERE id=?").run(marker,new Date().toISOString(),ct.id);action='deployment.paused';target=ct.id;
 }else if(process.argv.includes('--resume-ct')){
  if(ct.state!=='paused'||ct.message!==marker)return {checkpoint:ct.state,changed:false};
  db.prepare("UPDATE marketing_county_jobs SET state='collecting',message='Verificarea paginilor publice de contact continuă din progresul salvat.',updated_at=? WHERE id=?").run(new Date().toISOString(),ct.id);action='deployment.resumed';target=ct.id;
 }else{
  const b=db.prepare("SELECT id,state FROM marketing_county_jobs WHERE county_code='B'").get();if(!b)throw Error('BUCHAREST_NOT_QUEUED');
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE name='marketing_county_dispatch'").get())throw Error('DISPATCH_NOT_DEPLOYED');
  if(db.prepare('SELECT 1 FROM marketing_county_dispatch WHERE job_id=? AND independent=1').get(b.id))return {county:'B',state:b.state,replayed:true};
  if(b.state!=='queued')throw Error('BUCHAREST_NOT_QUEUED');
  db.prepare('INSERT INTO marketing_county_dispatch(job_id,independent) VALUES(?,1) ON CONFLICT(job_id) DO UPDATE SET independent=1').run(b.id);
  db.prepare("UPDATE marketing_county_jobs SET message='Pornire separată aprobată. Colectarea nu așteaptă finalizarea celorlalte județe.',updated_at=? WHERE id=?").run(new Date().toISOString(),b.id);action='activate';target=b.id;
 }
 db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),'marketing.county.'+action,target,JSON.stringify({actor:'owner-authorized:start-bucharest-with-constanta'}));return {action,county:action==='activate'?'B':'CT'};
}).immediate();console.log('MKT_BUCHAREST '+JSON.stringify({...result,delivery:'blocked'}));}finally{db.close();}
