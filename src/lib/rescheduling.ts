import {notifySchedule} from "./visitCare";
import type {Database} from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {bucharestScheduledAt} from './scheduling';
import {firmAvailabilityError} from './firmAvailability';
import {assignTeam, WorkspaceError} from './workspace';
import {getStripeClient} from './payments';
import {authorizationMustStop} from './paymentCancellation';
import type {JobRow} from './types';
import {enforcePropertyBudget,AccessError} from './collaborationAccess';

export type RescheduleRequest={id:string;job_id:string;client_id:string;firm_id:string|null;original_at:string;proposed_at:string;status:string;firm_confirmed_at:string|null;confirmed_snapshot:string|null};
type RequestRow=RescheduleRequest;
type Actor={id:string;role:string};
function fail(message:string,status=409):never {throw new WorkspaceError(message,status)}
function access(db:Database,id:string,user:Actor){
 const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(id) as JobRow|undefined;
 if(!job)fail('Rezervare inexistentă.',404);
 const firm=user.role==='firma'?db.prepare('SELECT id FROM firms WHERE user_id=?').get(user.id) as {id:string}|undefined:undefined;
 if(!(user.role==='client'&&job.client_id===user.id)&&!(firm&&job.accepted_firm_id===firm.id))fail('Acces interzis.',403);
 return job;
}
export function rescheduleHistory(db:Database,id:string,user:Actor){access(db,id,user);return db.prepare(`SELECT r.id,r.original_at,r.proposed_at,r.status,r.created_at,r.resolved_at,r.firm_confirmed_at,
 a.state AS authorization_status,a.cleanup_status FROM job_reschedule_requests r LEFT JOIN reschedule_authorizations a ON a.request_id=r.id WHERE r.job_id=? ORDER BY r.created_at DESC LIMIT 20`).all(id)}
