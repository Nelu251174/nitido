import {useLocale,useMessages} from 'next-intl';
import {currencyFromMessages,displayMoney,displayMoneyText,euroEnabled} from '@/lib/displayCurrency';
import type {JobCurrency} from '@/lib/jobCurrency';
export function useDisplayMoney(){
 const locale=useLocale(),context=currencyFromMessages(useMessages());
 return {context,money:(ron:number|null|undefined,digits=2)=>displayMoney(ron,context,locale,digits),text:(source:string)=>displayMoneyText(source,context,locale)};
}
export function UiMoney({ron,currency='RON'}:{ron:number|null|undefined;currency?:JobCurrency|null}){
 const locale=useLocale();
 const {context,money}=useDisplayMoney();
 if(ron==null||!Number.isFinite(ron)||currency===null)return '—';
 if(currency==='EUR')return new Intl.NumberFormat(locale,{style:'currency',currency:'EUR',currencyDisplay:'narrowSymbol',minimumFractionDigits:2,maximumFractionDigits:2}).format(ron);
 return euroEnabled(context)?money(ron):`${ron} lei`;
}

export function ChargeAmount({ron,currency='RON'}:{ron:number;currency?:JobCurrency|null}){
 const {context}=useDisplayMoney();
 if(context.currency!=='EUR'||currency!=='RON')return null;
 const label='RON · ';
 return <small style={{display:'block'}}>{label}{new Intl.NumberFormat('ro-RO',{style:'currency',currency:'RON'}).format(ron)}</small>;
}
