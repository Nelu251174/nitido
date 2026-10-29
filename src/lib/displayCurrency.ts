export type DisplayCurrency={country:string|null;currency:'RON'|'EUR';eurRon:number|null;rateDate:string|null};
export const DOMESTIC_DISPLAY:DisplayCurrency={country:null,currency:'RON',eurRon:null,rateDate:null};
export function currencyForCountry(country:string|null):'RON'|'EUR'{return country&&country!=='RO'?'EUR':'RON';}
export function euroEnabled(value:DisplayCurrency){return value.currency==='EUR'&&Number.isFinite(value.eurRon)&&value.eurRon!>0;}
export function displayMoney(ron:number|null|undefined,context:DisplayCurrency,locale='ro',digits=2):string {
 if(ron==null||!Number.isFinite(ron))return '—';
 const euro=euroEnabled(context),value=euro?ron/context.eurRon!:ron;
 const formatted=new Intl.NumberFormat(locale,{style:'currency',currency:euro?'EUR':'RON',currencyDisplay:euro?'narrowSymbol':'symbol',minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
 return formatted;
}
/** Only source-owned UI prose, never persisted content, numeric inputs, exports or payment payloads. */
export function displayMoneyText(text:string,context:DisplayCurrency,locale='ro'):string {
 if(!euroEnabled(context))return text;
 const ranges=text.replace(/(\d+(?:[.,]\d+)*)\s*[–-]\s*(\d+(?:[.,]\d+)*)\s*(lei|RON)\b/g,(_,a:string,b:string,unit:string)=>`${displayMoneyText(a+' '+unit,context,locale)}–${displayMoneyText(b+' '+unit,context,locale)}`);
 return ranges.replace(/(-?\d+(?:[.,]\d+)*(?:[ \u00a0\u202f]\d{3})*)\s*(?:lei|RON|леи|лея|leja)(?=$|[^\p{L}])/giu,(_,raw:string)=>{
  let n=raw.replace(/[ \u00a0\u202f]/g,'');
  // Romanian source values use comma for decimals and dot for thousands.
  if(n.includes(','))n=n.replaceAll('.','').replace(',','.');
  else if(/^[-]?\d{1,3}(?:\.\d{3})+$/.test(n))n=n.replaceAll('.','');
  return displayMoney(Number(n),context,locale);
 });
}
export function currencyFromMessages(messages:Record<string,unknown>):DisplayCurrency {
 const m=messages.displayCurrency as Record<string,unknown>|undefined;
 const rate=Number(m?.eurRon);
 return {country:typeof m?.country==='string'&&m.country?m.country:null,currency:m?.currency==='EUR'?'EUR':'RON',eurRon:Number.isFinite(rate)&&rate>0?rate:null,rateDate:typeof m?.rateDate==='string'&&m.rateDate?m.rateDate:null};
}
