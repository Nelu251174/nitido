import {cookies, headers} from 'next/headers';
import {getRequestConfig} from 'next-intl/server';
import {LOCALE_COOKIE, selectLocale} from './locales';
import {getCatalog, catalogsReady} from './catalogs';

export default getRequestConfig(async () => {
  const [jar, requestHeaders] = await Promise.all([cookies(), headers()]);
  const locale = catalogsReady() ? selectLocale(jar.get(LOCALE_COOKIE)?.value,
    requestHeaders.get('accept-language'), requestHeaders.get('x-nitido-country')) : 'ro';
  return {locale, messages: {ui: await getCatalog(locale)}, timeZone: 'Europe/Bucharest'};
});
