import type {Database} from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {ManagedPricingError,PRICING_SPACES} from './managedPricing';
import {resolveManagedPrice} from './managedPricingStore';
import {normalizeCity} from './text';
import {BUFFER_MINUTES,calcServiceDuration,type SpaceType} from './pricing';
import {EXPRESS_60_FEE_LEI} from './express60';

// Deliberately restricted to the existing sandbox; a production rollout needs its own gate.
export function managedBookingEnabled():boolean {
  return process.env.NITIDO_MANAGED_PRICING_SANDBOX==='true'
    && process.env.NEXT_PUBLIC_SITE_URL==='https://sandbox.nitido.ro'
    && !process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_');
}
export const BOOKING_QUOTES_SCHEMA=`
CREATE TABLE IF NOT EXISTS booking_price_quotes(
 id TEXT PRIMARY KEY,client_id TEXT NOT NULL REFERENCES users(id),
 context_json TEXT NOT NULL,snapshot_json TEXT NOT NULL,
 created_at TEXT NOT NULL,expires_at TEXT NOT NULL,
 job_id TEXT UNIQUE REFERENCES jobs(id)
);
CREATE TRIGGER IF NOT EXISTS booking_quote_immutable BEFORE UPDATE ON booking_price_quotes
 WHEN NEW.id IS NOT OLD.id OR NEW.client_id IS NOT OLD.client_id OR NEW.context_json IS NOT OLD.context_json
 OR NEW.snapshot_json IS NOT OLD.snapshot_json OR NEW.created_at IS NOT OLD.created_at OR NEW.expires_at IS NOT OLD.expires_at
 OR (OLD.job_id IS NOT NULL AND NEW.job_id IS NOT OLD.job_id)
 BEGIN SELECT RAISE(ABORT,'Accepted quote is immutable'); END;
CREATE TRIGGER IF NOT EXISTS booking_quote_no_delete BEFORE DELETE ON booking_price_quotes
 BEGIN SELECT RAISE(ABORT,'Quote history is retained'); END;
`;
export type BookingPriceContext={city:string;spaceType:SpaceType;sqm:number;windowsSqm:number;mode:'standard'|'express';express60:boolean};
export function bookingPriceContext(body:Record<string,unknown>):BookingPriceContext {
  if(typeof body.city!=='string'||!body.city.trim()||body.city.length>120)throw new ManagedPricingError('Localitate invalidă.');
  if(!PRICING_SPACES.includes(body.spaceType as SpaceType)||!Number.isSafeInteger(body.sqm)||Number(body.sqm)<1||Number(body.sqm)>1000)throw new ManagedPricingError('Parametri de serviciu invalizi.');
  const windowsSqm=body.windowsSqm??0;
  if(!Number.isSafeInteger(windowsSqm)||Number(windowsSqm)<0||Number(windowsSqm)>200)throw new ManagedPricingError('Suprafață geamuri invalidă.');
  if(body.contractId!=null||body.zone!=null||body.hours!=null)throw new ManagedPricingError('Acest flux nu validează încă tarifele de contract, zonă sau orare.',422);
  if(body.mode!=null&&body.mode!=='standard'&&body.mode!=='express')throw new ManagedPricingError('Mod de rezervare invalid.');
  if(body.express60!=null&&typeof body.express60!=='boolean')throw new ManagedPricingError('Opțiune Express invalidă.');
  return {city:normalizeCity(body.city),spaceType:body.spaceType as SpaceType,sqm:Number(body.sqm),windowsSqm:Number(windowsSqm),mode:body.express60?'express':body.mode==='standard'?'standard':'express',express60:body.express60===true};
}
export type BookingPriceSnapshot={version:string;quoteId:string;currency:'RON';recordedAt:string;expiresAt:string;spaceType:SpaceType;sqm:number;windowsSqm:number;durationMinutes:number;bufferMinutes:number;lines:{code:string;amountBani:number}[];grossBani:number;creditBani:number;clientTotalBani:number};
export type BookingQuote={id:string;client_id:string;context_json:string;snapshot_json:string;created_at:string;expires_at:string;job_id:string|null};
function creditBani(db:Database,clientId:string){
  const user=db.prepare("SELECT credit_balance FROM users WHERE id=? AND role='client'").get(clientId) as {credit_balance:number}|undefined;
  const credit=Math.round(Number(user?.credit_balance)*100);
  if(!user||!Number.isSafeInteger(credit)||credit<0)throw new ManagedPricingError('Soldul clientului nu poate fi verificat.',409);
  return credit;
}
export function issueBookingQuote(db:Database,clientId:string,context:BookingPriceContext,now=new Date()) {
  return db.transaction(()=>{
    // A free-text zone or contract supplied by a client must never unlock a preferential price.
    const zones=db.prepare("SELECT scope_json FROM managed_tariffs WHERE status='published' AND valid_from<=? AND (valid_until IS NULL OR valid_until>?)").all(now.toISOString(),now.toISOString()) as {scope_json:string}[];
    if(zones.some(r=>{const s=JSON.parse(r.scope_json);return s.kind==='zone'&&s.city===context.city;}))throw new ManagedPricingError('Localitatea are tarife pe zone; adresa trebuie validată înainte de calcul.',422);
    const price=resolveManagedPrice(db,{city:context.city},context,now);
    const extra=context.express60?Math.round(EXPRESS_60_FEE_LEI*100):0,grossBani=price.totalBani+extra;
    const credit=Math.min(creditBani(db,clientId),grossBani),id=randomUUID();
    const expiresAt=new Date(now.getTime()+15*60*1000).toISOString();
    const snapshot:BookingPriceSnapshot={version:`managed:${price.tariffId}:${price.revision}`,quoteId:id,currency:'RON',recordedAt:now.toISOString(),expiresAt,spaceType:context.spaceType,sqm:context.sqm,windowsSqm:context.windowsSqm,durationMinutes:calcServiceDuration(context.sqm,context.windowsSqm),bufferMinutes:BUFFER_MINUTES,lines:[...price.lines,{code:'express60',amountBani:extra},{code:'platform_credit',amountBani:-credit}],grossBani,creditBani:credit,clientTotalBani:grossBani-credit};
    db.prepare('INSERT INTO booking_price_quotes VALUES(?,?,?,?,?,?,NULL)').run(id,clientId,JSON.stringify(context),JSON.stringify(snapshot),now.toISOString(),expiresAt);
    return {id,expiresAt,priceGross:grossBani/100,pricing:snapshot};
  }).immediate();
}
/** Must be called inside the same immediate transaction as job creation and credit debit. */
export function acceptedBookingQuote(db:Database,clientId:string,id:unknown,context:BookingPriceContext,now=new Date()) {
  if(typeof id!=='string')throw new ManagedPricingError('Verifică și confirmă oferta înainte de publicare.',409);
  const row=db.prepare('SELECT * FROM booking_price_quotes WHERE id=? AND client_id=?').get(id,clientId) as BookingQuote|undefined;
  if(!row)throw new ManagedPricingError('Oferta nu este disponibilă pentru acest cont.',409);
  if(row.context_json!==JSON.stringify(context))throw new ManagedPricingError('Datele lucrării s-au schimbat. Solicită și confirmă o ofertă nouă.',409);
  const snapshot=JSON.parse(row.snapshot_json) as BookingPriceSnapshot;
  if(row.job_id)return {snapshot,jobId:row.job_id};
  if(row.expires_at<=now.toISOString())throw new ManagedPricingError('Oferta a expirat. Solicită și confirmă noul preț.',409);
  if(creditBani(db,clientId)<snapshot.creditBani)throw new ManagedPricingError('Creditul disponibil s-a schimbat. Verifică noua ofertă.',409);
  return {snapshot,jobId:null};
}
export function linkBookingQuote(db:Database,clientId:string,id:string,jobId:string){
  const result=db.prepare('UPDATE booking_price_quotes SET job_id=? WHERE id=? AND client_id=? AND job_id IS NULL').run(jobId,id,clientId);
  if(result.changes!==1)throw new ManagedPricingError('Oferta a fost deja folosită. Reîncarcă rezervările.',409);
}
