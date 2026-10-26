import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { MarketingError, marketingKey } from './adminMarketing';
import type { PublicPage } from './adminMarketingPublicWeb';

const SOURCE='https://download.geofabrik.de/europe/romania-latest.osm.pbf';
/** Owner-prepared OSM extract. Only Constanța, fixed path, bounded and integrity-checked. */
export async function readMarketingCitySnapshot(city:string,root=join(process.cwd(),'data','marketing-sources')):Promise<PublicPage|null>{
 if(marketingKey(city)!=='constanta')return null;
 let handle;
 try{handle=await open(join(root,'constanta-osm.json'),constants.O_RDONLY|constants.O_NOFOLLOW);}
 catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw new MarketingError('Inventarul OSM local nu poate fi deschis. Verifică sursa înainte de reluare.',502);}
 try{
  const stat=await handle.stat();
  if(!stat.isFile()||stat.size<1||stat.size>2000000)throw Error('SIZE');
  const raw=await handle.readFile('utf8');
  if(Buffer.byteLength(raw)>2000000)throw Error('SIZE');
  const snapshot=JSON.parse(raw);
  const validDate=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=Date.now()+3600000&&Date.parse(value)>=Date.now()-14*86400000;
  if(snapshot.schemaVersion!==1||snapshot.city!=='Constanța'||snapshot.source!==SOURCE||!validDate(snapshot.createdAt)||!validDate(snapshot.datasetLastModified)||!Number.isSafeInteger(snapshot.boundaryRelation)||snapshot.boundaryRelation<1)throw Error('METADATA');
  const elements=snapshot.payload?.elements;
  if(!Array.isArray(elements)||elements.length<2||elements.length>20001||elements.filter((item:{type?:string})=>item?.type==='area').length!==1||!elements.some((item:{type?:string;id?:number})=>item?.type==='area'&&item.id===3600000000+snapshot.boundaryRelation))throw Error('BOUNDARY');
  const text=JSON.stringify(snapshot.payload);
  if(!/^[a-f0-9]{64}$/.test(snapshot.sha256)||createHash('sha256').update(text).digest('hex')!==snapshot.sha256)throw Error('HASH');
  return {status:200,headers:{'content-type':'application/json'},text,url:SOURCE};
 }catch{throw new MarketingError('Inventarul OSM local este incomplet, expirat sau invalid. Nu a fost importat; verifică sursa înainte de reluare.',502);}
 finally{await handle.close();}
}
