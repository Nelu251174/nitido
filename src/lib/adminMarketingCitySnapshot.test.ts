import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import { mkdtemp,rm,writeFile,symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readMarketingCitySnapshot } from './adminMarketingCitySnapshot';
let root:string;
function envelope(){
 const payload={elements:[{type:'area',id:3600000100},{type:'node',id:20,tags:{name:'Synthetic business',shop:'yes',email:'office@fixture.example'}}]};
 return {schemaVersion:1,city:'Constanța',createdAt:new Date().toISOString(),datasetLastModified:new Date().toISOString(),source:'https://download.geofabrik.de/europe/romania-latest.osm.pbf',boundaryRelation:100,payload,sha256:createHash('sha256').update(JSON.stringify(payload)).digest('hex')};
}
beforeEach(async()=>{root=await mkdtemp(join(tmpdir(),'mkt-snapshot-test-'));});
afterEach(async()=>{await rm(root,{recursive:true,force:true});});
describe('owner-prepared municipal OSM inventory',()=>{
 it('uses a complete verified snapshot and leaves other cities on their own source',async()=>{
  await writeFile(join(root,'constanta-osm.json'),JSON.stringify(envelope()));
  expect(await readMarketingCitySnapshot('Brașov',root)).toBeNull();
  const page=await readMarketingCitySnapshot('CONSTANTA',root);expect(page?.status).toBe(200);expect(JSON.parse(page!.text).elements).toHaveLength(2);
 });
 it('falls back only when no snapshot exists',async()=>{expect(await readMarketingCitySnapshot('Constanța',root)).toBeNull();});
 it.each(['truncated','modified','expired','wrong-source','wrong-boundary'])('rejects %s data instead of importing or falling back silently',async(kind)=>{
  const data=envelope();
  if(kind==='modified')data.payload.elements[1].tags!.name='Changed';
  if(kind==='expired')data.datasetLastModified='2000-01-01T00:00:00.000Z';
  if(kind==='wrong-source')data.source='https://untrusted.example/file';
  if(kind==='wrong-boundary')data.boundaryRelation=101;
  await writeFile(join(root,'constanta-osm.json'),kind==='truncated'?'{':JSON.stringify(data));
  await expect(readMarketingCitySnapshot('Constanța',root)).rejects.toThrow('invalid');
 });
 it('refuses symbolic links and oversized snapshots',async()=>{
  const file=join(root,'constanta-osm.json');await writeFile(join(root,'other.json'),JSON.stringify(envelope()));await symlink(join(root,'other.json'),file);
  await expect(readMarketingCitySnapshot('Constanța',root)).rejects.toThrow('deschis');
  await rm(file);await writeFile(file,'x'.repeat(2000001));await expect(readMarketingCitySnapshot('Constanța',root)).rejects.toThrow('invalid');
 });
});
