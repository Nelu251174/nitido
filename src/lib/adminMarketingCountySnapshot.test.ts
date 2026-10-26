import {describe,it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {readCountyManifest,readCountyPart,type CountyManifest} from './adminMarketingCountySnapshot';
const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
describe('county inventory integrity and scale',()=>{
 it('accepts a verified manifest for 100001 businesses with no county record ceiling',async()=>{
  const root=await mkdtemp(join(tmpdir(),'county-source-'));try{await mkdir(join(root,'CT'));const parts=Array.from({length:201},(_,i)=>({file:'part-'+String(i+1).padStart(6,'0')+'.json',count:i===200?1:500,bytes:100,sha256:'a'.repeat(64)}));const payload={schemaVersion:2,scope:'county',countyCode:'CT',generation:randomUUID(),createdAt:new Date().toISOString(),datasetLastModified:new Date().toISOString(),source:'https://download.geofabrik.de/europe/romania-latest.osm.pbf',boundaryName:'Constanța',boundaryRelation:2367022,total:100001,parts};await writeFile(join(root,'CT','current.json'),JSON.stringify({...payload,sha256:sha(JSON.stringify(payload))}));expect((await readCountyManifest('CT',root))?.total).toBe(100001);expect(await readCountyManifest('B',root)).toBeNull();}finally{await rm(root,{recursive:true,force:true});}
 });
 it('fails closed on modified, missing, or symlinked parts instead of truncating the county',async()=>{
  const root=await mkdtemp(join(tmpdir(),'county-source-'));const generation=randomUUID(),dir=join(root,'CT',generation);try{await mkdir(dir,{recursive:true});const raw=JSON.stringify({elements:[{type:'node',id:1,tags:{name:'Public firm'}}]});const part={file:'part-000001.json',count:1,bytes:Buffer.byteLength(raw),sha256:sha(raw)};const manifest={countyCode:'CT',generation,parts:[part]} as CountyManifest;await writeFile(join(dir,part.file),raw);expect(await readCountyPart(manifest,0,root)).toHaveLength(1);await writeFile(join(dir,part.file),raw+' ');await expect(readCountyPart(manifest,0,root)).rejects.toThrow();await rm(join(dir,part.file));await expect(readCountyPart(manifest,0,root)).rejects.toThrow();await writeFile(join(root,'outside.json'),raw);await symlink(join(root,'outside.json'),join(dir,part.file));await expect(readCountyPart(manifest,0,root)).rejects.toThrow();}finally{await rm(root,{recursive:true,force:true});}
 });
});
