import type {SpaceType} from './pricing';
import {normalizeCity} from './text';

export const PRICING_SPACES: SpaceType[] = ['apartament','casa','birou','altul'];
export type PriceRule =
  | {method:'package'; tiers:{maxSqm:number;amountBani:number}[]; overflowRateBani:number}
  | {method:'sqm'|'hour';rateBani:number;minimumBani:number}
  | {method:'manual'};
export type PriceDefinition = {
  currency:'RON'; timezone:'Europe/Bucharest'; roundingBani:100;
  rules:Record<SpaceType,PriceRule>; windowsRateBani:number;
};
export type PriceScope = {kind:'national'} | {kind:'city';city:string} |
  {kind:'zone';city:string;zone:string} | {kind:'contract';contractId:string};
export type PriceInput = {spaceType:SpaceType;sqm:number;windowsSqm?:number;hours?:number};
export type PriceContext = {city?:string;zone?:string;contractId?:string};
export class ManagedPricingError extends Error {
  constructor(message:string, public status=400){super(message);}
}
const invalid=(message:string):never=>{throw new ManagedPricingError(message);};
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:invalid('Configurație invalidă.');
const integer=(v:unknown,min:number,max:number):number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max?v:invalid('Valoare numerică invalidă.');
const amount=(v:unknown)=>integer(v,0,100_000_000);
const text=(v:unknown)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=120?v.trim():invalid('Completează o valoare de maximum 120 de caractere.');

/** Initial configurable tariff reproduces the approved legacy calculator, including whole-leu rounding. */
export function initialPriceDefinition():PriceDefinition {
  return {currency:'RON',timezone:'Europe/Bucharest',roundingBani:100,windowsRateBani:800,rules:{
    apartament:{method:'package',tiers:[{maxSqm:40,amountBani:35000},{maxSqm:60,amountBani:45000},{maxSqm:80,amountBani:55000},{maxSqm:100,amountBani:65000}],overflowRateBani:650},
    casa:{method:'sqm',rateBani:700,minimumBani:35000},
    birou:{method:'sqm',rateBani:500,minimumBani:25000},
    altul:{method:'sqm',rateBani:600,minimumBani:30000},
  }};
}
export function validatePriceDefinition(value:unknown):PriceDefinition {
  const d=object(value),rules=object(d.rules);
  if(d.currency!=='RON'||d.timezone!=='Europe/Bucharest'||d.roundingBani!==100)invalid('Moneda, fusul și rotunjirea trebuie să păstreze politica actuală: RON, Europe/Bucharest, 1 leu.');
  const result={} as Record<SpaceType,PriceRule>;
  for(const space of PRICING_SPACES){
    const r=object(rules[space]);
    if(r.method==='manual')result[space]={method:'manual'};
    else if(r.method==='sqm'||r.method==='hour')result[space]={method:r.method,rateBani:integer(r.rateBani,1,100_000_000),minimumBani:amount(r.minimumBani)};
    else if(r.method==='package'){
      if(!Array.isArray(r.tiers)||!r.tiers.length||r.tiers.length>12)invalid('Un pachet trebuie să aibă între 1 și 12 praguri.');
      const tiers=(r.tiers as unknown[]).map(value=>{const t=object(value);return {maxSqm:integer(t.maxSqm,1,1000),amountBani:integer(t.amountBani,1,100_000_000)};});
      for(let i=1;i<tiers.length;i++)if(tiers[i].maxSqm<=tiers[i-1].maxSqm||tiers[i].amountBani<tiers[i-1].amountBani)invalid('Pragurile trebuie să crească, iar prețul nu poate scădea la o suprafață mai mare.');
      result[space]={method:'package',tiers,overflowRateBani:integer(r.overflowRateBani,1,100_000_000)};
    }else invalid('Metodă de calcul necunoscută.');
  }
  return {currency:'RON',timezone:'Europe/Bucharest',roundingBani:100,rules:result,windowsRateBani:amount(d.windowsRateBani)};
}
export function validatePriceScope(value:unknown):PriceScope {
  const s=object(value);
  if(s.kind==='national')return {kind:'national'};
  if(s.kind==='city')return {kind:'city',city:normalizeCity(text(s.city))};
  if(s.kind==='zone')return {kind:'zone',city:normalizeCity(text(s.city)),zone:normalizeCity(text(s.zone))};
  if(s.kind==='contract')return {kind:'contract',contractId:text(s.contractId)};
  return invalid('Arie de aplicare invalidă.');
}
export function priceScopeKey(scope:PriceScope):string{return JSON.stringify(validatePriceScope(scope));}
export function scopePriority(scope:PriceScope):number{return {national:0,city:1,zone:2,contract:3}[scope.kind];}
export function scopeMatches(scope:PriceScope,context:PriceContext):boolean {
  if(scope.kind==='national')return true;
  if(scope.kind==='contract')return scope.contractId===context.contractId;
  if(!context.city||scope.city!==normalizeCity(context.city))return false;
  return scope.kind==='city'||!!context.zone&&scope.zone===normalizeCity(context.zone);
}
export function calculateManagedPrice(definition:PriceDefinition,input:PriceInput){
  if(!input||!PRICING_SPACES.includes(input.spaceType))invalid('Tip de spațiu invalid.');
  const sqm=integer(input.sqm,1,1000),windowsSqm=integer(input.windowsSqm??0,0,200),r=definition.rules[input.spaceType];
  if(r.method==='manual')throw new ManagedPricingError('Este necesară o ofertă manuală; nu poate fi confirmat un preț automat.',422);
  let raw:number;
  if(r.method==='package'){
    const tier=r.tiers.find(t=>sqm<=t.maxSqm),last=r.tiers[r.tiers.length-1];
    raw=tier?tier.amountBani:last.amountBani+(sqm-last.maxSqm)*r.overflowRateBani;
  }else raw=Math.max(r.minimumBani,r.rateBani*(r.method==='sqm'?sqm:integer(input.hours,1,24)));
  const cleaningBani=Math.round(raw/100)*100,windowsBani=windowsSqm*definition.windowsRateBani;
  const totalBani=cleaningBani+windowsBani;
  if(!Number.isSafeInteger(totalBani)||totalBani>100_000_000)invalid('Suma depășește limita de calcul.');
  return {currency:'RON' as const,cleaningBani,windowsBani,totalBani,lines:[{code:'cleaning',amountBani:cleaningBani},...(windowsSqm?[{code:'windows',amountBani:windowsBani}]:[])]};
}
