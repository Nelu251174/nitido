import {activeAccountSql} from './accountStatus';
import type {Database} from 'better-sqlite3';
import {firmCoversCity} from './text';
import {firmAvailabilityError} from './firmAvailability';
import {notice} from './visitCare';
import {validBathroomCount,validWindowsSqm} from './pricing';
import type {JobRow} from './types';

export class RetentionError extends Error {
  constructor(message:string,public status=409){super(message);}
}

export function eligibleFavorite(db:Database,clientId:string,firmId:string){
  const firm=db.prepare(`SELECT f.id,f.user_id,f.verified,f.suspended_until,f.coverage_city,f.coverage_cities_extra,u.name
    FROM firms f JOIN users u ON u.id=f.user_id WHERE f.id=? AND ${activeAccountSql(db,'u.id')} AND EXISTS(
    SELECT 1 FROM jobs j WHERE j.client_id=? AND j.accepted_firm_id=f.id AND j.status='completed')`)
    .get(firmId,clientId) as {id:string;user_id:string;verified:number;suspended_until:string|null;coverage_city:string;coverage_cities_extra:string|null;name:string}|undefined;
  if(!firm||firm.verified!==1||firm.suspended_until&&(!Number.isFinite(Date.parse(firm.suspended_until))||Date.parse(firm.suspended_until)>Date.now()))
    throw new RetentionError('Alege o firmă verificată și activă cu care ai finalizat o lucrare.',400);
  return firm;
}

export function favoriteFirms(db:Database,clientId:string){
  return db.prepare(`SELECT f.id,u.name,f.coverage_city,f.verified,f.suspended_until,
    CASE WHEN p.firm_id IS NOT NULL THEN 1 ELSE 0 END saved
    FROM firms f JOIN users u ON u.id=f.user_id LEFT JOIN client_favorite_firms p ON p.firm_id=f.id AND p.client_id=?
    WHERE ${activeAccountSql(db,'u.id')} AND (p.firm_id IS NOT NULL OR EXISTS(SELECT 1 FROM jobs j WHERE j.client_id=? AND j.accepted_firm_id=f.id AND j.status='completed'))
    ORDER BY saved DESC,u.name,f.id`).all(clientId,clientId) as {id:string;name:string;coverage_city:string;verified:number;suspended_until:string|null;saved:number}[];
}

export function saveFavorite(db:Database,clientId:string,firmId:string,save:boolean){
  if(!save){db.prepare('DELETE FROM client_favorite_firms WHERE client_id=? AND firm_id=?').run(clientId,firmId);return;}
  db.transaction(()=>{eligibleFavorite(db,clientId,firmId);db.prepare('INSERT OR IGNORE INTO client_favorite_firms(client_id,firm_id) VALUES(?,?)').run(clientId,firmId);}).immediate();
}

/** A preference is a non-exclusive invitation, never a selection or capacity reservation. */
export function attachPreferredFirm(db:Database,jobId:string,clientId:string,firmId:string){
  const job=db.prepare('SELECT * FROM jobs WHERE id=? AND client_id=?').get(jobId,clientId) as JobRow|undefined;
  if(!job||job.status!=='waiting'||job.mode!=='standard'||job.accepted_firm_id)throw new RetentionError('Solicită firma preferată printr-o cerere Standard nouă.');
  const firm=eligibleFavorite(db,clientId,firmId);
  if(!db.prepare('SELECT 1 FROM client_favorite_firms WHERE client_id=? AND firm_id=?').get(clientId,firmId))throw new RetentionError('Salvează firma la preferate înainte de a o solicita.',400);
  const category=job.space_type==='birou'?'office':'general';
  if(!firmCoversCity(firm.coverage_city,firm.coverage_cities_extra,job.city)||!db.prepare('SELECT 1 FROM service_catalog_firms WHERE firm_id=? AND category_key=? AND enabled=1').get(firmId,category))throw new RetentionError('Firma preferată nu acoperă acest serviciu sau această localitate. Poți continua fără preferință.');
  const unavailable=firmAvailabilityError(db,firmId,job);
  if(unavailable)throw new RetentionError('Firma preferată nu este disponibilă pentru programul ales. Poți continua fără preferință.');
  db.prepare('INSERT INTO job_preferred_requests(job_id,firm_id) VALUES(?,?)').run(jobId,firmId);
  notice(db,firm.user_id,jobId,'Un client cu care ai finalizat o lucrare îți solicită candidatura. Verifică lucrarea și programul.',`/firma?job=${encodeURIComponent(jobId)}`);
}

/** Only a whitelist leaves the server. No photos, access instructions, old dates or payments. */
export function repeatBookingValues(db:Database,clientId:string,jobId:string){
  const job=db.prepare("SELECT * FROM jobs WHERE id=? AND client_id=? AND status='completed'").get(jobId,clientId) as JobRow|undefined;
  if(!job)throw new RetentionError('Lucrarea finalizată nu este disponibilă în contul tău.',404);
  if(!validBathroomCount(job.bathroom_count)||!validWindowsSqm(job.windows_sqm??0)||db.prepare('SELECT 1 FROM assessment_offer_jobs WHERE job_id=?').get(jobId))
    throw new RetentionError('Această lucrare necesită o configurare nouă. Deschide formularul obișnuit.',400);
  const linked=db.prepare('SELECT p.* FROM workspace_property_jobs l JOIN workspace_properties p ON p.id=l.property_id WHERE l.job_id=?').get(jobId) as {id:string;owner_id:string;archived:number;kind:string;street:string;postal_code:string|null;floor:string|null;city:string;sqm:number;space_type:string;bathroom_count:number}|undefined;
  if(linked&&(linked.owner_id!==clientId||linked.archived||linked.kind!=='home'))throw new RetentionError('Proprietatea necesită o selecție și o verificare nouă. Deschide Locuințele mele.',409);
  const source=linked??job;
  // Free text can contain access codes or beneficiary details. Ask for fresh instructions.
  return {repeatJobId:jobId,propertyId:linked?.id??null,propertyUpdated:!!linked,street:source.street,postalCode:source.postal_code??'',floor:source.floor??'',city:source.city,
    sqm:source.sqm,spaceType:source.space_type,bathroomCount:validBathroomCount(source.bathroom_count)?source.bathroom_count:1,windowsSqm:job.windows_sqm??0,
    previousFirmId:job.accepted_firm_id,details:''};
}

export function attachRepeatOrigin(db:Database,jobId:string,clientId:string,originalId:string){
  repeatBookingValues(db,clientId,originalId);
  db.prepare('INSERT INTO job_repeat_origins(job_id,original_job_id) VALUES(?,?)').run(jobId,originalId);
}
