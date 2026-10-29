import {cookies, headers} from 'next/headers';
import {getRequestConfig} from 'next-intl/server';
import {LOCALE_COOKIE, selectLocale} from './locales';
import {getCatalog, catalogsReady} from './catalogs';
import {currencyForCountry} from '@/lib/displayCurrency';
import {getEuroReferenceRate} from '@/lib/euroReferenceRate';

export default getRequestConfig(async () => {
  const [jar, requestHeaders] = await Promise.all([cookies(), headers()]);
  const locale = catalogsReady() ? selectLocale(jar.get(LOCALE_COOKIE)?.value,
    requestHeaders.get('accept-language'), requestHeaders.get('x-nitido-country')) : 'ro';
  const country=requestHeaders.get('x-nitido-country'),currency=requestHeaders.get('x-nitido-original-currency')==='true'?'RON':currencyForCountry(country);
  const rate=currency==='EUR'?await getEuroReferenceRate():null;
  return {locale, messages: {ui: await getCatalog(locale),displayCurrency:{country:country??'',currency,eurRon:rate?String(rate.eurRon):'',rateDate:rate?.date??''}}, timeZone: 'Europe/Bucharest'};
});
