import type {Database} from 'better-sqlite3';
import {currencyOfJob} from './jobCurrency';
import {providerMarketError} from './publishedPrice';

/** Legacy RON routing is unchanged; EUR invitations require the same actual crew as acceptance. */
export function providerNotificationMarketError(db:Database,job:Parameters<typeof providerMarketError>[0],firm:Parameters<typeof providerMarketError>[1]):string|null{
 const currency=currencyOfJob(job);
 if(currency==='RON')return null;
 if(currency!=='EUR')return 'SUPPRESSED_INVALID_MARKET';
 return providerMarketError(job,firm,true,db)?'SUPPRESSED_FIRM_MARKET_OR_CREW':null;
}
