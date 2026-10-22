import type {Database} from 'better-sqlite3';
import {createHash,randomUUID} from 'node:crypto';
import {WorkspaceError} from './workspace';
import {createAssessment} from './assessments';
import {CATALOG_CATEGORIES} from './serviceCatalog';
import type {ExtraWorkTerms,ExtraWorkData,ExtraWorkView} from './extraWorkShared';
type Actor={id:string;role:string};
type Job={id:string;client_id:string;accepted_firm_id:string|null;user_id:string|null;status:string;accepted_at:string|null;scheduled_at:string|null;city:string;street:string;postal_code:string|null;floor:string|null;space_type:string;sqm:number;bathroom_count:number|null;windows_sqm:number|null;price_gross:number;credit_applied:number;pricing_snapshot:string|null;duration_minutes:number;buffer_minutes:number;verified:number|null;suspended_until:string|null};
type Row={id:string;job_id:string;client_id:string;firm_id:string;created_by:string;request_key:string;terms_json:string;created_at:string;expires_at:string;status:string;revision:number;assessment_id:string|null};
function access(db:Database,jobId:string,user:Actor){
 const j=db.prepare('SELECT j.*,f.user_id,f.verified,f.suspended_until FROM jobs j LEFT JOIN firms f ON f.id=j.accepted_firm_id WHERE j.id=?').get(jobId) as Job|undefined;
 if(!j)throw new WorkspaceError('Lucrare inexistentă.',404);
 if(!(user.role==='client'&&j.client_id===user.id||user.role==='firma'&&j.user_id===user.id))throw new WorkspaceError('Acces interzis.',403);
 return j;
}
function active(db:Database,j:Job){return ['accepted','arrived'].includes(j.status)&&j.verified===1&&(!j.suspended_until||Number.isFinite(Date.parse(j.suspended_until))&&Date.parse(j.suspended_until)<=Date.now())&&!db.prepare("SELECT 1 FROM job_reschedule_requests WHERE job_id=? AND status='pending'").get(j.id);}
function fingerprint(j:Job){return createHash('sha256').update(JSON.stringify([j.client_id,j.accepted_firm_id,j.accepted_at,j.scheduled_at,j.city,j.street,j.postal_code,j.floor,j.space_type,j.sqm,j.bathroom_count,j.windows_sqm,j.price_gross,j.credit_applied,j.pricing_snapshot,j.duration_minutes,j.buffer_minutes])).digest('hex');}
function effective(db:Database,j:Job,r:Row){if(r.status!=='proposed')return r.status;if(r.expires_at<=new Date().toISOString())return 'expired';const t=JSON.parse(r.terms_json) as ExtraWorkTerms;return active(db,j)&&r.firm_id===j.accepted_firm_id&&r.client_id===j.client_id&&t.contextHash===fingerprint(j)?'proposed':'outdated';}
export function readExtraWork(db:Database,jobId:string,user:Actor):ExtraWorkData{
 const j=access(db,jobId,user);
 const rows=db.prepare(`SELECT * FROM extra_work_requests WHERE job_id=? AND client_id=? ${user.role==='firma'?'AND firm_id=?':''} ORDER BY created_at DESC,id LIMIT 100`).all(jobId,j.client_id,...(user.role==='firma'?[j.accepted_firm_id]:[])) as Row[];
 return {role:user.role as 'client'|'firma',canPropose:user.role==='firma'&&active(db,j),proposals:rows.map(r=>{const {contextHash:_,...terms}=JSON.parse(r.terms_json) as ExtraWorkTerms;void _;return {id:r.id,revision:r.revision,terms,status:effective(db,j,r),createdAt:r.created_at,expiresAt:r.expires_at,assessmentId:user.role==='client'?r.assessment_id:null} satisfies ExtraWorkView;})};
}
function text(v:unknown,max:number){if(typeof v!=='string'||!v.trim()||v.length>max)throw new WorkspaceError('Completează descrierea și identificatorul cererii.',400);return v.trim();}
export function changeExtraWork(db:Database,jobId:string,user:Actor,b:Record<string,unknown>){
 return db.transaction(()=>{
  const j=access(db,jobId,user);
  if(b.action==='propose'){
   if(user.role!=='firma')throw new WorkspaceError('Numai firma alocată poate propune suplimente.',403);
   const requestKey=text(b.requestKey,100),description=text(b.description,2000);
   if(!CATALOG_CATEGORIES.some(c=>c[0]===b.category)||!Number.isSafeInteger(b.proposedBani)||Number(b.proposedBani)<1||Number(b.proposedBani)>10000000||!Number.isSafeInteger(b.sqm)||Number(b.sqm)<1||Number(b.sqm)>1000000||!Number.isSafeInteger(b.rooms)||Number(b.rooms)<0||Number(b.rooms)>10000||!Number.isSafeInteger(b.bathrooms)||Number(b.bathrooms)<0||Number(b.bathrooms)>10000||!['light','normal','heavy'].includes(String(b.difficulty)))throw new WorkspaceError('Verifică serviciul, suprafața și suma propusă în lei.',400);
   const input={category:String(b.category),description,proposedBani:Number(b.proposedBani),sqm:Number(b.sqm),rooms:Number(b.rooms),bathrooms:Number(b.bathrooms),difficulty:b.difficulty as ExtraWorkTerms['difficulty']};
   const prior=db.prepare('SELECT * FROM extra_work_requests WHERE created_by=? AND request_key=?').get(user.id,requestKey) as Row|undefined;
   if(prior){const {contextHash:_,...old}=JSON.parse(prior.terms_json) as ExtraWorkTerms;void _;if(prior.job_id!==jobId||JSON.stringify(old)!==JSON.stringify(input))throw new WorkspaceError('Identificator reutilizat pentru altă propunere.',409);return {ok:true,id:prior.id};}
   if(!active(db,j))throw new WorkspaceError('Lucrarea sau firma nu mai permite propuneri. Actualizează datele.',409);
   if((db.prepare('SELECT COUNT(*) n FROM extra_work_requests WHERE job_id=?').get(jobId) as {n:number}).n>=100)throw new WorkspaceError('Limita de propuneri pentru această lucrare a fost atinsă.',409);
   const id=randomUUID(),createdAt=new Date().toISOString(),expiresAt=new Date(Date.now()+24*3600000).toISOString();
   db.prepare('INSERT INTO extra_work_requests(id,job_id,firm_id,client_id,created_by,request_key,terms_json,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,jobId,j.accepted_firm_id,j.client_id,user.id,requestKey,JSON.stringify({...input,contextHash:fingerprint(j)}),createdAt,expiresAt);
   return {ok:true,id};
  }
  const id=text(b.id,100),r=db.prepare('SELECT * FROM extra_work_requests WHERE id=? AND job_id=?').get(id,jobId) as Row|undefined;
  if(!r||r.client_id!==j.client_id||user.role==='firma'&&r.firm_id!==j.accepted_firm_id)throw new WorkspaceError('Propunere inexistentă.',404);
  if(b.action==='approve'&&user.role!=='client'||b.action==='reject'&&user.role!=='client'||b.action==='withdraw'&&user.role!=='firma')throw new WorkspaceError('Acțiune nepermisă.',403);
  if(!['approve','reject','withdraw'].includes(String(b.action)))throw new WorkspaceError('Acțiune invalidă.',400);
  if(b.action==='approve'&&b.acknowledgeNoPayment!==true)throw new WorkspaceError('Confirmă că trimiterea la evaluare nu reprezintă plată sau autorizarea lucrării.',400);
  const state=b.action==='approve'?'approved':b.action==='reject'?'rejected':'withdrawn';
  if(r.status===state&&Number.isSafeInteger(b.revision)&&b.revision===r.revision-1)return {ok:true,id:r.id,assessmentId:user.role==='client'?r.assessment_id:null};
  if(!Number.isSafeInteger(b.revision)||b.revision!==r.revision||r.status!=='proposed')throw new WorkspaceError('Propunerea s-a schimbat. Actualizează înainte de a continua.',409);
  let assessmentId:string|null=null;
  if(b.action==='approve'){
   if(effective(db,j,r)!=='proposed')throw new WorkspaceError('Propunerea a expirat sau contextul lucrării s-a schimbat.',409);
   const t=JSON.parse(r.terms_json) as ExtraWorkTerms;
   assessmentId=createAssessment(db,user.id,'extra-work:'+r.id,{category:t.category,city:j.city,sqm:t.sqm,rooms:t.rooms,bathrooms:t.bathrooms,difficulty:t.difficulty,notes:`SUPLIMENT PROPUS PENTRU EVALUARE\nLucrare originală: ${j.id}\nPropunere: ${r.id}\n${t.description}\nSuma propusă de firmă: ${(t.proposedBani/100).toFixed(2)} RON. Nu este preț final, rezervare, plată sau acord de începere. Cantitățile și condițiile finale necesită verificare.`,appliances:0,windowsSqm:0,linenSets:0,extraHours:0});
  }
  db.prepare('UPDATE extra_work_requests SET status=?,revision=revision+1,assessment_id=?,resolved_at=? WHERE id=? AND revision=?').run(state,assessmentId,new Date().toISOString(),r.id,r.revision);
  return {ok:true,id:r.id,assessmentId};
 }).immediate();
}
