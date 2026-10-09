import {latestAssistedOperation,validateAssistedBooking} from './assistedOperations';
import {requireVerifiedAssessmentEvidence} from './assessmentEvidence';
import {validateOfferSchedule} from './manualOfferSchedule';
import type {Database} from 'better-sqlite3';
import {MarginError,validateManualEstimate} from './operationalMargin';
import {manualOffersEnabled,type PublicManualOffer} from './manualOffers';
import {calcNetForFirm,AUTOMATIC_MAX_SQM} from './pricing';
import {normalizeCity} from './text';
export const MANUAL_OFFER_BOOKING_SCHEMA=`
CREATE TABLE IF NOT EXISTS assessment_offer_jobs(offer_id TEXT PRIMARY KEY REFERENCES assessment_offers(id),job_id TEXT NOT NULL UNIQUE REFERENCES jobs(id),client_id TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS assessment_offer_job_no_update BEFORE UPDATE ON assessment_offer_jobs BEGIN SELECT RAISE(ABORT,'Offer booking immutable'); END;
CREATE TRIGGER IF NOT EXISTS assessment_offer_job_no_delete BEFORE DELETE ON assessment_offer_jobs BEGIN SELECT RAISE(ABORT,'Offer booking retained'); END;
`;
export function manualOfferBookingEnabled(){return manualOffersEnabled()&&process.env.NITIDO_MANUAL_OFFER_BOOKING_SANDBOX==='true'&&!process.env.STRIPE_SECRET_KEY?.startsWith('rk_live_');}
type Source={id:string;assessment_id:string;assessment_version:number;estimate_revision:number;status:string;public_json:string;version:number;assessment_status:string;payload:string;definition_json:string};
export function manualOfferBookingSource(db:Database,clientId:string,id:unknown){
 if(typeof id!=='string'||!id||id.length>100)throw new MarginError('Referință ofertă invalidă.');
 const row=db.prepare(`SELECT o.*,a.version,a.status AS assessment_status,a.payload,e.definition_json FROM assessment_offers o JOIN service_assessments a ON a.id=o.assessment_id JOIN assessment_estimates e ON e.assessment_id=o.assessment_id AND e.revision=o.estimate_revision WHERE o.id=? AND a.client_id=?`).get(id,clientId) as Source|undefined;
 if(!row)throw new MarginError('Oferta nu este disponibilă pentru acest cont.',404);
 const linked=db.prepare('SELECT job_id FROM assessment_offer_jobs WHERE offer_id=? AND client_id=?').get(id,clientId) as {job_id:string}|undefined;
 return {row,jobId:linked?.job_id??null,terms:JSON.parse(row.public_json) as PublicManualOffer['terms']};
}
export function compatibleManualOffer(db:Database,clientId:string,id:unknown,allowComplex=false){
 const source=manualOfferBookingSource(db,clientId,id),{row,terms}=source;
 if(source.jobId)return {...source,windowsSqm:0};
 if(row.status!=='accepted')throw new MarginError('Acceptă oferta înainte de rezervare.',409);
 if(row.version!==row.assessment_version||['cancelled','declined'].includes(row.assessment_status))throw new MarginError('Cererea s-a modificat. Este necesară verificarea operatorului.',409);
 if(!db.prepare('SELECT 1 FROM offer_margin_decisions WHERE offer_id=?').get(row.id))throw new MarginError('Oferta necesită verificarea internă a marjei.',409);
 const definition=validateManualEstimate(JSON.parse(row.definition_json)),request=JSON.parse(row.payload);
 if(terms.discountBani!==0||definition.platformDiscountBani!==0)throw new MarginError('Oferta cu reducere necesită reconcilierea operatorului înainte de rezervare; reducerea nu va fi convertită în credit.',422);
 if(!Number.isSafeInteger((terms.totalBani/100)*100))throw new MarginError('Suma necesită reconciliere pentru precizia fluxului de plată existent.',422);
 const expectedProvider=Math.round(calcNetForFirm(terms.grossBani/100)*100);
 if(definition.provider.state!=='confirmed'||definition.provider.amountBani!==expectedProvider)throw new MarginError('Oferta necesită reconcilierea remunerației prestatorului cu regula de plată existentă.',422);
 if(terms.totalBani!==terms.grossBani||terms.grossBani!==definition.lines.reduce((n,l)=>n+l.amountBani,0)||terms.totalBani<=0)throw new MarginError('Suma ofertei nu poate fi verificată.',409);
 if(!allowComplex&&(!['maintenance','general'].includes(terms.context.category)||terms.scope.length>500||request.sqm>AUTOMATIC_MAX_SQM||request.windowsSqm>200||request.appliances||request.linenSets||request.extraHours||request.difficulty==='heavy'))throw new MarginError('Această lucrare necesită programare asistată; nu poate intra încă în rezervarea simplă.',422);
 return {...source,windowsSqm:request.windowsSqm??0};
}
export function prepareManualOfferBooking(db:Database,clientId:string,body:Record<string,unknown>){
 if(!manualOfferBookingEnabled())throw new MarginError('Rezervarea ofertelor manuale nu este activată în sandbox.',403);
 if(body.quoteId||body.hostEventId||body.approvalId||body.propertyId||body.express60||body.mode!=='express')throw new MarginError('Oferta manuală folosește fluxul simplu de preluare, fără Express 60 sau alte oferte combinate.',422);
 const operation=typeof body.manualOfferId==='string'?latestAssistedOperation(db,body.manualOfferId):null;
 const s=compatibleManualOffer(db,clientId,body.manualOfferId,Boolean(operation));
 if(s.jobId)return {...s,schedule:null,operation:null};
 if(operation){validateAssistedBooking(db,operation,s.row.assessment_id,s.row.version,body);if(s.terms.context.category==='renovation'){const evidence=requireVerifiedAssessmentEvidence(db,s.row.assessment_id);if(evidence.reviewId!==s.terms.evidence?.reviewId)throw new MarginError('Fotografiile necesită reconfirmare înainte de rezervare.',409);}}
 else if(body.assistedRevision!=null)throw new MarginError('Propunere operațională inexistentă.',409);
 const schedule=operation?null:validateOfferSchedule(db,s.row.id,body);
 for(const [key,max] of [['street',200],['postalCode',12]] as const){if(typeof body[key]!=='string'||!body[key].trim()||body[key].length>max)throw new MarginError('Completează adresa și codul poștal.',400);}
 if(body.floor!=null&&(typeof body.floor!=='string'||body.floor.length>20))throw new MarginError('Etaj invalid.',400);
 if(body.confirmedManualTotalBani!==s.terms.totalBani||body.manualBookingConfirmed!==true)throw new MarginError('Confirmă explicit suma și crearea rezervării.',409);
 if(typeof body.city!=='string'||normalizeCity(body.city)!==normalizeCity(s.terms.context.city)||body.sqm!==s.terms.context.sqm||(body.windowsSqm??0)!==s.windowsSqm)throw new MarginError('Parametrii diferă de oferta acceptată.',409);
 return {...s,schedule,operation};
}
export function linkManualOfferJob(db:Database,clientId:string,offerId:string,jobId:string){
 if(!db.inTransaction)throw new MarginError('Rezervarea trebuie legată în aceeași tranzacție.',500);
 const own=db.prepare('SELECT 1 FROM jobs WHERE id=? AND client_id=?').get(jobId,clientId);if(!own)throw new MarginError('Rezervare invalidă.',409);
 db.prepare('INSERT INTO assessment_offer_jobs VALUES(?,?,?,?)').run(offerId,jobId,clientId,new Date().toISOString());
 db.prepare('INSERT INTO assessment_offer_events(offer_id,actor_id,action,reason,created_at) VALUES(?,?,?,?,?)').run(offerId,clientId,'booking_created',jobId,new Date().toISOString());
}
