import {useLocale,useMessages} from 'next-intl';
import {currencyFromMessages,displayMoney,displayMoneyText,euroEnabled} from '@/lib/displayCurrency';
export function useDisplayMoney(){
 const locale=useLocale(),context=currencyFromMessages(useMessages());
 return {context,money:(ron:number|null|undefined,digits=2)=>displayMoney(ron,context,locale,digits),text:(source:string)=>displayMoneyText(source,context,locale)};
}
export function UiMoney({ron}:{ron:number|null|undefined}){
 const {context,money}=useDisplayMoney();
 if(ron==null||!Number.isFinite(ron))return '—';
 return euroEnabled(context)?money(ron):`${ron} lei`;
}

export function ChargeAmount({ron}:{ron:number}){
 const {context}=useDisplayMoney();
 if(context.currency!=='EUR')return null;
 const label='RON · ';
 return <small style={{display:'block'}}>{label}{new Intl.NumberFormat('ro-RO',{style:'currency',currency:'RON'}).format(ron)}</small>;
}
