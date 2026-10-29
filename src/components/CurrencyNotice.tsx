import {useLocale,useMessages} from 'next-intl';
import {currencyFromMessages,euroEnabled} from '@/lib/displayCurrency';
import {CURRENCY_NOTICES} from '@/lib/currencyNotice';
export function CurrencyNotice(){
 const locale=useLocale(),context=currencyFromMessages(useMessages());
 if(context.currency!=='EUR')return null;
 const copy=CURRENCY_NOTICES[locale]??CURRENCY_NOTICES.en;
 return <p data-currency-notice className="px-4 py-2 text-center text-xs text-muted" style={{margin:0}}>{euroEnabled(context)?copy.ready.replace('{date}',context.rateDate??''):copy.unavailable}</p>;
}
