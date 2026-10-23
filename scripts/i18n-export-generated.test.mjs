import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {ownReports,decodeCatalog,exportGeneratedCatalogs} from './i18n-export-generated.mjs';

const marker='NITIDO_I18N_REFRESH_V1',revision='d19e99cbbea719dd0aeaf14b4a9918184475e3a9';
const payload=Buffer.from(JSON.stringify({sample:'Public UI copy'}));
const base={marker,revision,event:'export',locale:'en',part:0,total:1,sha256:createHash('sha256').update(payload).digest('hex'),data:gzipSync(payload).toString('base64')};
const line=row=>'2026-10-24 '+JSON.stringify(row);
test('exports only the pinned job reports and deduplicates the two log sinks',()=>{
  const unrelated='unrelated private canary';
  const logs=[unrelated,line({...base,revision:'other'}),line(base),line(base)].join('\n');
  assert.equal(ownReports(logs).length,2);
  assert.deepEqual(decodeCatalog(logs,'en'),payload);
  assert(!JSON.stringify(ownReports(logs)).includes(unrelated));
});
test('rejects missing, conflicting or corrupt artifact parts',()=>{
  assert.throws(()=>decodeCatalog(line({...base,total:2}),'en'),/EXPORT_INCOMPLETE/);
  assert.throws(()=>decodeCatalog(line(base)+'\n'+line({...base,data:'different'}),'en'),/EXPORT_CONFLICTING_PART/);
  assert.throws(()=>decodeCatalog(line({...base,sha256:'0'.repeat(64)}),'en'),/EXPORT_HASH_MISMATCH/);
  assert.throws(()=>decodeCatalog(line(base),'fr'),/EXPORT_NOT_VISIBLE/);
});
test('a denied existing CI permission stops before creating any export task',async()=>{
  const requests=[];
  await assert.rejects(()=>exportGeneratedCatalogs({COOLIFY_TOKEN:'synthetic-only'},async(url,options)=>{
    requests.push({url,method:options.method});
    assert.equal(new URL(url).origin,'https://coolify.nitido.ro');
    if(url.endsWith('/applications/civaeb8joydtchvzlen6pivq'))return Response.json({status:'running:healthy',git_commit_sha:'d25796ca7e5bd8670eeb0326aa062e311aded729',fqdn:'https://sandbox.nitido.ro'});
    return Response.json({message:'forbidden'},{status:403});
  }),/COOLIFY_HTTP_403/);
  assert.equal(requests.length,2);
  assert(requests.every(r=>r.method==='GET'));
});
