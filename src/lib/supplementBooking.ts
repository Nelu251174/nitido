import type {Database} from 'better-sqlite3';
import {approvedExtraWorkContext} from './extraWork';
import {WorkspaceError} from './workspace';
import {MarginError} from './operationalMargin';
import {bucharestScheduledAt,bookingDateKey} from './scheduling';
import {calcNetForFirm,AUTOMATIC_MAX_SQM,SLOT_HOURS} from './pricing';
import type {ManualEstimate} from './operationalMargin';

/** Independent rollout; never enables ordinary sandbox-only offers on production. */
export function supplementBookingEnabled(){
 if(process.env.NITIDO_SUPPLEMENT_BOOKING_ENABLED!=='true')return false;
 const site=process.env.NEXT_PUBLIC_SITE_URL,key=process.env.STRIPE_SECRET_KEY??'';
 return site==='https://sandbox.nitido.ro'?!/^(?:sk|rk)_live_/.test(key):site==='https://nitido.ro'&&/^(?:sk|rk)_live_/.test(key);
}
function hasOrigins(db:Database){return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='extra_work_requests'").get();}
export function supplementAssessmentOrigin(db:Database,id:string,clientId?:string){
 if(!hasOrigins(db))return null;
 return db.prepare(`SELECT id AS proposalId,job_id AS originalJobId FROM extra_work_requests WHERE assessment_id=? ${clientId===undefined?'':'AND client_id=?'}`).get(id,...(clientId===undefined?[]:[clientId])) as {proposalId:string;originalJobId:string}|undefined??null;
}
export function supplementAssessment(db:Database,id:string){try{return approvedExtraWorkContext(db,id)}catch(e){if(e instanceof WorkspaceError)throw new MarginError(e.message,e.status);throw e;}}
export function supplementOfferAssessment(db:Database,id:unknown):string|null{
 if(!hasOrigins(db)||typeof id!=='string')return null;
 return (db.prepare('SELECT e.assessment_id FROM assessment_offers o JOIN extra_work_requests e ON e.assessment_id=o.assessment_id WHERE o.id=?').get(id) as {assessment_id:string}|undefined)?.assessment_id??null;
}
export function assessmentOfferFlowEnabled(db:Database,id:string,ordinaryEnabled:boolean){
 try{const extra=supplementAssessment(db,id);return extra?supplementBookingEnabled():ordinaryEnabled;}catch(e){if(e instanceof MarginError)return false;throw e;}
}
export function offerBookingFlowEnabled(db:Database,id:unknown,ordinaryEnabled:boolean){const assessment=supplementOfferAssessment(db,id);return assessment?assessmentOfferFlowEnabled(db,assessment,false):ordinaryEnabled;}
export function supplementForOffer(db:Database,id:unknown){const assessment=supplementOfferAssessment(db,id);return assessment?supplementAssessment(db,assessment):null;}
export function validateSupplementOffer(db:Database,id:string,scope:string,request:{category:string;sqm:number;windowsSqm:number;appliances:number;linenSets:number;extraHours:number;difficulty:string},definition:ManualEstimate){
 if(!supplementAssessment(db,id))return;
 const total=definition.lines.reduce((n,l)=>n+l.amountBani,0);
 if(!['maintenance','general'].includes(request.category)||scope.length>500||request.sqm>AUTOMATIC_MAX_SQM||request.windowsSqm>200||request.appliances||request.linenSets||request.extraHours||request.difficulty==='heavy')throw new MarginError('Suplimentul necesită planificare asistată; oferta nu poate fi publicată în rezervarea simplă.',422);
 if(definition.platformDiscountBani!==0||definition.provider.state!=='confirmed'||definition.provider.amountBani!==Math.round(calcNetForFirm(total/100)*100)||!Number.isSafeInteger((total/100)*100))throw new MarginError('Verifică remunerația firmei și totalul fără reduceri înainte de publicarea suplimentului.',422);
}
export function supplementOriginForJob(db:Database,id:string){
 if(!hasOrigins(db))return null;
 return db.prepare('SELECT e.assessment_id,e.job_id AS originalJobId,e.firm_id AS firmId,e.client_id AS clientId FROM assessment_offer_jobs l JOIN assessment_offers o ON o.id=l.offer_id JOIN extra_work_requests e ON e.assessment_id=o.assessment_id WHERE l.job_id=?').get(id) as {assessment_id:string;originalJobId:string;firmId:string;clientId:string}|undefined??null;
}
/** Checked again inside the existing acceptance writer transaction, before a HOLD. */
export function supplementAcceptanceError(db:Database,id:string,firmId:string):string|null{
 const origin=supplementOriginForJob(db,id);if(!origin)return null;
 if(origin.firmId!==firmId)return 'Rezervarea suplimentară poate fi preluată numai de firma care a propus-o.';
 try{
  supplementAssessment(db,origin.assessment_id);
  const job=db.prepare('SELECT client_id FROM jobs WHERE id=?').get(id) as {client_id:string}|undefined;
  return job?.client_id===origin.clientId?null:'Clientul rezervării suplimentare necesită verificare.';
 }catch(e){if(e instanceof MarginError)return e.message;throw e;}
}
export function validateSupplementSchedule(db:Database,offerId:string,date:unknown,hour:unknown){
 const origin=supplementForOffer(db,offerId);if(!origin)return;
 const start=typeof date==='string'&&bookingDateKey(date)===date&&typeof hour==='number'&&(SLOT_HOURS as readonly number[]).includes(hour)?bucharestScheduledAt(date,hour).getTime():NaN;
 const originalStart=Date.parse(origin.scheduledAt??''),end=originalStart+(origin.durationMinutes+origin.bufferMinutes)*60000;
 if(!Number.isFinite(start)||!Number.isFinite(end)||!Number.isSafeInteger(origin.durationMinutes)||origin.durationMinutes<=0||!Number.isSafeInteger(origin.bufferMinutes)||origin.bufferMinutes<0||start<end)throw new MarginError('Programează suplimentul separat, după intervalul și deplasarea lucrării originale.',409);
}
export function validateSupplementBooking(db:Database,offerId:string,clientId:string,body:Record<string,unknown>){
 const origin=supplementForOffer(db,offerId);if(!origin)return null;
 if(!supplementBookingEnabled())throw new MarginError('Rezervarea suplimentelor nu este activată.',403);
 if(origin.clientId!==clientId)throw new MarginError('Oferta nu este disponibilă pentru acest cont.',404);
 if(body.whenType!=='scheduled'||body.assistedRevision!=null)throw new MarginError('Suplimentul necesită o programare separată confirmată.',409);
 if(body.repeatJobId||body.beneficiary||body.alertBatchId||body.photoDraftId||body.entrance||body.flexibleWindows||body.weekSlot||Array.isArray(body.photoIds)&&body.photoIds.length)throw new MarginError('Suplimentul folosește numai oferta și programarea lui separată.',422);
 if(body.street!==origin.street||String(body.floor??'')!==String(origin.floor??'')||body.spaceType!==origin.spaceType||origin.postalCode&&body.postalCode!==origin.postalCode)throw new MarginError('Adresa suplimentului trebuie să fie cea a lucrării originale.',409);
 validateSupplementSchedule(db,offerId,body.scheduledDate,body.scheduledHour);
 return origin;
}
