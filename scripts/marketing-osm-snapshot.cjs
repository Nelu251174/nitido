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
  const fields = ['name','office','craft','shop','industrial','company','tourism','amenity','leisure','website','contact:website','email','contact:email','phone','contact:phone'];
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
async function prepare(file, parseOSM, metadata) {
  let boundary;
  await parseFile(file,parseOSM,item => {
    const t = item.tags ?? {};
    if (item.type==='relation' && t.boundary==='administrative' && ['8','9'].includes(t.admin_level) && key(t.name)==='constanta') {
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
  const insideNodes = new Set(), insideWays = new Set(), relationSeeds = new Set(), parents = new Map();
  const elements = [], relations = [];
  let order = 0, relationEdges = 0;
  await parseFile(file,parseOSM,item => {
    const rank = {node:0,way:1,relation:2}[item.type];
    if (rank===undefined || rank<order || !Number.isSafeInteger(item.id) || item.id<1) throw Error('PBF_ORDER_OR_ID_INVALID');
    order = rank;
    if (item.type==='node') {
      if (item.lon<bbox[0] || item.lat<bbox[1] || item.lon>bbox[2] || item.lat>bbox[3] || !inBoundary([item.lon,item.lat],outer,inner)) return;
      insideNodes.add(item.id);
      if (insideNodes.size>1000000) throw Error('SOURCE_GEOMETRY_LIMIT');
      if (business(item.tags)) elements.push(candidate(item));
    } else if (item.type==='way') {
      if (!item.refs.some(id=>insideNodes.has(id))) return;
      insideWays.add(item.id);
      if (business(item.tags)) elements.push(candidate(item));
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
    if (elements.length>20000) throw Error('SOURCE_INVENTORY_LIMIT');
  },'municipality');
  const insideRelations = selectedRelations(relationSeeds,parents);
  elements.push(...relations.filter(r=>insideRelations.has(r.id)));
  if (!elements.length || elements.length>20000) throw Error('SOURCE_INVENTORY_EMPTY_OR_TOO_LARGE');
  const payload = { elements:[{type:'area',id:3600000000+boundary.id},...elements] };
  const text = JSON.stringify(payload);
  const envelope = { schemaVersion:1, city:'Constanța', createdAt:new Date().toISOString(), ...metadata,
    boundaryRelation:boundary.id, sha256:createHash('sha256').update(text).digest('hex'), payload };
  const output = JSON.stringify(envelope);
  if (Buffer.byteLength(output)>MAX_JSON) throw Error('SOURCE_JSON_TOO_LARGE');
  return {output,total:elements.length,boundaryRelation:boundary.id};
}
async function main() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (origin!=='https://sandbox.nitido.ro' && !(origin==='https://nitido.ro' && process.argv.includes('--live'))) throw Error('SNAPSHOT_ORIGIN_GUARD');
  if (process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true') throw Error('MARKETING_DELIVERY_MUST_BE_OFF');
  if (process.env.HTTPS_PROXY || process.env.https_proxy) throw Error('SNAPSHOT_PROXY_SETUP_REQUIRED');
  await fsp.mkdir(ROOT,{recursive:true,mode:0o700});
  const lock = await fsp.open(path.join(ROOT,'prepare.lock'),'wx',0o600);
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
    const result = await prepare(pbf,require(parserPath),{source:SOURCE,datasetLastModified:new Date(modified).toISOString(),pbfSha256:sha.digest('hex')});
    const temporary = path.join(ROOT,'snapshot-'+randomUUID()+'.tmp');
    await fsp.writeFile(temporary,result.output,{mode:0o600,flag:'wx'});
    await fsp.rename(temporary,path.join(ROOT,'constanta-osm.json'));
    report({phase:'ready',total:result.total,boundaryRelation:result.boundaryRelation,sourceBytes:bytes,inventoryBytes:Buffer.byteLength(result.output),delivery:'blocked'});
  } finally {
    await fsp.rm(workdir,{recursive:true,force:true});await lock.close();await fsp.rm(path.join(ROOT,'prepare.lock'),{force:true});
  }
}
module.exports = { business, candidate, stitchRings, inRing, inBoundary, selectedRelations, prepare };
if (require.main===module || module.id==='[eval]') main().catch(error=>{
  report({phase:'failed',code:/^[A-Z_]+$/.test(error.message)?error.message:'SNAPSHOT_PREPARATION_FAILED'});process.exitCode=1;
});
