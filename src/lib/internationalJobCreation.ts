import type {Database} from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {acceptedInternationalBookingQuote,internationalBookingContext,linkInternationalBookingQuote} from './internationalBooking';
import {InternationalTariffError} from './internationalTariffs';
import {internationalPricingEnabled} from './internationalRollout';
import {internationalLocalSchedule,internationalTimezone} from './internationalScheduling';
import {assertCustomerCanCreate} from './customerRestrictions';
import {isAccountRemoved} from './accountStatus';
import {firmCoversCity} from './text';
import {canPreviewOpportunity} from './opportunityEligibility';
import {freezeExecutionRules,jobExecutionRules} from './executionTemplates';
import {MIN_LEAD_HOURS,BUFFER_MINUTES} from './pricing';
import type {JobRow} from './types';
import {getClientCardInfo} from './clientPayments';
import {saveJobCard} from './savedCards';
import {queueNewJobFirmPushes} from './push';

const fail=(message:string,status=400):never=>{throw new InternationalTariffError(message,status);};
const text=(value:unknown,max:number,required=false):string|null=>{
 if(value===undefined||value===null||value==='')return required?fail('Completează adresa lucrării.'):null;
 if(typeof value!=='string'||value.trim().length>(max)||required&&value.trim().length<3)return fail('Adresă invalidă.');
 return value.trim()||null;
};
export function internationalBookingSchedule(country:unknown,body:Record<string,unknown>):Date{
 if(body.scheduledLocal!==undefined&&body.scheduledAt!==undefined)return fail('Trimite o singură reprezentare a orei lucrării.');
 if(body.scheduledLocal!==undefined){try{return internationalLocalSchedule(country,body.scheduledLocal);}catch{return fail('Ora locală a lucrării este invalidă sau ambiguă.');}}
 const value=body.scheduledAt;
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  ||!Number.isFinite(Date.parse(value)))return fail('Confirmă data și ora locală a lucrării.');
 return new Date(value);
}

