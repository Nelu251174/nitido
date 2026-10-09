import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import {prepareReleasePlan,simulateLocalRelease} from './release-preparation.mjs';

const sha='a'.repeat(40);
test('offline plans refuse ambiguous targets and remain blocked without current infrastructure evidence',()=>{
 for(const [target,candidate]of [['sandbox',undefined],['production','latest'],['unknown',sha],['sandbox',sha.slice(1)]])assert.throws(()=>prepareReleasePlan(target,candidate),/exact 40-character/);
 const sandbox=prepareReleasePlan('sandbox',sha),production=prepareReleasePlan('production',sha);
 assert.equal(sandbox.readyForDeployment,false);assert.equal(production.readyForDeployment,false);assert.equal(sandbox.observedCurrentState,null);assert.equal(production.remoteCalls,0);
 assert.notEqual(sandbox.applicationUuid,production.applicationUuid);assert.equal(sandbox.expectedVolumes.data,null);assert.equal(production.expectedVolumes.data,'zxnelxi2cejranyvfpw0scac_nitido-data');
 assert.equal(sandbox.composeFile,null);assert.equal(production.composeFile,'docker-compose.production.yml');
 assert(production.rollback.forbidden.includes('Overwrite accepted post-release rows with an old DB backup'));
 assert(production.stages.find(s=>s.id==='migration-preview').commandEnvironment.NITIDO_PRO_DB_PATH.endsWith('-isolated-restore/data/nitido.db'));
});

test('offline restore/migration/rollback drill preserves later data and never overwrites a prior run or contacts services',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nitido-release-test-')),output=path.join(root,'new-drill'),originalFetch=globalThis.fetch;
 let remoteCalls=0;globalThis.fetch=async()=>{remoteCalls++;throw Error('External requests forbidden in a local release drill');};
 try{
  const report=await simulateLocalRelease(output,sha);assert.equal(report.status,'passed');assert.equal(remoteCalls,0);
  for(const rootName of report.uploadRoots){assert((await fs.stat(path.join(output,'rollback-preserving-new-data',rootName))).isDirectory());assert.deepEqual(await fs.readFile(path.join(output,'baseline-v12',rootName,'synthetic-photo.bin')),await fs.readFile(path.join(output,'rollback-preserving-new-data',rootName,'synthetic-photo.bin')));}
  const original=new Database(path.join(output,'baseline-v12/data/nitido.db'),{readonly:true}),rollback=new Database(path.join(output,'rollback-preserving-new-data/data/nitido.db'),{readonly:true});
  try{assert.equal(original.prepare("SELECT COUNT(*) FROM jobs WHERE id='post-release'").pluck().get(),0);assert.equal(rollback.prepare("SELECT COUNT(*) FROM jobs WHERE id='post-release'").pluck().get(),1);assert.deepEqual(original.prepare('SELECT version FROM pro_schema_migrations ORDER BY version').all().map(r=>r.version),[11,12]);assert.deepEqual(rollback.prepare('SELECT version FROM pro_schema_migrations ORDER BY version').all().map(r=>r.version),[11,12,13,14]);assert.equal(original.prepare("SELECT checklist_json FROM pro_work_orders WHERE id='frozen-work'").pluck().get(),rollback.prepare("SELECT checklist_json FROM pro_work_orders WHERE id='frozen-work'").pluck().get());}
  finally{original.close();rollback.close();}
  assert.deepEqual(await fs.readFile(path.join(output,'rollback-preserving-new-data/data/pro-uploads/new-after-release.bin')),Buffer.from([9,8,7,6]));
  const evidence=await fs.readFile(path.join(output,'simulation-report.json'),'utf8');await assert.rejects(simulateLocalRelease(output,sha),/EEXIST/);assert.equal(await fs.readFile(path.join(output,'simulation-report.json'),'utf8'),evidence);
 }finally{globalThis.fetch=originalFetch;await fs.rm(root,{recursive:true,force:true});}
});
