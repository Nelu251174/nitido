import {cache} from 'react';
export const EURO_RATE_URL='https://curs.bnr.ro/nbrfxrates.xml';
export type EuroReferenceRate={eurRon:number;date:string};
export function parseEuroReferenceRate(xml:string,now=Date.now()):EuroReferenceRate {
 if(xml.length>100000||/<!DOCTYPE|<!ENTITY/i.test(xml)||!/<OrigCurrency>\s*RON\s*<\/OrigCurrency>/.test(xml))throw Error('INVALID_FX_FEED');
 const cube=/<Cube\s+date=["'](\d{4}-\d{2}-\d{2})["'][^>]*>([\s\S]*?)<\/Cube>/.exec(xml);
 const rate=cube&&/<Rate\s+currency=["']EUR["']\s*>\s*(\d+(?:\.\d+)?)\s*<\/Rate>/.exec(cube[2]);
 const date=cube?.[1],ms=date?Date.parse(date+'T00:00:00Z'):NaN,eurRon=Number(rate?.[1]);
 if(!date||!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==date||ms>now+86400000||now-ms>31*86400000||!Number.isFinite(eurRon)||eurRon<1||eurRon>20)throw Error('INVALID_FX_RATE');
 return {eurRon,date};
}
/** Public central-bank reference only: no visitor IP, cookies or user data leave the server. */
export const getEuroReferenceRate=cache(async():Promise<EuroReferenceRate|null>=>{
 try {
  const response=await fetch(EURO_RATE_URL,{next:{revalidate:21600},signal:AbortSignal.timeout(3500),redirect:'error',headers:{Accept:'application/xml,text/xml'}});
  if(!response.ok)return null;
  return parseEuroReferenceRate(await response.text());
 }catch{return null;}
});
