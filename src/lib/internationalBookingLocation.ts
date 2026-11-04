import markets from '@/data/internationalMarketScope.json';
import locationAliases from '@/data/internationalLocationAliases.json';

export type InternationalLocation={countryCode:string;city:string;street:string;postalCode:string};
type Component={long_name?:string;short_name?:string;types?:string[]};
type Result={address_components?:Component[];geometry?:{location_type?:string}};
const normalize=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[’']/g,'').replace(/[-\s]+/g,' ').trim();
// Exact, country-scoped exonyms only. A suburb/district is never promoted to a city.
const aliases:Record<string,Record<string,string[]>>=locationAliases;
export function internationalLocationCity(countryCode:unknown,locality:unknown):{countryCode:string;city:string}{
 if(typeof countryCode!=='string'||typeof locality!=='string'||locality.length>120)throw Error('Adresa nu a putut fi identificată. Completează manual.');
 const country=markets.find(m=>m.countryCode===countryCode.trim().toUpperCase());
 if(!country)throw Error('Țara lucrării este invalidă.');
 const key=normalize(locality);
 const city=country.cities.find(c=>[c,...(aliases[country.countryCode]?.[c]??[])].some(v=>normalize(v)===key));
 if(!city)throw Error('Orașul nu are o piață configurată.');
 return {countryCode:country.countryCode,city};
}

export function internationalAddressFromGoogle(data:unknown):InternationalLocation{
 const payload=data as {status?:string;results?:Result[]}|null;
 if(payload?.status!=='OK'||!Array.isArray(payload.results))throw Error('Adresa nu a putut fi identificată. Completează manual.');
 let locationError:Error|undefined;
 for(const r of payload.results){
  if(!Array.isArray(r?.address_components))continue;
  const part=(type:string,short=false)=>{const c=r.address_components!.find(c=>c.types?.includes(type));const value=short?c?.short_name:c?.long_name;return typeof value==='string'?value.trim():'';};
  const locality=part('locality')||part('postal_town'),road=part('route');
  if(!locality||!road)continue;
  let place:{countryCode:string;city:string};
  try{place=internationalLocationCity(part('country',true),locality);}catch(e){locationError=e as Error;continue;}
  const postal=part('postal_code');
  return {...place,street:[road,r.geometry?.location_type==='ROOFTOP'?part('street_number'):''].filter(Boolean).join(' ').slice(0,250),
   postalCode:/^[\p{L}\p{N}][\p{L}\p{N} -]{0,19}$/u.test(postal)?postal:''};
 }
 throw locationError??Error('Adresa nu a putut fi identificată. Completează manual.');
}

export function internationalLocalityFromResponse(value:unknown):InternationalLocation{
 if(!value||typeof value!=='object')throw Error('Adresa nu a putut fi identificată. Completează manual.');
 const data=value as Record<string,unknown>;
 const locality=typeof data.city==='string'&&data.city.trim()?data.city:data.locality;
 return {...internationalLocationCity(data.countryCode,locality),street:'',postalCode:''};
}