/** New EUR bookings only; no mutation of Romanian pricing, credits or booking routes. */
export function createInternationalJob(db:Database,clientId:string,raw:unknown,now?:Date){
 if(!internationalPricingEnabled())return fail('Rezervările internaționale nu sunt activate.',422);
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail('Date invalide.');
 const body=raw as Record<string,unknown>;
 for(const key of ['grossMinor','clientTotalMinor','price','priceGross','credit','creditMinor','creditLei','currency','workers','propertyId','beneficiary','hostEventId','recurringPlanId','express60']){
  if(body[key]!==undefined)return fail('Acest flux folosește numai oferta internațională confirmată, fără credite sau module RON.');
 }
 const context=internationalBookingContext(body.context),street=text(body.street,240,true)!,postal=text(body.postalCode,32),floor=text(body.floor,40);
 const scheduled=internationalBookingSchedule(context.countryCode,body),scheduledAt=scheduled.toISOString(),timeZone=internationalTimezone(context.countryCode);
 const result=db.transaction(()=>{
  // The clock is read after obtaining the writer lock; waiting cannot revive an expired quote.
  // An explicit clock remains available only for deterministic isolated callers.
  const effectiveNow=now??new Date();
  if(isAccountRemoved(db,clientId))return fail('Contul clientului nu este disponibil.',403);
  const accepted=acceptedInternationalBookingQuote(db,clientId,body.quoteId,context,effectiveNow);
  if(accepted.jobId){
   const old=db.prepare(`SELECT j.id,j.street,j.postal_code,j.floor,j.scheduled_at,j.status,c.currency,c.time_zone,c.workers,c.gross_minor
    FROM jobs j JOIN international_job_contexts c ON c.job_id=j.id WHERE j.id=? AND j.client_id=?`).get(accepted.jobId,clientId) as Record<string,unknown>|undefined;
   if(!old||old.street!==street||old.postal_code!==postal||old.floor!==floor||old.scheduled_at!==scheduledAt)return fail('Oferta este deja legată de altă rezervare sau adresă.',409);
   queueNewJobFirmPushes(db,{id:String(old.id),city:context.city,spaceType:context.spaceType,sqm:context.sqm});
   return {booking:{id:String(old.id),status:old.status,currency:'EUR',grossMinor:old.gross_minor,timeZone:old.time_zone,workers:old.workers,scheduledAt:old.scheduled_at},replayed:true,financialOperations:0};
  }
  if(scheduled.getTime()<effectiveNow.getTime()+MIN_LEAD_HOURS*3600000||scheduled.getTime()>effectiveNow.getTime()+366*86400000)return fail('Alege o dată viitoare cu minimum o oră înainte.');
  const snapshot=accepted.snapshot;
  if(context.service==='renovation')return fail('Curățenia după renovare necesită o evaluare separată înainte de rezervare.',422);
  if(snapshot.durationMinutes<180||!Number.isSafeInteger(snapshot.personMinutes)||snapshot.personMinutes!==snapshot.workers*snapshot.durationMinutes)return fail('Durata sau echipa ofertei necesită reconfirmare.',409);
  assertCustomerCanCreate(db,clientId,'bookings');
  const firms=db.prepare(`SELECT id,user_id,coverage_city,coverage_cities_extra FROM firms WHERE verified=1 AND stripe_identity_country=?
   AND stripe_default_currency='EUR' AND stripe_account_status='ready' AND stripe_transfers_capability='active'
   AND stripe_account_id IS NOT NULL AND (suspended_until IS NULL OR suspended_until<=?)`).all(context.countryCode,effectiveNow.toISOString()) as {id:string;user_id:string;coverage_city:string;coverage_cities_extra:string|null}[];
  const candidates=firms.filter(f=>!isAccountRemoved(db,f.user_id)&&firmCoversCity(f.coverage_city,f.coverage_cities_extra,context.city));
  if(!candidates.length)return fail('Nu există încă o firmă locală eligibilă pentru această rezervare.',422);
  const card=getClientCardInfo(db,clientId),id=randomUUID();
  if(card.stripeConfigured&&!card.hasCard)return fail('Adaugă și confirmă un card înainte de rezervare.',409);
  const contract={...snapshot,quoteId:body.quoteId,timeZone,
   internationalTerms:{version:'international-booking-v1',billingBasis:'fixed_server_quote',currency:'EUR',minimumOnsiteMinutes:180,
    scheduledMinutes:snapshot.durationMinutes,workers:snapshot.workers,personMinutes:snapshot.personMinutes,
    grossMinor:snapshot.grossMinor,creditMinor:0,authorization:'valid_provider_acceptance',capture:'valid_completion',
    noAutomaticRonCredits:true,noFictionalWaitingHours:true}};
  db.prepare(`INSERT INTO jobs(id,client_id,street,postal_code,city,floor,sqm,space_type,when_type,scheduled_at,
    price_gross,credit_applied,duration_minutes,buffer_minutes,photos_count,mode,status,pricing_snapshot,cleaning_type)
    VALUES(?,?,?,?,?,?,?,?,'scheduled',?,?,0,?,?,0,'standard','waiting',?,?)`).run(id,clientId,street,postal,context.city,floor,context.sqm,context.spaceType,scheduledAt,snapshot.grossMinor/100,snapshot.durationMinutes,BUFFER_MINUTES,JSON.stringify(contract),context.service);
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(id) as JobRow;
  if(!candidates.some(f=>canPreviewOpportunity(db,f.id,job)))return fail('Firmele locale nu au capacitate verificată pentru intervalul ales.',422);
  freezeExecutionRules(db,id,'standard',undefined,context.service);
  // The work scope is frozen separately; the accepted monetary snapshot is never rewritten.
  jobExecutionRules(db,id);
  if(card.stripeConfigured)saveJobCard(db,clientId,id,body.cardId);
  db.prepare('INSERT INTO international_job_contexts VALUES(?,?,?,?,?,?,?,?)').run(id,body.quoteId,context.countryCode,'EUR',timeZone,snapshot.workers,snapshot.grossMinor,effectiveNow.toISOString());
  linkInternationalBookingQuote(db,clientId,String(body.quoteId),id);
  // Persist recipient work with the booking; transports run only after the response.
  queueNewJobFirmPushes(db,{id,city:context.city,spaceType:context.spaceType,sqm:context.sqm});
  return {booking:{id,status:'waiting',currency:'EUR',grossMinor:snapshot.grossMinor,timeZone,workers:snapshot.workers,scheduledAt},replayed:false,financialOperations:0};
 }).immediate();
 return result;
}

export function ownInternationalJobs(db:Database,clientId:string){
 return db.prepare(`SELECT j.id,j.city,j.street,j.scheduled_at AS scheduledAt,j.status,j.sqm,j.space_type AS spaceType,
  c.country_code AS countryCode,c.currency,c.time_zone AS timeZone,c.workers,c.gross_minor AS grossMinor
  FROM international_job_contexts c JOIN jobs j ON j.id=c.job_id WHERE j.client_id=? ORDER BY j.created_at DESC,j.id DESC LIMIT 100`).all(clientId);
}
