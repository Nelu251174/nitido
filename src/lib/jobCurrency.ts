import {calcNetForFirm} from './pricing';
import {readInternationalPublishedPrice} from './publishedPrice';
import {internationalTimezone} from './internationalScheduling';

export type JobCurrency = 'RON' | 'EUR';
export type JobMoneySource = {pricing_snapshot?:string|null;currency?:JobCurrency|null;price_gross?:number};

function snapshot(value:string|null|undefined):Record<string,unknown>|null {
  if(value===null||value===undefined||value==='')return {};
  try {const data:unknown=JSON.parse(value);return data&&typeof data==='object'&&!Array.isArray(data)?data as Record<string,unknown>:null;}catch{return null;}
}

/** Immutable work pricing decides currency; viewer country/language never does. */
export function currencyOfJob(job:JobMoneySource|string|null|undefined):JobCurrency|null {
  const object=typeof job==='object'&&job!==null?job:null;
  if(object&&(object.pricing_snapshot===null||object.pricing_snapshot===undefined)&&object.currency!==undefined)return object.currency==='RON'||object.currency==='EUR'?object.currency:null;
  const data=snapshot(object?object.pricing_snapshot:job as string|null|undefined);
  if(!data)return null;
  if(data.currency===undefined)return data.countryCode===undefined||data.countryCode==='RO'?'RON':null;
  if(data.currency==='RON')return data.countryCode===undefined||data.countryCode==='RO'?'RON':null;
  if(data.currency==='EUR')return readInternationalPublishedPrice(object?object.pricing_snapshot:job as string|null|undefined)?'EUR':null;
  return null;
}

export function jobGrossMinor(job:JobMoneySource):number|null {
  const currency=currencyOfJob(job);
  if(!currency)return null;
  if(currency==='EUR') {
    const data=snapshot(job.pricing_snapshot),value=data?.grossMinor;
    return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;
  }
  return typeof job.price_gross==='number'&&Number.isFinite(job.price_gross)&&job.price_gross>=0&&Number.isSafeInteger(Math.round(job.price_gross*100))?Math.round(job.price_gross*100):null;
}

/** Unaccepted EUR feed estimates use cents; legacy RO whole-lei rounding is retained. */
export function firmAmountForJob(job:JobMoneySource):number|null {
  const currency=currencyOfJob(job);
  if(currency==='RON')return typeof job.price_gross==='number'&&Number.isFinite(job.price_gross)?calcNetForFirm(job.price_gross):null;
  const gross=jobGrossMinor(job);
  return currency==='EUR'&&gross!==null?Number((BigInt(gross)*BigInt(82)+BigInt(50))/BigInt(100))/100:null;
}

export function serializeJobCurrency<T extends JobMoneySource>(job:T):T&{currency:JobCurrency|null} {
  const currency=currencyOfJob(job),gross=jobGrossMinor(job);
  return {...job,currency,...(currency==='EUR'&&gross!==null?{price_gross:gross/100}:{})};
}

export function jobScheduleContext(raw:string|null|undefined):{countryCode:string;timeZone:string}|null {
 const currency=currencyOfJob(raw);
 if(currency==='RON')return {countryCode:'RO',timeZone:'Europe/Bucharest'};
 const international=readInternationalPublishedPrice(raw);
 return currency==='EUR'&&international?{countryCode:international.countryCode,timeZone:internationalTimezone(international.countryCode)}:null;
}

export function jobGrossTotals(jobs:readonly JobMoneySource[]) {
  const totals={RON:{amountMinor:0,amount:0,count:0},EUR:{amountMinor:0,amount:0,count:0},unrecognizedCount:0};
  for(const job of jobs){const currency=currencyOfJob(job),minor=jobGrossMinor(job);if(!currency||minor===null){totals.unrecognizedCount++;continue;}const next=totals[currency].amountMinor+minor;if(!Number.isSafeInteger(next))throw Error('JOB_REPORT_AMOUNT_OVERFLOW');totals[currency].amountMinor=next;totals[currency].count++;}
  totals.RON.amount=totals.RON.amountMinor/100;totals.EUR.amount=totals.EUR.amountMinor/100;
  return totals;
}
