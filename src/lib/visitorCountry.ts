import {lookup} from 'geoip-country';
import ipaddr from 'ipaddr.js';
/** The ingress must overwrite X-Forwarded-For. Never accept a country from a caller. */
export function visitorCountry(headers:Pick<Headers,'get'>):string|null {
 const raw=headers.get('x-forwarded-for')?.split(',')[0]?.trim();
 if(!raw||raw.length>64)return null;
 try {
  const address=ipaddr.process(raw);
  if(address.range()!=='unicast')return null;
  const code=lookup(address.toString())?.country;
  return code&&/^[A-Z]{2}$/.test(code)&&code!=='ZZ'?code:null;
 }catch{return null;}
}
