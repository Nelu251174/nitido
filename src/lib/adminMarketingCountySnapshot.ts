import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { MarketingError } from './adminMarketing';
import { marketingRegion } from './adminMarketingRegions';
export interface CountyPart {file:string;count:number;bytes:number;sha256:string}
export interface CountyManifest {schemaVersion:2;scope:'county';countyCode:string;generation:string;createdAt:string;datasetLastModified:string;source:string;boundaryName:string;boundaryRelation:number;total:number;parts:CountyPart[];sha256:string}
export interface CountySourceItem {type:'node'|'way'|'relation';id:number;tags:Record<string,string>}
const rootDefault=()=>join(process.cwd(),'data','marketing-sources','counties');
async function boundedFile(file:string,max:number){
 const handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const stat=await handle.stat();if(!stat.isFile()||stat.size<1||stat.size>max)throw Error('SOURCE_FILE_INVALID');const raw=await handle.readFile('utf8');if(Buffer.byteLength(raw)>max)throw Error('SOURCE_FILE_TOO_LARGE');return raw;}finally{await handle.close();}
}
export async function readCountyManifest(code:string,root=rootDefault()):Promise<CountyManifest|null>{
 const region=marketingRegion(code);if(!region)throw new MarketingError('Județ invalid.');
 try{
  let raw;try{raw=await boundedFile(join(root,region.code,'current.json'),2000000);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
  const m=JSON.parse(raw) as CountyManifest;
  const fresh=(value:string)=>Number.isFinite(Date.parse(value))&&Date.parse(value)>=Date.now()-14*86400000&&Date.parse(value)<=Date.now()+3600000;
  if(m.schemaVersion!==2||m.scope!=='county'||m.countyCode!==region.code||m.source!=='https://download.geofabrik.de/europe/romania-latest.osm.pbf'||!fresh(m.createdAt)||!fresh(m.datasetLastModified)||!/^[-a-f0-9]{36}$/.test(m.generation)||!Number.isSafeInteger(m.boundaryRelation)||m.boundaryRelation<1||!Number.isSafeInteger(m.total)||m.total<1||!Array.isArray(m.parts)||!m.parts.length)throw Error('SOURCE_MANIFEST_INVALID');
  let count=0;
  for(let i=0;i<m.parts.length;i++){const p=m.parts[i];if(p.file!=='part-'+String(i+1).padStart(6,'0')+'.json'||!Number.isInteger(p.count)||p.count<1||p.count>500||!Number.isInteger(p.bytes)||p.bytes<1||p.bytes>1000000||!/^([a-f0-9]{64})$/.test(p.sha256))throw Error('SOURCE_PART_INVALID');count+=p.count;}
  const {sha256,...payload}=m;
  if(count!==m.total||createHash('sha256').update(JSON.stringify(payload)).digest('hex')!==sha256)throw Error('SOURCE_MANIFEST_HASH');
  return m;
 }catch{throw new MarketingError('Inventarul județului este incomplet, expirat sau invalid. Nu a fost importat.',502);}
}
export async function readCountyPart(manifest:CountyManifest,index:number,root=rootDefault()):Promise<CountySourceItem[]>{
 const region=marketingRegion(manifest.countyCode),part=manifest.parts[index];if(!region||!part||!/^[-a-f0-9]{36}$/.test(manifest.generation)||!/^part-\d{6}.json$/.test(part.file))throw new MarketingError('Lot de inventar invalid.');
 try{
  const raw=await boundedFile(join(root,region.code,manifest.generation,part.file),1000000);
  if(Buffer.byteLength(raw)!==part.bytes||createHash('sha256').update(raw).digest('hex')!==part.sha256)throw Error('SOURCE_PART_HASH');
  const elements=JSON.parse(raw).elements as CountySourceItem[];
  if(!Array.isArray(elements)||elements.length!==part.count||elements.some(e=>!e||!['node','way','relation'].includes(e.type)||!Number.isSafeInteger(e.id)||e.id<1||!e.tags||typeof e.tags.name!=='string'||!e.tags.name.trim()))throw Error('SOURCE_PART_ROWS');
  return elements;
 }catch{throw new MarketingError('Un lot al inventarului județului este invalid. Importul este în pauză.',502);}
}
