// Manual OSM extract preparation. Writes only Marketing source files; never opens the application database.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { Readable, Transform, Writable } = require('node:stream');
const { spawn } = require('node:child_process');
const SOURCE = 'https://download.geofabrik.de/europe/romania-latest.osm.pbf';
const ROOT = '/app/data/marketing-sources';
const MAX_PBF = 600000000;
const MAX_JSON = 2000000;
const report = value => console.log('MKT_SNAPSHOT ' + JSON.stringify(value));
const key = value => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
function business(tags) {
  return !!String(tags?.name ?? '').trim() && (
    ['office','shop','craft','industrial','company'].some(k => Object.hasOwn(tags,k)) ||
    /^(hotel|guest_house|hostel|motel|apartment|camp_site)$/.test(tags.tourism ?? '') ||
    /^(restaurant|cafe|fast_food|bar|pub|bank|clinic|dentist|doctors|pharmacy|veterinary|hospital|car_rental|car_wash|fuel|cinema|theatre|childcare|training|driving_school|language_school)$/.test(tags.amenity ?? '') ||
    /^(fitness_centre|sports_centre)$/.test(tags.leisure ?? ''));
}
function candidate(item) {
  const fields = ['name','office','craft','shop','industrial','company','tourism','amenity','leisure','website','contact:website','email','contact:email','phone','contact:phone','addr:city','addr:place','addr:suburb','addr:postcode','addr:street'];
  return { type:item.type, id:item.id, tags:Object.fromEntries(fields.filter(k => typeof item.tags[k] === 'string').map(k => [k,item.tags[k]])) };
}
function stitchRings(segments, coordinates) {
  const remaining = segments.map(refs => [...refs]);
  const rings = [];
  while (remaining.length) {
    const refs = remaining.pop();
    while (refs[0] !== refs.at(-1)) {
      const end = refs.at(-1);
      const matches = remaining.map((r,i) => r[0] === end || r.at(-1) === end ? i : -1).filter(i => i >= 0);
      if (matches.length !== 1) throw Error('BOUNDARY_NOT_CLOSED');
      const next = remaining.splice(matches[0],1)[0];
      if (next.at(-1) === end) next.reverse();
      refs.push(...next.slice(1));
    }
    if (refs.length < 4) throw Error('BOUNDARY_TOO_SHORT');
    rings.push(refs.map(id => {
      const point = coordinates.get(id);
      if (!point || point.some(v => !Number.isFinite(v))) throw Error('BOUNDARY_COORDINATE_MISSING');
      return point;
    }));
  }
  return rings;
}
function inRing(point, ring) {
  const [x,y] = point;
  let inside = false;
  for (let i = 0, j = ring.length-1; i < ring.length; j = i++) {
    const [xi,yi] = ring[i], [xj,yj] = ring[j];
    const cross = (x-xi)*(yj-yi)-(y-yi)*(xj-xi);
    if (Math.abs(cross)<1e-10 && x>=Math.min(xi,xj)-1e-10 && x<=Math.max(xi,xj)+1e-10 && y>=Math.min(yi,yj)-1e-10 && y<=Math.max(yi,yj)+1e-10) return true;
    if ((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside = !inside;
  }
  return inside;
}
function inBoundary(point, outer, inner) {
  return outer.some(ring => inRing(point,ring)) && !inner.some(ring => inRing(point,ring));
}
function selectedRelations(seeds, parents) {
  const result = new Set(seeds), queue = [...seeds];
  for (let i=0; i<queue.length; i++) for (const parent of parents.get(queue[i]) ?? []) {
    if (!result.has(parent)) { result.add(parent); queue.push(parent); }
  }
  return result;
}
async function parseFile(file, parseOSM, visit, phase) {
  let count = 0;
  const parser = parseOSM();
  // This parser fails closed for unsupported ordinary nodes instead of silently dropping them.
  const warn = console.warn;
  console.warn = () => { throw Error('PBF_UNSUPPORTED_ENTITY'); };
  try {
    await pipeline(fs.createReadStream(file),parser,new Writable({ objectMode:true, write(items,_enc,done) {
      try { for (const item of items) { visit(item); count++; } done(); } catch (error) { done(error); }
    }}));
  } finally { console.warn = warn; }
  if (!count) throw Error('PBF_EMPTY');
  report({ phase, entities:count });
}
async function prepare(file, parseOSM, metadata, options = {}) {
  const countyMode = !!options.region;
  let emitted = 0;
  const emit = item => { emitted++; if (options.emit) options.emit(candidate(item)); else elements.push(candidate(item)); };
  let boundary;
  await parseFile(file,parseOSM,item => {
    const t = item.tags ?? {};
    if (item.type==='relation' && t.boundary==='administrative' && (countyMode ? t.admin_level==='4'&&t['ISO3166-2']===options.region.iso : ['8','9'].includes(t.admin_level)&&key(t.name)==='constanta')) {
      if (boundary) throw Error('BOUNDARY_AMBIGUOUS');
      boundary = item;
    }
  },'boundary');
  if (!boundary) throw Error('BOUNDARY_NOT_FOUND');
  const members = boundary.members.filter(m => ['','outer','inner'].includes(m.role));
  if (!members.length || members.some(m => m.type!=='way')) throw Error('BOUNDARY_MEMBERS_UNSUPPORTED');
  const memberIds = new Set(members.map(m => m.id)), ways = new Map();
  await parseFile(file,parseOSM,item => {
    if (item.type==='way' && memberIds.has(item.id)) ways.set(item.id,item.refs);
  },'boundary-ways');
  if (ways.size !== memberIds.size) throw Error('BOUNDARY_WAY_MISSING');
  const requiredNodes = new Set([...ways.values()].flat()), coordinates = new Map();
  await parseFile(file,parseOSM,item => {
    if (item.type==='node' && requiredNodes.has(item.id)) coordinates.set(item.id,[item.lon,item.lat]);
  },'boundary-coordinates');
  const outer = stitchRings(members.filter(m => m.role!=='inner').map(m => ways.get(m.id)),coordinates);
  const inner = stitchRings(members.filter(m => m.role==='inner').map(m => ways.get(m.id)),coordinates);
  if (!outer.length || inner.some(ring => !outer.some(o => inRing(ring[0],o)))) throw Error('BOUNDARY_HOLE_INVALID');
  const points = outer.flat();
  const bbox = [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
  const insideNodes = options.createSet?.('nodes') ?? new Set(), insideWays = options.createSet?.('ways') ?? new Set(), relationSeeds = new Set(), parents = new Map();
  const elements = [], relations = [];
  let order = 0, relationEdges = 0;
  await parseFile(file,parseOSM,item => {
    const rank = {node:0,way:1,relation:2}[item.type];
    if (rank===undefined || rank<order || !Number.isSafeInteger(item.id) || item.id<1) throw Error('PBF_ORDER_OR_ID_INVALID');
    order = rank;
    if (item.type==='node') {
      if (item.lon<bbox[0] || item.lat<bbox[1] || item.lon>bbox[2] || item.lat>bbox[3] || !inBoundary([item.lon,item.lat],outer,inner)) return;
      insideNodes.add(item.id);
      if (!countyMode && insideNodes.size>1000000) throw Error('SOURCE_GEOMETRY_LIMIT');
      if (business(item.tags)) emit(item);
    } else if (item.type==='way') {
      if (!item.refs.some(id=>insideNodes.has(id))) return;
      insideWays.add(item.id);
      if (business(item.tags)) emit(item);
    } else {
      for (const m of item.members) {
        if (m.type==='node' && insideNodes.has(m.id) || m.type==='way' && insideWays.has(m.id)) relationSeeds.add(item.id);
        if (m.type==='relation') {
          if (++relationEdges>500000) throw Error('SOURCE_RELATION_LIMIT');
          if (!parents.has(m.id)) parents.set(m.id,new Set());
          parents.get(m.id).add(item.id);
        }
      }
      if (business(item.tags)) relations.push(candidate(item));
    }
    if (!countyMode && elements.length>20000) throw Error('SOURCE_INVENTORY_LIMIT');
  },'municipality');
  const insideRelations = selectedRelations(relationSeeds,parents);
  for (const item of relations.filter(r=>insideRelations.has(r.id))) emit(item);
  if (!emitted || !countyMode && emitted>20000) throw Error('SOURCE_INVENTORY_EMPTY_OR_TOO_LARGE');
  const payload = { elements:[{type:'area',id:3600000000+boundary.id},...elements] };
  const text = JSON.stringify(payload);
  const envelope = { schemaVersion:1, city:countyMode?undefined:'Constanța', countyCode:options.region?.code, boundaryName:boundary.tags.name, scope:countyMode?'county':'city', createdAt:new Date().toISOString(), ...metadata,
    boundaryRelation:boundary.id, sha256:createHash('sha256').update(text).digest('hex'), payload };
  const output = JSON.stringify(envelope);
  if (!countyMode && Buffer.byteLength(output)>MAX_JSON) throw Error('SOURCE_JSON_TOO_LARGE');
  return {output,total:emitted,boundaryRelation:boundary.id};
}
// Geometry membership can exceed millions of OSM nodes without retaining all IDs in the JS heap.
class SpillSet {
  constructor(db,name,threshold=400000){
    if(!['nodes','ways'].includes(name))throw Error('GEOMETRY_TABLE_INVALID');
    this.db=db;this.name=name;this.threshold=threshold;this.memory=new Set();this.size=0;this.bloom=new Uint8Array(8388608);
    db.exec('CREATE TABLE '+name+'(id INTEGER PRIMARY KEY)');this.get=db.prepare('SELECT 1 FROM '+name+' WHERE id=?');this.insert=db.prepare('INSERT OR IGNORE INTO '+name+' VALUES(?)');
  }
  hashes(id){const low=id>>>0,high=Math.floor(id/4294967296);return [Math.imul(low^high,0x9e3779b1)>>>0,Math.imul(low^(high+0x85ebca6b),0xc2b2ae35)>>>0].map(n=>n&67108863);}
  add(id){if(this.has(id))return;this.memory.add(id);this.size++;for(const bit of this.hashes(id))this.bloom[bit>>>3]|=1<<(bit&7);if(this.memory.size>=this.threshold){this.db.transaction(()=>{for(const value of this.memory)this.insert.run(value);})();this.memory.clear();}}
  has(id){if(this.hashes(id).some(bit=>!(this.bloom[bit>>>3]&(1<<(bit&7)))))return false;return this.memory.has(id)||!!this.get.get(id);}
}
async function main() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (origin!=='https://sandbox.nitido.ro' && !(origin==='https://nitido.ro' && process.argv.includes('--live'))) throw Error('SNAPSHOT_ORIGIN_GUARD');
  if (process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true') throw Error('MARKETING_DELIVERY_MUST_BE_OFF');
  if (process.env.HTTPS_PROXY || process.env.https_proxy) throw Error('SNAPSHOT_PROXY_SETUP_REQUIRED');
  const countyFlag = process.argv.find(arg=>arg.startsWith('--county='));
  const countyCode = countyFlag?.split('=')[1]?.toUpperCase();
  const regionCodes = 'AB AR AG BC BH BN BT BV BR B BZ CS CL CJ CT CV DB DJ GL GR GJ HR HD IL IS IF MM MH MS NT OT PH SM SJ SB SV TR TM TL VS VL VN'.split(' ');
  if(countyCode&&!regionCodes.includes(countyCode))throw Error('COUNTY_INVALID');
  const targetRoot=countyCode?path.join(ROOT,'counties',countyCode):ROOT;
  await fsp.mkdir(targetRoot,{recursive:true,mode:0o700});
  const lock = await fsp.open(path.join(targetRoot,'prepare.lock'),'wx',0o600);
  const workdir = await fsp.mkdtemp('/tmp/nitido-marketing-osm-');
  const pbf = path.join(workdir,'romania.osm.pbf');
  try {
    const tooling = path.join(workdir,'tooling');
    if (!fs.existsSync(path.join(tooling,'node_modules/osm-pbf-parser'))) {
      await new Promise((resolve,reject) => {
        const child = spawn('npm',['install','--prefix',tooling,'--cache',path.join(tooling,'.npm'),'--omit=dev','--ignore-scripts','--no-audit','--no-fund','osm-pbf-parser@2.3.0'],{stdio:'ignore'});
        child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('PBF_TOOL_INSTALL_FAILED')));
      });
    }
    const parserPath = path.join(tooling,'node_modules/osm-pbf-parser');
    if (require(path.join(parserPath,'package.json')).version!=='2.3.0') throw Error('PBF_TOOL_VERSION_INVALID');
    const response = await fetch(SOURCE,{signal:AbortSignal.timeout(180000),headers:{'User-Agent':'NITIDO-Marketing/1.0 (+https://nitido.ro/contact)'}});
    const length = Number(response.headers.get('content-length'));
    if (!response.ok || length<1000000 || length>MAX_PBF || new URL(response.url).origin!=='https://download.geofabrik.de') { await response.body?.cancel(); throw Error('SOURCE_DOWNLOAD_INVALID'); }
    const disk = fs.statfsSync(workdir);
    if (disk.bavail*disk.bsize < length*4+256000000) { await response.body.cancel(); throw Error('SOURCE_DISK_SPACE_LOW'); }
    const modified = response.headers.get('last-modified');
    if (!modified || !Number.isFinite(Date.parse(modified)) || Date.now()-Date.parse(modified)>14*86400000) { await response.body.cancel(); throw Error('SOURCE_EXTRACT_STALE'); }
    const checksumResponse = await fetch(SOURCE+'.md5',{signal:AbortSignal.timeout(15000)});
    if (!checksumResponse.ok) { await response.body.cancel(); throw Error('SOURCE_CHECKSUM_UNAVAILABLE'); }
    const checksum = (await checksumResponse.text()).trim().split(/\s+/)[0];
    if (!/^[a-f0-9]{32}$/i.test(checksum)) { await response.body.cancel(); throw Error('SOURCE_CHECKSUM_INVALID'); }
    const md5 = createHash('md5'), sha = createHash('sha256');let bytes = 0;
    report({phase:'download',expectedBytes:length});
    await pipeline(Readable.fromWeb(response.body),new Transform({transform(chunk,_enc,done) {
      bytes+=chunk.length;md5.update(chunk);sha.update(chunk);done(bytes>MAX_PBF?Error('SOURCE_DOWNLOAD_TOO_LARGE'):null,chunk);
    }}),fs.createWriteStream(pbf,{mode:0o600,flags:'wx'}));
    if (bytes!==length || md5.digest('hex')!==checksum.toLowerCase()) throw Error('SOURCE_CHECKSUM_MISMATCH');
    const metadata={source:SOURCE,datasetLastModified:new Date(modified).toISOString(),pbfSha256:sha.digest('hex')};
    let result;
    if(countyCode){
      const Database=require('better-sqlite3'),geometry=new Database(path.join(workdir,'geometry.db'));
      geometry.pragma('journal_mode=OFF');geometry.pragma('synchronous=OFF');
      const generation=randomUUID(),directory=path.join(targetRoot,generation);await fsp.mkdir(directory,{mode:0o700});
      const parts=[];let pending=[],pendingBytes=0;
      const flush=()=>{if(!pending.length)return;const content=JSON.stringify({elements:pending}),file='part-'+String(parts.length+1).padStart(6,'0')+'.json';fs.writeFileSync(path.join(directory,file),content,{flag:'wx',mode:0o600});parts.push({file,count:pending.length,bytes:Buffer.byteLength(content),sha256:createHash('sha256').update(content).digest('hex')});pending=[];pendingBytes=0;};
      try{
        result=await prepare(pbf,require(parserPath),metadata,{region:{code:countyCode,iso:'RO-'+countyCode},createSet:name=>new SpillSet(geometry,name),emit:item=>{
          const size=Buffer.byteLength(JSON.stringify(item));if(size>700000)throw Error('SOURCE_RECORD_TOO_LARGE');
          if(pending.length>=500||pendingBytes+size>700000)flush();pending.push(item);pendingBytes+=size;
        }});flush();
        const prepared=JSON.parse(result.output);
        const manifest={schemaVersion:2,scope:'county',countyCode,generation,createdAt:prepared.createdAt,...metadata,boundaryName:prepared.boundaryName,boundaryRelation:result.boundaryRelation,total:result.total,parts};
        const content=JSON.stringify(manifest),envelope=JSON.stringify({...manifest,sha256:createHash('sha256').update(content).digest('hex')});
        const temporary=path.join(targetRoot,'manifest-'+randomUUID()+'.tmp');await fsp.writeFile(temporary,envelope,{flag:'wx',mode:0o600});await fsp.rename(temporary,path.join(targetRoot,'current.json'));result.inventoryBytes=Buffer.byteLength(envelope)+parts.reduce((sum,part)=>sum+part.bytes,0);result.parts=parts.length;
      }catch(error){await fsp.rm(directory,{recursive:true,force:true});throw error;}finally{geometry.close();}
    }else{
      result=await prepare(pbf,require(parserPath),metadata);
      const temporary=path.join(ROOT,'snapshot-'+randomUUID()+'.tmp');await fsp.writeFile(temporary,result.output,{mode:0o600,flag:'wx'});await fsp.rename(temporary,path.join(ROOT,'constanta-osm.json'));
    }
    report({phase:'ready',total:result.total,boundaryRelation:result.boundaryRelation,sourceBytes:bytes,inventoryBytes:result.inventoryBytes??Buffer.byteLength(result.output),scope:countyCode?'county':'city',countyCode,parts:result.parts,delivery:'blocked'});
  } finally {
    await fsp.rm(workdir,{recursive:true,force:true});await lock.close();await fsp.rm(path.join(targetRoot,'prepare.lock'),{force:true});
  }
}
module.exports = { business, candidate, stitchRings, inRing, inBoundary, selectedRelations, prepare, SpillSet };
if (require.main===module || process.argv[1]===undefined || process.argv.slice(1).some(arg=>arg==='--live'||arg.startsWith('--county='))) main().catch(error=>{
  report({phase:'failed',code:/^[A-Z_]+$/.test(error.message)?error.message:'SNAPSHOT_PREPARATION_FAILED'});process.exitCode=1;
});
