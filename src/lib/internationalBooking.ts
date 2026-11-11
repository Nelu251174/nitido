import type Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {internationalPricingEnabled} from './internationalRollout';
import {isAccountRemoved} from './accountStatus';
import {internationalTimezone} from './internationalScheduling';
import {InternationalTariffError,internationalCountry,internationalCity,listInternationalTariffs,internationalTariffBlockers,parseInternationalTariff,type InternationalCountry,type InternationalSpace,type InternationalService,type InternationalTariff,type InternationalTariffDefinition} from './internationalTariffs';

export type InternationalBookingContext={countryCode:InternationalCountry;city:string;spaceType:InternationalSpace;service:InternationalService;sqm:number;requestedDurationMinutes?:number};
export function internationalBookingContext(value:unknown):InternationalBookingContext{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new InternationalTariffError('Datele lucrării sunt invalide.');
 const d=value as Record<string,unknown>,countryCode=internationalCountry(d.countryCode),city=internationalCity(countryCode,d.city);
 if(d.currency!==undefined&&d.currency!=='EUR')throw new InternationalTariffError('Moneda nu corespunde țării lucrării.');
 if(!['apartament','casa','birou','altul'].includes(String(d.spaceType))||!['maintenance','general','renovation'].includes(String(d.service)))throw new InternationalTariffError('Tip de spațiu sau serviciu invalid.');
 if(typeof d.sqm!=='number'||!Number.isSafeInteger(d.sqm)||d.sqm<1||d.sqm>100000)throw new InternationalTariffError('Suprafață invalidă.');
 if(d.requestedDurationMinutes!==undefined&&(typeof d.requestedDurationMinutes!=='number'||!Number.isSafeInteger(d.requestedDurationMinutes)||d.requestedDurationMinutes<1||d.requestedDurationMinutes>1440))throw new InternationalTariffError('Durată invalidă.');
 if((d.creditMinor!==undefined&&d.creditMinor!==0)||d.grossMinor!==undefined||d.clientTotalMinor!==undefined||d.rateMinor!==undefined||d.workers!==undefined)throw new InternationalTariffError('Sumele și echipa provin exclusiv din tariful serverului; creditele RON nu se aplică în EUR.');
 return {countryCode,city,spaceType:d.spaceType as InternationalSpace,service:d.service as InternationalService,sqm:d.sqm,...(d.requestedDurationMinutes===undefined?{}:{requestedDurationMinutes:d.requestedDurationMinutes as number})};
}
export type InternationalPricingSnapshot={
 version:string;countryCode:InternationalCountry;city:string;currency:'EUR';tariffId:string;revision:number;
 spaceType:InternationalSpace;service:InternationalService;sqm:number;durationMinutes:number;workers:number;personMinutes:number;
 lines:{code:string;amountMinor:number}[];netMinor:number;vatMinor:number;vatBps:number;grossMinor:number;creditMinor:0;clientTotalMinor:number;
 recordedAt:string;timeZone:string;
};
const safe=(n:bigint):number=>{if(n<BigInt(0)||n>BigInt(Number.MAX_SAFE_INTEGER))throw new InternationalTariffError('Suma depășește limita de calcul.');return Number(n);};
const ceil=(n:bigint,d:bigint)=>(n+d-BigInt(1))/d;
/** This calculator never selects country, currency or a tariff from the visitor IP/language. */
export function calculateInternationalSnapshot(tariff:Pick<InternationalTariff,'id'|'revision'|'definition'>,context:InternationalBookingContext,now=new Date()):InternationalPricingSnapshot{
 const d=parseInternationalTariff(tariff.definition);
 if(internationalTariffBlockers(d,now).length)throw new InternationalTariffError('Tariful are condiții sau dovezi neconfirmate.',422);
 if(d.countryCode!==context.countryCode||d.city!==context.city||d.spaceType!==context.spaceType||d.service!==context.service)throw new InternationalTariffError('Tariful nu corespunde adresei sau serviciului.',409);
 if(context.sqm>d.maxSqm!)throw new InternationalTariffError('Suprafața necesită evaluare înainte de ofertare.',422);
 const durationMinutes=Math.max(180,d.minimumMinutes!,d.supplierMinimumMinutes!,d.durationMinutes!,context.requestedDurationMinutes??0),workers=d.workers!,personMinutes=durationMinutes*workers;
 let base:bigint;
 switch(d.rateUnit){
  case 'worker_hour':base=ceil(BigInt(d.rateMinor!)*BigInt(personMinutes),BigInt(60));break;
  case 'team_hour':base=ceil(BigInt(d.rateMinor!)*BigInt(durationMinutes),BigInt(60));break;
  case 'm2':base=BigInt(d.rateMinor!)*BigInt(context.sqm);break;
  case 'visit':base=BigInt(d.rateMinor!);break;
 }
 if(d.rateUnit!=='worker_hour'&&d.rateUnit!=='team_hour'&&context.requestedDurationMinutes!==undefined&&context.requestedDurationMinutes>Math.max(180,d.minimumMinutes!,d.supplierMinimumMinutes!,d.durationMinutes!))throw new InternationalTariffError('Durata suplimentară necesită evaluare pentru acest pachet.',422);
 const minimum=BigInt(d.minimumNetMinor!),service=base>minimum?base:minimum,materials=d.materials.status==='separate'?d.materials.feeMinor!:0,travel=d.travel.status==='separate'?d.travel.feeMinor!:0;
 const net=service+BigInt(materials)+BigInt(travel),vat=(net*BigInt(d.vatBps!)+BigInt(5000))/BigInt(10000),gross=net+vat;
 return {version:`international:${tariff.id}:${tariff.revision}`,countryCode:d.countryCode,city:d.city,currency:'EUR',tariffId:tariff.id,revision:tariff.revision,spaceType:d.spaceType,service:d.service,sqm:context.sqm,durationMinutes,workers,personMinutes,
  lines:[{code:'cleaning',amountMinor:safe(service)},...(materials?[{code:'materials_per_visit',amountMinor:materials}]:[]),...(travel?[{code:'travel_per_visit',amountMinor:travel}]:[]),{code:'vat',amountMinor:safe(vat)}],netMinor:safe(net),vatMinor:safe(vat),vatBps:d.vatBps!,grossMinor:safe(gross),creditMinor:0,clientTotalMinor:safe(gross),recordedAt:now.toISOString(),timeZone:internationalTimezone(d.countryCode)};
}
export function previewInternationalTariff(definition:InternationalTariffDefinition,value:unknown,now=new Date()){
 const context=internationalBookingContext(value),blockers=internationalTariffBlockers(definition,now);
 // Incomplete evidence can never produce a total that looks like a valid quote.
 if(blockers.length)return {status:'draft' as const,executable:false,blockers,snapshot:null};
 return {status:'draft' as const,executable:false,blockers:[],snapshot:calculateInternationalSnapshot({id:'preview',revision:0,definition},context,now)};
}
export const INTERNATIONAL_BOOKING_QUOTES_SCHEMA=`
CREATE TABLE IF NOT EXISTS international_booking_quotes(
 id TEXT PRIMARY KEY,client_id TEXT NOT NULL REFERENCES users(id),context_json TEXT NOT NULL,snapshot_json TEXT NOT NULL,
 created_at TEXT NOT NULL,expires_at TEXT NOT NULL,job_id TEXT UNIQUE REFERENCES jobs(id)
);
CREATE TRIGGER IF NOT EXISTS international_booking_quote_immutable BEFORE UPDATE ON international_booking_quotes
 WHEN NEW.id IS NOT OLD.id OR NEW.client_id IS NOT OLD.client_id OR NEW.context_json IS NOT OLD.context_json OR NEW.snapshot_json IS NOT OLD.snapshot_json
 OR NEW.created_at IS NOT OLD.created_at OR NEW.expires_at IS NOT OLD.expires_at OR (OLD.job_id IS NOT NULL AND NEW.job_id IS NOT OLD.job_id)
 BEGIN SELECT RAISE(ABORT,'International quote is immutable');END;
CREATE TRIGGER IF NOT EXISTS international_booking_quote_retained BEFORE DELETE ON international_booking_quotes BEGIN SELECT RAISE(ABORT,'International quote history is retained');END;
`;
export function ensureInternationalBookingSchema(db:Database.Database){db.exec(INTERNATIONAL_BOOKING_QUOTES_SCHEMA);}
type QuoteRow={id:string;client_id:string;context_json:string;snapshot_json:string;created_at:string;expires_at:string;job_id:string|null};
function assertClient(db:Database.Database,id:string){if(!db.prepare("SELECT 1 FROM users WHERE id=? AND role='client'").get(id)||isAccountRemoved(db,id))throw new InternationalTariffError('Contul clientului nu este disponibil.',403);}
function assertQuoteSchema(db:Database.Database){if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='international_booking_quotes'").get())throw new InternationalTariffError('Ofertarea internațională nu este inițializată.',503);}
/** Persist only an active, fully evidenced EUR offer. No payments or messages occur here. */
export function issueInternationalBookingQuote(db:Database.Database,clientId:string,rawContext:unknown,now=new Date()){
 const context=internationalBookingContext(rawContext);
 if(!internationalPricingEnabled())throw new InternationalTariffError('Rezervările internaționale nu sunt activate.',422);
 assertQuoteSchema(db);
 return db.transaction(()=>{
  assertClient(db,clientId);const candidates=listInternationalTariffs(db,now).filter(x=>x.status==='active'&&x.definition.countryCode===context.countryCode&&x.definition.city===context.city&&x.definition.spaceType===context.spaceType&&x.definition.service===context.service);
  if(candidates.length!==1)throw new InternationalTariffError(candidates.length?'Tarife active în conflict. Este necesară verificarea administrativă.':'Țara și serviciul nu au un tarif activ.',422);
  const snapshot=calculateInternationalSnapshot(candidates[0],context,now),id=randomUUID(),createdAt=now.toISOString(),expiresAt=new Date(now.getTime()+15*60000).toISOString();
  db.prepare('INSERT INTO international_booking_quotes VALUES(?,?,?,?,?,?,NULL)').run(id,clientId,JSON.stringify(context),JSON.stringify(snapshot),createdAt,expiresAt);
  return {id,expiresAt,context,pricing:snapshot};
 }).immediate();
}
/** Must be called within the same IMMEDIATE transaction as job creation/linking. */
export function acceptedInternationalBookingQuote(db:Database.Database,clientId:string,id:unknown,rawContext:unknown,now=new Date()):{snapshot:InternationalPricingSnapshot;jobId:string|null}{
 if(!internationalPricingEnabled())throw new InternationalTariffError('Rezervările internaționale nu sunt activate.',422);
 if(!db.inTransaction)throw new InternationalTariffError('Acceptarea ofertei necesită o tranzacție.',409);
 const context=internationalBookingContext(rawContext);if(typeof id!=='string'||!id||id.length>100)throw new InternationalTariffError('Confirmă oferta înainte de publicare.',409);
 assertQuoteSchema(db);assertClient(db,clientId);const row=db.prepare('SELECT * FROM international_booking_quotes WHERE id=? AND client_id=?').get(id,clientId) as QuoteRow|undefined;
 if(!row)throw new InternationalTariffError('Oferta nu este disponibilă pentru acest cont.',404);
 if(row.context_json!==JSON.stringify(context))throw new InternationalTariffError('Adresa sau serviciul s-au schimbat. Confirmă o ofertă nouă.',409);
 const snapshot=JSON.parse(row.snapshot_json) as InternationalPricingSnapshot;
 if(snapshot.currency!=='EUR'||snapshot.creditMinor!==0||snapshot.countryCode!==context.countryCode||snapshot.city!==context.city||snapshot.grossMinor!==snapshot.clientTotalMinor||!Number.isSafeInteger(snapshot.grossMinor)||snapshot.grossMinor<1)throw new InternationalTariffError('Oferta nu poate fi verificată.',409);
 if(row.job_id)return {snapshot,jobId:row.job_id};
 if(row.expires_at<=now.toISOString())throw new InternationalTariffError('Oferta a expirat. Confirmă prețul actual.',409);
 return {snapshot,jobId:null};
}
export function linkInternationalBookingQuote(db:Database.Database,clientId:string,id:string,jobId:string){
 if(!db.inTransaction)throw new InternationalTariffError('Legarea ofertei necesită o tranzacție.',409);
 const result=db.prepare('UPDATE international_booking_quotes SET job_id=? WHERE id=? AND client_id=? AND job_id IS NULL').run(jobId,id,clientId);
 if(result.changes!==1)throw new InternationalTariffError('Oferta a fost deja utilizată. Reîncarcă rezervările.',409);
}
