import type {JobCurrency} from './jobCurrency';

/** Read-only DTO: native EUR is serialized from minor units, never rounded as lei. */
export function financialReadMoney<T extends Record<string,unknown>>(row:T) {
 const currency:JobCurrency|null=row.currency===undefined||row.currency==='RON'?'RON':row.currency==='EUR'?'EUR':null;
 const amount=(legacy:string,minor:string)=>currency==='RON'?row[legacy]:currency==='EUR'&&typeof row[minor]==='number'&&Number.isSafeInteger(row[minor])&&Number(row[minor])>=0?Number(row[minor])/100:null;
 const feeCurrency=row.stripe_fee_currency==='RON'||row.stripe_fee_currency==='EUR'?row.stripe_fee_currency:null;
 return {...row,currency,amount_gross:amount('amount_gross','amount_gross_minor'),commission_amount:amount('commission_amount','commission_amount_minor'),amount_net:amount('amount_net','amount_net_minor'),stripe_fee_currency:feeCurrency};
}
