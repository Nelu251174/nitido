import type {Database} from 'better-sqlite3';
import {calcNetForFirm} from './pricing';
import {EU_COUNTRIES} from './serviceMarkets';
import {internationalPricingEnabled} from './internationalRollout';

export type PaymentCurrency = 'RON'|'EUR';
export type PaymentMoney = {
 currency:PaymentCurrency;stripeCurrency:'ron'|'eur';
 clientAmount:number;firmAmount:number;platformAmount:number;
 clientAmountMinor:number;firmAmountMinor:number;platformAmountMinor:number;
};

/** Additive only: legacy values and accepted pricing snapshots are never rewritten. */
export function ensurePaymentMoneySchema(db:Database){
 const definitions:Record<string,Record<string,string>>={
  payments:{currency:"TEXT NOT NULL DEFAULT 'RON'",amount_gross_minor:'INTEGER',commission_amount_minor:'INTEGER',amount_net_minor:'INTEGER',stripe_fee_currency:'TEXT'},
  payment_refunds:{currency:"TEXT NOT NULL DEFAULT 'RON'",amount_minor:'INTEGER'},
  authorization_coverage:{currency:"TEXT NOT NULL DEFAULT 'RON'"},
  firms:{stripe_identity_country:"TEXT NOT NULL DEFAULT 'RO'",stripe_default_currency:"TEXT NOT NULL DEFAULT 'RON'"},
 };
 for(const [table,columns] of Object.entries(definitions)){
  const existing=db.prepare(`PRAGMA table_info(${table})`).all() as {name:string}[];
  if(!existing.length)continue;
  for(const [name,definition] of Object.entries(columns))if(!existing.some(c=>c.name===name))db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
 }
}

export function paymentCurrency(value:unknown,legacyDefault=false):PaymentCurrency{
 if(value===undefined&&legacyDefault)return 'RON';
 if(value!=='RON'&&value!=='EUR')throw Error('PAYMENT_CURRENCY_INVALID');
 return value;
}
export const stripePaymentCurrency=(value:PaymentCurrency)=>value==='RON'?'ron' as const:'eur' as const;
function minor(value:unknown,positive=false):number{
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<(positive?1:0))throw Error('PAYMENT_AMOUNT_INVALID');
 return value;
}
function majorToMinor(value:unknown):number{
 if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw Error('PAYMENT_AMOUNT_INVALID');
 // Read the decimal value instead of multiplying its binary representation:
 // e.g. 1.1*100 is 110.00000000000001 in JavaScript.
 const [coefficient,exponent='0']=value.toString().toLowerCase().split('e');
 const [whole,fraction='']=coefficient.split('.');
 const digits=BigInt(whole+fraction),scale=Number(exponent)+2-fraction.length;
 const divisor=scale<0?BigInt(10)**BigInt(-scale):BigInt(1);
 const scaled=scale>=0?digits*BigInt(10)**BigInt(scale):digits;
 const rounded=(scaled+divisor/BigInt(2))/divisor;
 const amount=minor(Number(rounded));
 if(scale<0&&scaled%divisor!==BigInt(0)){
  // Permit only arithmetic round-off such as (1.1-1), not a third decimal.
  const tolerance=Math.min(0.0000001,Number.EPSILON*Math.max(1,value)*2);
  if(Math.abs(value-amount/100)>tolerance)throw Error('PAYMENT_AMOUNT_INVALID');
 }
 return amount;
}
function snapshotForJob(db:Database,jobId:string):Record<string,unknown>|null{
 const columns=db.prepare('PRAGMA table_info(jobs)').all() as {name:string}[];
 if(!columns.some(c=>c.name==='pricing_snapshot'))return null;
 const job=db.prepare('SELECT pricing_snapshot FROM jobs WHERE id=?').get(jobId) as {pricing_snapshot:string|null}|undefined;
 if(!job)throw Error('PAYMENT_JOB_MISSING');
 if(job.pricing_snapshot===null||job.pricing_snapshot===undefined)return null;
 try{
  const value=JSON.parse(job.pricing_snapshot) as unknown;
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error();
  return value as Record<string,unknown>;
 }catch{throw Error('PAYMENT_SNAPSHOT_INVALID');}
}
/** Server-owned immutable snapshot, never a currency or price supplied by the payer. */
export function authorizationMoney(db:Database,jobId:string,grossAmount:number,discountAmount=0,requireRollout=true):PaymentMoney{
 const snapshot=snapshotForJob(db,jobId);
 const currency=paymentCurrency(snapshot?.currency,true);
 if(currency==='EUR'){
  if(requireRollout&&!internationalPricingEnabled())throw Error('INTERNATIONAL_PRICING_DISABLED');
  if(typeof snapshot?.countryCode!=='string'||snapshot.countryCode==='RO'||!(EU_COUNTRIES as readonly string[]).includes(snapshot.countryCode))throw Error('PAYMENT_SNAPSHOT_INVALID');
  if(typeof snapshot.tariffId!=='string'||!snapshot.tariffId.trim()||typeof snapshot.revision!=='number'||!Number.isSafeInteger(snapshot.revision)||snapshot.revision<=0)throw Error('PAYMENT_SNAPSHOT_INVALID');
  const total=minor(snapshot.grossMinor,true),client=minor(snapshot.clientTotalMinor,true);
  if(snapshot.creditMinor!==0||discountAmount!==0||client!==total)throw Error('EUR_CREDIT_NOT_SUPPORTED');
  // Round the firm's 82% to the nearest cent using integer arithmetic.
  const firm=Number((BigInt(total)*BigInt(82)+BigInt(50))/BigInt(100)),platform=client-firm;
  return {currency,stripeCurrency:'eur',clientAmount:client/100,firmAmount:firm/100,platformAmount:platform/100,clientAmountMinor:client,firmAmountMinor:firm,platformAmountMinor:platform};
 }
 if(snapshot?.countryCode!==undefined&&snapshot.countryCode!=='RO')throw Error('PAYMENT_SNAPSHOT_INVALID');
 // Keep the historical Romanian whole-lei split and credit floor exactly.
 const firmAmount=calcNetForFirm(grossAmount),clientAmount=Math.max(firmAmount,grossAmount-Math.max(0,discountAmount)),platformAmount=clientAmount-firmAmount;
 return {currency,stripeCurrency:'ron',clientAmount,firmAmount,platformAmount,clientAmountMinor:majorToMinor(clientAmount),firmAmountMinor:majorToMinor(firmAmount),platformAmountMinor:majorToMinor(platformAmount)};
}

