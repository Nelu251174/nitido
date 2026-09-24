/** Operational contribution, not accounting profit. No assumed fiscal rate or margin threshold. */
export const COST_CODES=['materials','travel','processor','other','fiscal'] as const;
export type CostCode=typeof COST_CODES[number];
export type Evidence={amountBani:number|null;state:'unknown'|'estimated'|'confirmed';source:string;recordedAt:string|null};
export type DirectCost=Evidence & {bearer:'platform'|'provider';includedInProvider:boolean};
export type ManualEstimate={currency:'RON';lines:{label:string;amountBani:number}[];platformDiscountBani:number;provider:Evidence;costs:Record<CostCode,DirectCost>;reason:string};
export class MarginError extends Error{constructor(message:string,public status=400){super(message);}}
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new MarginError('Date invalide.');return v as Record<string,unknown>;};
const text=(v:unknown,max:number)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw new MarginError(`Completează textul, maximum ${max} caractere.`);return v.trim();};
const bani=(v:unknown)=>{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0||v>100_000_000)throw new MarginError('Suma trebuie să fie un număr întreg de bani, în limitele admise.');return v;};
function evidence(value:unknown):Evidence {
 const e=object(value);
 if(e.state==='unknown'){
  if(e.amountBani!==null)throw new MarginError('Un cost necunoscut nu poate avea sumă.');
  return {amountBani:null,state:'unknown',source:typeof e.source==='string'?e.source.trim().slice(0,1000):'',recordedAt:null};
 }
 if(e.state!=='estimated'&&e.state!=='confirmed')throw new MarginError('Stare a costului invalidă.');
 if(typeof e.recordedAt!=='string'||!Number.isFinite(Date.parse(e.recordedAt)))throw new MarginError('Data sursei este obligatorie.');
 return {amountBani:bani(e.amountBani),state:e.state,source:text(e.source,1000),recordedAt:new Date(e.recordedAt).toISOString()};
}
export function emptyManualEstimate():ManualEstimate {
 const unknown=():Evidence=>({amountBani:null,state:'unknown',source:'',recordedAt:null});
 return {currency:'RON',lines:[{label:'Serviciu de curățenie',amountBani:0}],platformDiscountBani:0,provider:unknown(),costs:Object.fromEntries(COST_CODES.map(code=>[code,{...unknown(),bearer:'platform',includedInProvider:false}])) as Record<CostCode,DirectCost>,reason:''};
}
export function validateManualEstimate(value:unknown):ManualEstimate {
 const d=object(value);if(d.currency!=='RON')throw new MarginError('Moneda acceptată este RON.');
 if(!Array.isArray(d.lines)||!d.lines.length||d.lines.length>20)throw new MarginError('Oferta trebuie să aibă între 1 și 20 de componente.');
 const lines=d.lines.map(v=>{const l=object(v);return {label:text(l.label,160),amountBani:bani(l.amountBani)};});
 const gross=lines.reduce((n,l)=>n+l.amountBani,0);if(gross<=0||gross>100_000_000)throw new MarginError('Totalul serviciului trebuie să fie pozitiv și în limitele admise.');
 const discount=bani(d.platformDiscountBani);if(discount>gross)throw new MarginError('Reducerea nu poate depăși valoarea serviciului.');
 const rawCosts=object(d.costs),costs={} as Record<CostCode,DirectCost>;
 for(const code of COST_CODES){const c=object(rawCosts[code]);if(!['platform','provider'].includes(String(c.bearer))||typeof c.includedInProvider!=='boolean')throw new MarginError('Precizează suportatorul costului și dacă este inclus în remunerație.');if(c.includedInProvider&&c.bearer!=='provider')throw new MarginError('Un cost inclus în remunerația prestatorului nu poate fi suportat separat de platformă.');if(code==='fiscal'&&(c.bearer!=='platform'||c.includedInProvider))throw new MarginError('Ajustarea fiscală trebuie documentată separat pentru platformă.');costs[code]={...evidence(c),bearer:c.bearer as DirectCost['bearer'],includedInProvider:c.includedInProvider};}
 return {currency:'RON',lines,platformDiscountBani:discount,provider:evidence(d.provider),costs,reason:text(d.reason,2000)};
}
export function calculateOperationalMargin(estimate:ManualEstimate){
 const grossBani=estimate.lines.reduce((n,l)=>n+l.amountBani,0),clientDueBani=grossBani-estimate.platformDiscountBani;
 const missing:string[]=[],estimated:string[]=[];
 if(estimate.provider.amountBani===null)missing.push('provider');else if(estimate.provider.state==='estimated')estimated.push('provider');
 let platformCostsBani=0;
 for(const code of COST_CODES){const c=estimate.costs[code];if(c.amountBani===null)missing.push(code);else {if(c.state==='estimated')estimated.push(code);if(c.bearer==='platform'&&!c.includedInProvider)platformCostsBani+=c.amountBani;}}
 // Discount is already reflected in clientDueBani. Never subtract it a second time.
 const marginBani=missing.length?null:clientDueBani-estimate.provider.amountBani!-platformCostsBani;
 return {currency:'RON' as const,grossBani,platformDiscountBani:estimate.platformDiscountBani,clientDueBani,providerBani:estimate.provider.amountBani,knownPlatformCostsBani:platformCostsBani,marginBani,marginBasisPoints:marginBani===null||clientDueBani===0?null:Math.round(marginBani*10000/clientDueBani),status:missing.length?'incomplete' as const:estimated.length?'estimated' as const:'confirmed' as const,missing,estimated,thresholdStatus:'not_configured' as const};
}