export function rescheduleSnapshot(job:JobRow){return JSON.stringify([job.client_id,job.accepted_firm_id,job.scheduled_at,job.duration_minutes,job.buffer_minutes,job.price_gross,job.credit_applied])}
/** Synchronous: callers include these checks and date/payment updates in one transaction. */
export function applyConfirmedReschedule(db:Database,job:JobRow,request:RequestRow){
 movable(db,job);
 if(job.status!=='accepted'||job.scheduled_at!==request.original_at||job.accepted_firm_id!==request.firm_id||Date.parse(request.proposed_at)<Date.now()+3600000)fail('Rezervarea sau intervalul s-a schimbat. Retrage propunerea și alege o dată nouă.');
 const error=firmAvailabilityError(db,job.accepted_firm_id!,{...job,scheduled_at:request.proposed_at});if(error)fail(error);
 applyDate(db,job,request.proposed_at);
 const assignment=db.prepare('SELECT team_id FROM workspace_assignments WHERE job_id=?').get(job.id) as {team_id:string}|undefined;
 if(assignment){const firm=db.prepare('SELECT user_id FROM firms WHERE id=?').get(job.accepted_firm_id) as {user_id:string};assignTeam(db,firm.user_id,assignment.team_id,job.id)}
}
function movable(db:Database,job:JobRow){
 if(!['waiting','accepted'].includes(job.status)||!job.scheduled_at||job.express_60)fail('Această rezervare nu poate fi reprogramată. Lucrările începute și Express 60 își păstrează programul.');
 if(authorizationMustStop(db,job.id))fail('Rezervarea are o operațiune de anulare în curs.');
}
function applyDate(db:Database,job:JobRow,date:string){
 db.prepare("UPDATE jobs SET scheduled_at=?,when_type='scheduled' WHERE id=?").run(date,job.id);
 // occurrence_date remains the immutable series identity, even when the visit moves.
 db.prepare('UPDATE recurring_occurrences SET scheduled_at=? WHERE job_id=?').run(date,job.id);
 notifySchedule(db,job.id,'Reprogramarea unei vizite a fost confirmată.');
 const property=db.prepare('SELECT property_id FROM workspace_property_jobs WHERE job_id=?').get(job.id) as {property_id:string}|undefined;
 if(property){try{enforcePropertyBudget(db,property.property_id,job.id)}catch(error){if(error instanceof AccessError)fail(error.message);throw error}}
}
export function proposeReschedule(db:Database,id:string,user:Actor,input:{date:unknown;hour:unknown;expectedAt:unknown}){
 if(user.role!=='client')fail('Clientul trebuie să propună noul interval.',403);
 if(typeof input.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||typeof input.hour!=='number'||![8,10,12,14,16,18].includes(input.hour))fail('Alege data și ora.',400);
 const parsed=new Date(`${input.date}T12:00:00Z`);
 if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==input.date)fail('Dată invalidă.',400);
 const date=bucharestScheduledAt(input.date,input.hour).toISOString();
 if(Date.parse(date)<Date.now()+3600000||Date.parse(date)>Date.now()+366*86400000)fail('Alege un interval cu minimum o oră înainte, în următoarele 12 luni.',400);
 return db.transaction(()=>{
  const job=access(db,id,user);movable(db,job);
  if(job.scheduled_at!==input.expectedAt)fail('Programul s-a schimbat. Reîncarcă rezervarea.');
  if(job.scheduled_at===date)fail('Alege un interval diferit.',400);
  const prior=db.prepare("SELECT * FROM job_reschedule_requests WHERE job_id=? AND status='pending'").get(id) as RequestRow|undefined;
  if(prior){if(prior.proposed_at===date)return {status:'pending'};fail('Există deja o propunere. Retrage-o înainte să alegi alt interval.')}
  const status=job.status==='waiting'?'accepted':'pending';
  if(job.status==='waiting'){
   if(job.accepted_firm_id||db.prepare('SELECT 1 FROM payments WHERE job_id=?').get(id)||db.prepare('SELECT 1 FROM payment_authorization_attempts WHERE job_id=?').get(id))fail('Starea plății trebuie clarificată înainte de reprogramare.');
   applyDate(db,job,date);
   db.prepare("UPDATE offers SET status='rejected',updated_at=datetime('now') WHERE job_id=? AND status='pending'").run(id);
  }
  db.prepare('INSERT INTO job_reschedule_requests(id,job_id,client_id,firm_id,original_at,proposed_at,status,created_at,resolved_at) VALUES(?,?,?,?,?,?,?,?,?)').run(randomUUID(),id,user.id,job.accepted_firm_id,job.scheduled_at,date,status,new Date().toISOString(),status==='accepted'?new Date().toISOString():null);
  if(status==='pending')notifySchedule(db,id,'O vizită are o propunere de reprogramare. Intervalul actual rămâne valabil.');
  return {status};
 }).immediate();
}
export async function decideReschedule(db:Database,id:string,user:Actor,requestId:string,action:'accept'|'reject'|'withdraw'){
 const job=access(db,id,user);
 const request=db.prepare('SELECT * FROM job_reschedule_requests WHERE id=? AND job_id=?').get(requestId,id) as RequestRow|undefined;
 if(!request)fail('Propunere inexistentă.',404);
 if(action==='withdraw'?user.role!=='client':user.role!=='firma')fail('Acțiune nepermisă acestui cont.',403);
 const status=action==='accept'?'accepted':action==='reject'?'rejected':'withdrawn';
 if(request.status===status)return {status};
 if(request.status!=='pending')fail('Propunerea a fost deja soluționată.');
 let paymentId:string|null=null;
 let intentId:string|null=null,needsAuthorization=false;
 if(action==='accept'&&!job.guarantee_of){
  movable(db,job);
  const payment=db.prepare('SELECT id,status,stripe_payment_intent_id,amount_gross FROM payments WHERE job_id=?').get(id) as {id:string;status:string;stripe_payment_intent_id:string|null;amount_gross:number}|undefined;
  const paymentCount=(db.prepare('SELECT count(*) AS n FROM payments WHERE job_id=?').get(id) as {n:number}).n;
  if(!payment||!['authorized','cancelled'].includes(payment.status)||!payment.stripe_payment_intent_id||paymentCount!==1)fail('Autorizarea cardului nu este confirmată. Programul rămâne neschimbat.');
  const stripe=getStripeClient();if(!stripe)fail('Procesatorul de plată nu este disponibil.',503);
  const intent=await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id,{expand:['latest_charge']});
  const charge=typeof intent.latest_charge==='object'?intent.latest_charge:null;
  const expiry=charge?.payment_method_details?.card?.capture_before;
  if(!['requires_capture','canceled'].includes(intent.status)||intent.capture_method!=='manual'||intent.amount_received!==0||intent.currency!=='ron'||intent.amount!==payment.amount_gross*100||(intent.status==='requires_capture'&&intent.amount_capturable!==payment.amount_gross*100)||intent.metadata.jobId!==id||intent.metadata.paymentId!==payment.id)fail('Plata necesită clarificare. Programul rămâne neschimbat.');
  const end=Date.parse(request.proposed_at)+(job.duration_minutes+job.buffer_minutes)*60000;
  needsAuthorization=intent.status==='canceled'||payment.status!=='authorized'||!expiry||expiry*1000<=end||!!db.prepare('SELECT 1 FROM reschedule_authorizations WHERE request_id=?').get(requestId);
  paymentId=payment.id;
  intentId=intent.id;
 }
 return db.transaction(()=>{
  const current=access(db,id,user);
  const latest=db.prepare('SELECT * FROM job_reschedule_requests WHERE id=? AND job_id=?').get(requestId,id) as RequestRow;
  if(latest.status===status)return {status};
  if(latest.status!=='pending')fail('Propunerea a fost modificată între timp.');
  if(action==='accept'){
   movable(db,current);
   if(current.guarantee_of!==job.guarantee_of||current.scheduled_at!==request.original_at||current.accepted_firm_id!==request.firm_id||current.status!=='accepted'||current.duration_minutes!==job.duration_minutes||current.buffer_minutes!==job.buffer_minutes||current.price_gross!==job.price_gross||current.credit_applied!==job.credit_applied)fail('Rezervarea s-a schimbat între timp.');
   if(Date.parse(request.proposed_at)<Date.now()+3600000)fail('Noul interval este prea apropiat sau a trecut.');
   if(!db.prepare("SELECT 1 FROM payments WHERE id=? AND job_id=? AND stripe_payment_intent_id=? AND status IN ('authorized','cancelled')").get(paymentId,id,intentId))fail('Starea plății s-a schimbat.');
   const error=firmAvailabilityError(db,current.accepted_firm_id!,{...current,scheduled_at:request.proposed_at});if(error)fail(error);
   if(needsAuthorization){
    db.prepare("UPDATE job_reschedule_requests SET firm_confirmed_at=COALESCE(firm_confirmed_at,?),confirmed_snapshot=? WHERE id=? AND status='pending'").run(new Date().toISOString(),rescheduleSnapshot(current),requestId);
    if(!latest.firm_confirmed_at)notifySchedule(db,id,'Firma a acceptat noul interval. Clientul trebuie să reconfirme autorizarea cardului.');
    return {status:'awaiting_authorization'};
   }
   if(current.guarantee_of&&(db.prepare('SELECT 1 FROM payments WHERE job_id=?').get(id)||db.prepare('SELECT 1 FROM payment_authorization_attempts WHERE job_id=?').get(id)))fail('Remedierea are o înregistrare financiară care necesită verificare.');
   if(!current.guarantee_of&&!db.prepare("SELECT 1 FROM payments WHERE id=? AND status='authorized' AND stripe_payment_intent_id=?").get(paymentId,intentId))fail('Starea plății s-a schimbat.');
   applyDate(db,current,request.proposed_at);
   const assignment=db.prepare('SELECT team_id FROM workspace_assignments WHERE job_id=?').get(id) as {team_id:string}|undefined;
   if(assignment)assignTeam(db,user.id,assignment.team_id,id);
  }
  db.prepare("UPDATE job_reschedule_requests SET status=?,resolved_at=? WHERE id=? AND status='pending'").run(status,new Date().toISOString(),requestId);
  if(action!=='accept')notifySchedule(db,id,'Propunerea de reprogramare a fost refuzată sau retrasă. Intervalul inițial rămâne valabil.');
  return {status};
 }).immediate();
}