/** Stored money remains usable for capture/cancellation/refund when rollout is disabled. */
export function moneyFromPayment(row:Record<string,unknown>):PaymentMoney{
 const currency=paymentCurrency(row.currency,true);
 const read=(key:string,legacy:string)=>{
  const raw=row[key];
  if(raw===undefined||raw===null){if(currency==='EUR')throw Error('PAYMENT_AMOUNT_INVALID');return majorToMinor(row[legacy]);}
  return minor(raw);
 };
 const client=read('amount_gross_minor','amount_gross'),firm=read('amount_net_minor','amount_net'),platform=read('commission_amount_minor','commission_amount');
 if(!client||firm+platform!==client||!Number.isSafeInteger(firm+platform))throw Error('PAYMENT_AMOUNT_INVALID');
 if(currency==='RON'&&(majorToMinor(row.amount_gross)!==client||majorToMinor(row.amount_net)!==firm||majorToMinor(row.commission_amount)!==platform))throw Error('PAYMENT_AMOUNT_INVALID');
 return {currency,stripeCurrency:stripePaymentCurrency(currency),clientAmount:client/100,firmAmount:firm/100,platformAmount:platform/100,clientAmountMinor:client,firmAmountMinor:firm,platformAmountMinor:platform};
}

/** Recovery with no payment row uses the exact persisted authorization request. */
export function moneyFromAuthorizationRequest(params:{currency?:unknown;amount?:unknown}){
 if(params.currency!=='ron'&&params.currency!=='eur')throw Error('PAYMENT_CURRENCY_INVALID');
 return {currency:params.currency==='ron'?'RON' as const:'EUR' as const,stripeCurrency:params.currency,amountMinor:minor(params.amount,true)};
}
