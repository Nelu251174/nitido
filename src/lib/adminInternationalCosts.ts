import {EU_COUNTRIES,serviceCountry,type ServiceCountry} from './serviceMarkets';

export const INTERNATIONAL_COST_MODEL_VERSION=1;
export type PlanningCountry=Exclude<ServiceCountry,'RO'>;
export type PlanningCurrency='EUR'|'CZK'|'DKK'|'HUF'|'PLN'|'SEK';
export const INTERNATIONAL_MARKETS:readonly {code:PlanningCountry;name:string;currency:PlanningCurrency}[]=[
 ['AT','Austria','EUR'],['BE','Belgia','EUR'],['BG','Bulgaria','EUR'],['HR','Croația','EUR'],['CY','Cipru','EUR'],['CZ','Cehia','CZK'],['DK','Danemarca','DKK'],['EE','Estonia','EUR'],['FI','Finlanda','EUR'],['FR','Franța','EUR'],['DE','Germania','EUR'],['GR','Grecia','EUR'],['HU','Ungaria','HUF'],['IE','Irlanda','EUR'],['IT','Italia','EUR'],['LV','Letonia','EUR'],['LT','Lituania','EUR'],['LU','Luxemburg','EUR'],['MT','Malta','EUR'],['NL','Țările de Jos','EUR'],['PL','Polonia','PLN'],['PT','Portugalia','EUR'],['SK','Slovacia','EUR'],['SI','Slovenia','EUR'],['ES','Spania','EUR'],['SE','Suedia','SEK'],
].map(([code,name,currency])=>({code:code as PlanningCountry,name,currency:currency as PlanningCurrency}));
export const COST_EVIDENCE={payroll:'Cost salarial complet',billableHours:'Ore facturabile reale',operatingCosts:'Cheltuieli complete',supplierOffer:'Ofertă de furnizor',coverage:'Acoperire și disponibilitate',tax:'Tratament TVA',settlement:'Monedă de încasare și procesare'} as const;
export type InternationalCostInput={
 basis:'illustrative'|'supplier_costs';
 countryCode:PlanningCountry;city:string;supplier:string;space:'apartament'|'casa'|'birou'|'altul';
 service:'intretinere'|'generala'|'dupa_renovare';currency:PlanningCurrency;
 /** Per worker, including all employer costs and paid leave/bonuses. Never a net wage. */
 annualEmployerCostMinor:number;annualBillableMinutes:number;
 materialsHourlyMinor:number;equipmentHourlyMinor:number;overheadHourlyMinor:number;
 /** A shared vehicle/trip cost per visit, not per worker. */
 travelPerVisitMinor:number;otherPerVisitMinor:number;
 workers:number;onsiteMinutes:number;supplierMinimumMinutes:number;supplierMinimumNetMinor:number|null;
 platformAndProcessingBps:number;operatingMarginBps:number;vatBps:number|null;roundingMinor:number;
 validUntil:string|null;sourceNote:string;sourceUrls:string[];
 evidence:Record<keyof typeof COST_EVIDENCE,boolean>;
};
export class InternationalCostError extends Error{constructor(message:string,public status=400){super(message);}}
const fail=(message:string):never=>{throw new InternationalCostError(message);};
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:fail('Date de calcul invalide.');
const integer=(v:unknown,min:number,max:number):number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max?v:fail('Valoare numerică invalidă.');
const text=(v:unknown,max:number,empty=false):string=>typeof v==='string'&&(empty||!!v.trim())&&v.trim().length<=max?v.trim():fail('Completează datele de identificare și sursele, în limitele indicate.');
const money=(v:unknown,min=0)=>integer(v,min,1_000_000_000_000);
export function planningCurrency(country:PlanningCountry):PlanningCurrency{
 const market=INTERNATIONAL_MARKETS.find(m=>m.code===country);return market?.currency??fail('Piață internațională invalidă.');
}
export function validateInternationalCostInput(value:unknown):InternationalCostInput{
 const d=obj(value);let country:ServiceCountry;
 if(d.basis!=='illustrative'&&d.basis!=='supplier_costs')fail('Precizează dacă datele sunt ilustrative sau provin de la furnizor.');
 try{country=serviceCountry(d.countryCode);}catch{throw new InternationalCostError('Țara lucrării este invalidă.');}
 if(country==='RO')fail('România folosește configurația existentă și nu poate fi modificată în acest registru.');
 const countryCode=country as PlanningCountry,currency=planningCurrency(countryCode);
 if(d.currency!==currency)fail('Moneda trebuie să corespundă țării lucrării, fără conversie automată.');
 if(!['apartament','casa','birou','altul'].includes(d.space as string)||!['intretinere','generala','dupa_renovare'].includes(d.service as string))fail('Tipul spațiului sau serviciul este invalid.');
 const fee=integer(d.platformAndProcessingBps,0,9999),margin=integer(d.operatingMarginBps,0,9999);
 if(fee+margin>=10000)fail('Comisioanele și marja trebuie să însumeze mai puțin de 100%.');
 const evidence=obj(d.evidence),checks={} as InternationalCostInput['evidence'];
 for(const key of Object.keys(COST_EVIDENCE) as (keyof typeof COST_EVIDENCE)[]){if(typeof evidence[key]!=='boolean')fail('Confirmările surselor sunt incomplete.');checks[key]=evidence[key] as boolean;}
 if(d.basis==='illustrative'&&Object.values(checks).some(Boolean))fail('Un exemplu ilustrativ nu poate declara date comerciale confirmate.');
 const validUntil=d.validUntil===null?null:text(d.validUntil,10);
 if(validUntil&&(!/^\d{4}-\d{2}-\d{2}$/.test(validUntil)||Number.isNaN(Date.parse(validUntil+'T00:00:00Z'))||new Date(validUntil+'T00:00:00Z').toISOString().slice(0,10)!==validUntil))fail('Data de valabilitate este invalidă.');
 if(!Array.isArray(d.sourceUrls)||d.sourceUrls.length>8)fail('Sunt permise cel mult 8 surse HTTPS.');
 const sourceUrls=(d.sourceUrls as unknown[]).map(v=>{const s=text(v,500);try{const u=new URL(s);if(u.protocol!=='https:'||u.username||u.password)fail('Sursele trebuie să fie URL-uri HTTPS fără credențiale.');}catch{fail('Sursă HTTPS invalidă.');}return s;});
 return {basis:d.basis as InternationalCostInput['basis'],countryCode,currency,city:text(d.city,100),supplier:text(d.supplier,160),space:d.space as InternationalCostInput['space'],service:d.service as InternationalCostInput['service'],
  annualEmployerCostMinor:money(d.annualEmployerCostMinor,1),annualBillableMinutes:integer(d.annualBillableMinutes,60,525600),
  materialsHourlyMinor:money(d.materialsHourlyMinor),equipmentHourlyMinor:money(d.equipmentHourlyMinor),overheadHourlyMinor:money(d.overheadHourlyMinor),
  travelPerVisitMinor:money(d.travelPerVisitMinor),otherPerVisitMinor:money(d.otherPerVisitMinor),workers:integer(d.workers,1,100),onsiteMinutes:integer(d.onsiteMinutes,1,1440),supplierMinimumMinutes:integer(d.supplierMinimumMinutes,0,1440),
  supplierMinimumNetMinor:d.supplierMinimumNetMinor===null?null:money(d.supplierMinimumNetMinor),platformAndProcessingBps:fee,operatingMarginBps:margin,
  vatBps:d.vatBps===null?null:integer(d.vatBps,0,10000),roundingMinor:integer(d.roundingMinor,1,100000),validUntil,sourceNote:text(d.sourceNote,2000,true),sourceUrls,evidence:checks};
}
const B=(n:number)=>BigInt(n),ONE=BigInt(1),TENK=BigInt(10000),SIXTY=BigInt(60);
const ceil=(n:bigint,d:bigint)=>(n+d-ONE)/d;
const safe=(n:bigint):number=>n<=B(Number.MAX_SAFE_INTEGER)?Number(n):fail('Suma depășește limita de calcul.');
export function calculateInternationalCost(value:unknown,today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Bucharest'})){
 const d=validateInternationalCostInput(value),onsiteMinutes=Math.max(180,d.onsiteMinutes,d.supplierMinimumMinutes),personMinutes=onsiteMinutes*d.workers;
 // All monetary inputs are minor units. Round costs upward before dividing by the retained revenue share.
 const payroll=ceil(B(d.annualEmployerCostMinor)*B(personMinutes),B(d.annualBillableMinutes));
 const hourly=ceil((B(d.materialsHourlyMinor)+B(d.equipmentHourlyMinor)+B(d.overheadHourlyMinor))*B(personMinutes),SIXTY);
 const total=payroll+hourly+B(d.travelPerVisitMinor)+B(d.otherPerVisitMinor);
 const floor=ceil(total*TENK,TENK-B(d.platformAndProcessingBps+d.operatingMarginBps));
 const unitFloor=ceil(floor*SIXTY,B(personMinutes)),unit=ceil(unitFloor,B(d.roundingMinor))*B(d.roundingMinor);
 const net=ceil(unit*B(personMinutes),SIXTY);
 const blockers:string[]=(Object.keys(COST_EVIDENCE) as (keyof typeof COST_EVIDENCE)[]).filter(k=>!d.evidence[k]).map(k=>COST_EVIDENCE[k]);
 if(!d.validUntil)blockers.push('Valabilitatea ofertei' as typeof blockers[number]);else if(d.validUntil<today)blockers.push('Oferta este expirată' as typeof blockers[number]);
 if(d.vatBps===null)blockers.push('Cota TVA este neconfirmată' as typeof blockers[number]);
 if(d.supplierMinimumNetMinor===null)blockers.push('Minimum valoric neconfirmat' as typeof blockers[number]);
 if(!d.sourceNote.trim()||!d.sourceUrls.length)blockers.push('Surse și documente justificative' as typeof blockers[number]);
 const withMinimum=net>B(d.supplierMinimumNetMinor??0)?net:B(d.supplierMinimumNetMinor??0);
 const finalVat=d.vatBps===null?null:(withMinimum*B(d.vatBps)+B(5000))/TENK;
 return {modelVersion:INTERNATIONAL_COST_MODEL_VERSION,countryCode:d.countryCode,currency:d.currency,status:'draft' as const,executable:false as const,
  onsiteMinutes,personMinutes,payrollCostMinor:safe(payroll),hourlyCostsMinor:safe(hourly),fixedCostsMinor:d.travelPerVisitMinor+d.otherPerVisitMinor,totalCostMinor:safe(total),
  netFloorMinor:safe(floor),netWorkerHourMinor:safe(unit),netBeforeSupplierMinimumMinor:safe(net),netTotalMinor:safe(withMinimum),
  vatMinor:finalVat===null?null:safe(finalVat),grossTotalMinor:finalVat===null?null:safe(withMinimum+finalVat),
  operatingMarginBps:safe((withMinimum*(TENK-B(d.platformAndProcessingBps))-total*TENK)/withMinimum),
  blockers:[...blockers,'Publicarea internațională nu este disponibilă în acest registru.'],
  // A raised minimum is a visit-level amount, not a changed worker-hour tariff.
  supplierMinimumApplied:withMinimum>net};
}
export function internationalCostExample():InternationalCostInput{
 return {basis:'illustrative',countryCode:'AT',city:'Exemplu de oraș',supplier:'SIMULARE — fără ofertă de furnizor',space:'apartament',service:'intretinere',currency:'EUR',
  annualEmployerCostMinor:2850000,annualBillableMinutes:60000,materialsHourlyMinor:114,equipmentHourlyMinor:43,overheadHourlyMinor:834,
  travelPerVisitMinor:257,otherPerVisitMinor:0,workers:1,onsiteMinutes:180,supplierMinimumMinutes:180,supplierMinimumNetMinor:null,
  platformAndProcessingBps:1000,operatingMarginBps:1500,vatBps:2000,roundingMinor:100,validUntil:null,
  sourceNote:'Scenariu ilustrativ adaptat după WKO, nu costuri reale ale unui partener. Costul anual și orele facturabile sunt ipoteze. Comisionul și TVA sunt ipoteze, fără schimbarea configurației LIVE.',
  sourceUrls:['https://www.wko.at/oe/kollektivvertrag/lohnnebenkosten-gebauedereiniger-2026.pdf'],
  evidence:{payroll:false,billableHours:false,operatingCosts:false,supplierOffer:false,coverage:false,tax:false,settlement:false}};
}
// Keep the country catalogue tied to the app's existing allowlist without adding new markets.
if(INTERNATIONAL_MARKETS.length!==EU_COUNTRIES.length-1)throw Error('International planning market catalogue mismatch');
