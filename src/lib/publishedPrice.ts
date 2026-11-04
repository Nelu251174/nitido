import type {Database} from 'better-sqlite3';
import {internationalCrewTeam} from './internationalCrewCapacity';
import {EU_COUNTRIES} from './serviceMarkets';
import {internationalPricingEnabled} from './internationalRollout';

export interface PublishedPrice {recordedAt:string;grossBani:number;creditBani:number;clientTotalBani:number;lines:{code:string;amountBani:number}[]}
export function readPublishedPrice(raw:string|null|undefined):PublishedPrice|null {
 if(!raw)return null;
 try{
  const p=JSON.parse(raw);
  if(!p||p.currency!=='RON'||typeof p.recordedAt!=='string'||!Number.isFinite(Date.parse(p.recordedAt))||!Array.isArray(p.lines)||![3,4,5].includes(p.lines.length))return null;
  if(![p.grossBani,p.creditBani,p.clientTotalBani].every(v=>Number.isSafeInteger(v)&&v>=0)||p.grossBani-p.creditBani!==p.clientTotalBani)return null;
  const codes=['cleaning',...(p.lines.some((l:{code?:string})=>l?.code==='additional_bathrooms')?['additional_bathrooms']:[]),...(p.lines.some((l:{code?:string})=>l?.code==='windows')?['windows']:[]),'express60','platform_credit'];
  if(codes.length!==p.lines.length)return null;
  for(let i=0;i<codes.length;i++){const l=p.lines[i];if(!l||l.code!==codes[i]||!Number.isSafeInteger(l.amountBani)||(i<codes.length-1&&l.amountBani<0))return null}
  if(p.lines.slice(0,-1).reduce((n:number,l:{amountBani:number})=>n+l.amountBani,0)!==p.grossBani||p.lines.at(-1).amountBani!==-p.creditBani)return null;
  return p;
 }catch{return null}
}

export interface InternationalPublishedPrice{
 currency:'EUR';countryCode:string;city:string;tariffId:string;revision:number;recordedAt:string;
 netMinor:number;vatMinor:number;vatBps:number;grossMinor:number;creditMinor:0;clientTotalMinor:number;
 durationMinutes:number;workers:number;personMinutes:number;lines:{code:string;amountMinor:number}[];
}
/** Read stored EUR money as EUR. Never pass it through the RON conversion reader. */
export function readInternationalPublishedPrice(raw:string|null|undefined):InternationalPublishedPrice|null{
 if(!raw)return null;
 try{
  const p=JSON.parse(raw);
  if(!p||p.currency!=='EUR'||p.countryCode==='RO'||!(EU_COUNTRIES as readonly string[]).includes(p.countryCode)||typeof p.city!=='string'||!p.city.trim()||typeof p.tariffId!=='string'||!p.tariffId.trim()||!Number.isSafeInteger(p.revision)||p.revision<1||typeof p.recordedAt!=='string'||!Number.isFinite(Date.parse(p.recordedAt)))return null;
  if(![p.netMinor,p.vatMinor,p.vatBps,p.grossMinor,p.clientTotalMinor,p.creditMinor].every(x=>Number.isSafeInteger(x)&&x>=0)||p.vatBps>10000||p.grossMinor<1||p.creditMinor!==0||p.grossMinor!==p.clientTotalMinor||p.netMinor+p.vatMinor!==p.grossMinor)return null;
  if(!Number.isSafeInteger(p.durationMinutes)||p.durationMinutes<180||p.durationMinutes>1440||!Number.isSafeInteger(p.workers)||p.workers<1||p.workers>100||p.personMinutes!==p.durationMinutes*p.workers)return null;
  if(!Array.isArray(p.lines)||p.lines.length<2||p.lines.length>4)return null;
  const codes=['cleaning',...(p.lines.some((x:{code?:string})=>x?.code==='materials_per_visit')?['materials_per_visit']:[]),...(p.lines.some((x:{code?:string})=>x?.code==='travel_per_visit')?['travel_per_visit']:[]),'vat'];
  if(codes.length!==p.lines.length||p.lines.some((x:{code:string;amountMinor:number},i:number)=>!x||x.code!==codes[i]||!Number.isSafeInteger(x.amountMinor)||x.amountMinor<0))return null;
  if(p.lines.slice(0,-1).reduce((n:number,x:{amountMinor:number})=>n+x.amountMinor,0)!==p.netMinor||p.lines.at(-1).amountMinor!==p.vatMinor)return null;
  if(Number((BigInt(p.netMinor)*BigInt(p.vatBps)+BigInt(5000))/BigInt(10000))!==p.vatMinor)return null;
  return p;
 }catch{return null;}
}
type MarketJob={id?:string;scheduled_at?:string|null;when_type?:string;buffer_minutes?:number;pricing_snapshot?:string|null;price_gross?:number;credit_applied?:number;city?:string;duration_minutes?:number};
type MarketFirm={id?:string;stripe_identity_country?:string|null;stripe_default_currency?:string|null;verified?:number;stripe_account_id?:string|null;stripe_account_status?:string;stripe_transfers_capability?:string};
/** Country identity is provider-owned persisted data, never coverage city, IP or UI locale. */
export function providerMarketError(job:MarketJob,firm:MarketFirm,requireRollout=true,db?:Database):string|null{
 let currency='RON',country='RO';
 if(job.pricing_snapshot){try{const raw=JSON.parse(job.pricing_snapshot);if(!raw||typeof raw!=='object'||Array.isArray(raw))return 'Prețul publicat nu poate fi verificat.';currency=raw.currency;country=raw.countryCode??(currency==='RON'?'RO':'');}catch{return 'Prețul publicat nu poate fi verificat.';}}
 if(currency!=='RON'&&currency!=='EUR')return 'Moneda lucrării nu poate fi verificată.';
 if(currency==='RON'&&country!=='RO')return 'Țara și moneda lucrării nu corespund.';
 const firmCountry=firm.stripe_identity_country??'RO';
 if(firmCountry!==country)return 'Firma nu este verificată pentru țara lucrării.';
 if(currency==='RON')return null;
 const snapshot=readInternationalPublishedPrice(job.pricing_snapshot);if(!snapshot)return 'Prețul internațional publicat nu poate fi verificat.';
 if(requireRollout&&!internationalPricingEnabled())return 'Preluarea lucrărilor internaționale nu este activată.';
 if(firm.stripe_default_currency!=='EUR')return 'Firma nu are moneda EUR configurată.';
 if(!firm.verified||!firm.stripe_account_id||firm.stripe_account_status!=='ready'||firm.stripe_transfers_capability!=='active')return 'Contul Stripe al firmei nu este pregătit pentru această piață.';
 if(job.price_gross!==undefined&&(!Number.isFinite(job.price_gross)||Math.abs(job.price_gross*100-snapshot.grossMinor)>0.0000001))return 'Suma lucrării nu corespunde ofertei EUR.';
 if(job.credit_applied!==undefined&&job.credit_applied!==0)return 'Creditele RON nu se aplică lucrărilor EUR.';
 if(job.city!==undefined&&job.city!==snapshot.city)return 'Adresa lucrării nu corespunde ofertei EUR.';
 if(job.duration_minutes!==undefined&&job.duration_minutes!==snapshot.durationMinutes)return 'Durata lucrării nu corespunde ofertei EUR.';
 if(!db||!firm.id||!internationalCrewTeam(db,job,firm.id,snapshot.workers))return 'Firma nu are o echipă proprie cu efectiv verificat și disponibil pentru această lucrare.';
 return null;
}
