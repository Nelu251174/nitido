/** Billing country comes from the work's address, never UI language or IP. */
export const EU_COUNTRIES = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'] as const;
export type ServiceCountry = typeof EU_COUNTRIES[number];
export type ServiceCurrency = 'RON' | 'EUR';

export class ServiceMarketError extends Error {
  constructor(message:string,public readonly status:number,public readonly countryCode?:ServiceCountry,public readonly currency?:ServiceCurrency){super(message);}
}
export function serviceCountry(value:unknown):ServiceCountry {
  if(typeof value!=='string')throw new ServiceMarketError('Țara lucrării este invalidă.',400);
  const code=value.trim().toUpperCase();
  if(!EU_COUNTRIES.includes(code as ServiceCountry))throw new ServiceMarketError('Țara lucrării este invalidă.',400);
  return code as ServiceCountry;
}
export function serviceCurrency(countryCode:ServiceCountry):ServiceCurrency {
  // Validate at runtime too: request JSON must not bypass the EU allowlist.
  return serviceCountry(countryCode)==='RO'?'RON':'EUR';
}
/** Only the existing Romanian tariff/coverage is configured today.
 * A foreign work must never inherit a Romanian price with the EUR label.
 * Missing country is the historical Romanian booking contract, not geolocation.
 */
export function configuredServiceMarket(body:{countryCode?:unknown;currency?:unknown}={}):{countryCode:'RO';currency:'RON'} {
  const countryCode=body.countryCode===undefined? 'RO':serviceCountry(body.countryCode);
  const currency=serviceCurrency(countryCode);
  if(body.currency!==undefined&&body.currency!==currency)throw new ServiceMarketError('Moneda nu corespunde țării lucrării.',400,countryCode,currency);
  if(countryCode!=='RO')throw new ServiceMarketError('Rezervările în această țară vor fi disponibile după configurarea tarifelor și a firmelor locale.',422,countryCode,currency);
  return {countryCode:'RO',currency:'RON'};
}
