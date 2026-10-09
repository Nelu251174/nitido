/** Offline release preparation. Never calls Coolify, SSH, webhooks, payments or messaging. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import Database from 'better-sqlite3';
import {backup,restore,UPLOAD_ROOTS} from './recovery.mjs';

export const TARGETS=Object.freeze({
 sandbox:{url:'https://sandbox.nitido.ro',coolifyUrl:'https://coolify.nitido.ro',applicationUuid:'civaeb8joydtchvzlen6pivq',applicationUuidEvidence:'Historical documentation; reconfirm before any mutation',composeFile:null,expectedVolumes:{data:null,publicUploads:null},previousDocumentedSha:'66ab20494b54f11a547207e70063afd4dace5429'},
 production:{url:'https://nitido.ro',coolifyUrl:'https://coolify.nitido.ro',applicationUuid:'zxnelxi2cejranyvfpw0scac',applicationUuidEvidence:'Historical documentation and production Compose; reconfirm before any mutation',composeFile:'docker-compose.production.yml',expectedVolumes:{data:'zxnelxi2cejranyvfpw0scac_nitido-data',publicUploads:'zxnelxi2cejranyvfpw0scac_nitido-uploads'},previousDocumentedSha:'9cbc59357c0a6b0aa29e91cdfb8d69c3de97ff35'},
});
export function prepareReleasePlan(target,candidateSha){
 if(!Object.hasOwn(TARGETS,target)||!/^[a-f0-9]{40}$/.test(candidateSha??''))throw Error('Provide sandbox|production and an exact 40-character candidate SHA.');
 const metadata=TARGETS[target],archive=`/release-backups/${target}-${candidateSha}`,drill=archive+'-isolated-restore';
 return {
  version:1,mode:'offline-dry-run',remoteCalls:0,target,...metadata,candidateSha,observedCurrentState:null,readyForDeployment:false,
  mountsToObserve:['/app/data','/app/public/uploads'],uploadRoots:UPLOAD_ROOTS,
  requiredCurrentEvidence:['Authenticated Coolify application UUID/domains/source branch/commit and current image digest','Actual persistent mounts and ownership; sandbox volumes must never equal production volumes','Exact candidate contains observed deployed baseline; current CI and functional acceptance on that candidate','Independent coherent backup and restore of DB plus public/private Marketplace/Pro uploads','Previous compatible image reference and secure configuration retained; never print credential values'],
  stages:[
   {id:'identify',effect:'read-only',request:{method:'GET',url:`${metadata.coolifyUrl}/api/v1/applications/${metadata.applicationUuid}`,outputFields:['uuid','domains','git_branch','git_commit_sha','status'],redactSecrets:true},requires:'Allowed network and authenticated Coolify connection; UUID is unverified historical evidence'},
   {id:'quiesce',effect:'host-change-after-target-verification',requires:'Stop all app instances, cron/worker writers and uploads; capture stopped process/container IDs. A --quiesced flag alone is insufficient.'},
   {id:'complete-backup',effect:'new-exclusive-backup-only',executionContext:'Candidate recovery helper with observed volume mounts at /snapshot; no application/server/cron process',argv:['node','/app/scripts/recovery.mjs','backup','/snapshot',archive,'--quiesced'],requires:'Persistent protected backup parent outside the source mounts, owned by the helper user'},
   {id:'restore-drill',effect:'new-exclusive-directory-only',argv:['node','/app/scripts/recovery.mjs','restore',archive,drill],requires:'Validate manifest, photo bytes, SQLite integrity/FK, table counts and frozen work snapshots; do not mount the drill into an externally connected app'},
   {id:'migration-preview',effect:'isolated-drill-only',argv:['node','/app/scripts/pro-migrate.mjs'],commandEnvironment:{NITIDO_PRO_DB_PATH:drill+'/data/nitido.db'},requires:'Compiled candidate schema; preserve every existing row and work/checklist/photo snapshot; migration version 14 verified'},
   {id:'migration',effect:'real-db-only-after-all-prior-evidence',argv:['node','/app/scripts/pro-migrate.mjs'],commandEnvironment:{NITIDO_PRO_DB_PATH:'/snapshot/data/nitido.db'},requires:'Writers still stopped, independently restored backup verified, target identity and SHA reconfirmed'},
   {id:'install',effect:'explicit-Coolify-application-only',applicationUuid:metadata.applicationUuid,candidateSha,composeFile:metadata.composeFile,requires:'Preserve observed volume names, existing service configuration and test/live separation; do not trigger a generic unknown webhook'},
   {id:'validate',effect:'read-only-and-approved-synthetic-sandbox-checks',argv:['node','/app/scripts/healthcheck.mjs'],requires:'Confirm running image/SHA, health, HTTPS, auth roles, photo rules, daily recurrence and observation-only score. Sandbox acceptance precedes production promotion.'},
   {id:'resume',effect:'host-change-after-acceptance',requires:'Resume the same pre-existing writers after validation; verify existing cron configuration rather than invent new schedules'},
  ],
  rollback:{strategy:'Return to observed compatible previous image while preserving current database and all uploads; disable new modules if necessary',forbidden:['DROP new tables','Overwrite accepted post-release rows with an old DB backup','Change or delete existing volume names','Rotate credentials or copy production secrets into sandbox'],isolatedRestoreCommand:['node','/app/scripts/recovery.mjs','restore',archive,archive+'-rollback-investigation'],requires:'If actual data restoration becomes necessary, stop writers, first preserve current DB/uploads, reconcile later writes, and restore into new isolated storage; do not overwrite a running installation'},
 };
}

async function proSchema(){const compiled=new URL('../src/lib/pro/schema.mjs',import.meta.url);try{await fs.access(compiled);return await import(compiled.href);}catch(error){if(error.code!=='ENOENT')throw error;return await import(new URL('../src/lib/pro/schema.ts',import.meta.url).href);}}
function inventory(file){const db=new Database(file,{readonly:true,fileMustExist:true});try{return Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name})=>[name,createHash('sha256').update(JSON.stringify(db.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'" ORDER BY rowid').all())).digest('hex')]));}finally{db.close();}}
async function compareUploadBytes(source,destination,manifest){for(const entry of manifest.files.filter(f=>f.path!=='data/nitido.db'))assert.deepEqual(await fs.readFile(path.join(source,entry.path)),await fs.readFile(path.join(destination,entry.path)));}
export async function simulateLocalRelease(output,candidateSha){
 prepareReleasePlan('sandbox',candidateSha);await fs.mkdir(output,{mode:0o700});
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nitido-release-simulation-'));
 let db;
 try{
  const source=path.join(root,'source'),archive=path.join(output,'baseline-v12'),drill=path.join(output,'migration-drill'),currentArchive=path.join(output,'post-release-v14'),rollbackDrill=path.join(output,'rollback-preserving-new-data');
  for(const dir of UPLOAD_ROOTS)await fs.mkdir(path.join(source,dir),{recursive:true});
  db=new Database(path.join(source,'data/nitido.db'));db.pragma('foreign_keys=ON');db.exec("CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT);CREATE TABLE jobs(id TEXT PRIMARY KEY,client_id TEXT REFERENCES users(id),note TEXT);CREATE TABLE provider_invitations(id TEXT PRIMARY KEY);INSERT INTO users VALUES('qa-owner','Synthetic owner','owner@example.test','client');INSERT INTO jobs VALUES('pre-release','qa-owner','preserve');INSERT INTO provider_invitations VALUES('existing-provider-table');");
  const schema=await proSchema();db.exec(schema.PRO_SCHEMA);db.exec(schema.PRO_CHECKLIST_SCHEMA);
  db.prepare("INSERT INTO pro_organizations VALUES('org','Synthetic portfolio','Constanța','active',1000,1,'QA-ONLY',?)").run(new Date().toISOString());db.prepare("INSERT INTO pro_properties(id,organization_id,name,city,address) VALUES('property','org','Synthetic property','Constanța','Synthetic address')").run();
  db.prepare("INSERT INTO pro_work_orders(id,organization_id,property_id,title,service,status,starts_at,ends_at,threshold_snapshot,estimate,financial_status,checklist_json,created_by,created_at) VALUES('frozen-work','org','property','Synthetic work','cleaning_recurring','scheduled',?,?,1000,500,'not_required','[\"Frozen legacy task\"]','qa-owner',?)").run(new Date().toISOString(),new Date(Date.now()+3600000).toISOString(),new Date().toISOString());
  db.close();db=null;
  for(const [index,dir]of UPLOAD_ROOTS.entries())await fs.writeFile(path.join(source,dir,'synthetic-photo.bin'),Buffer.from([0,index,255,13,10]));
  const before=inventory(path.join(source,'data/nitido.db')),manifest=await backup(source,archive,{quiesced:true});assert.equal(manifest.version,2);assert.deepEqual(manifest.uploadRoots,UPLOAD_ROOTS);
  await restore(archive,drill);assert.deepEqual(inventory(path.join(drill,'data/nitido.db')),before);await compareUploadBytes(source,drill,manifest);
  db=new Database(path.join(drill,'data/nitido.db'));db.pragma('foreign_keys=ON');schema.migratePro(db);schema.migratePro(db);assert.deepEqual(db.prepare('SELECT version FROM pro_schema_migrations ORDER BY version').all().map(r=>r.version),[11,12,13,14]);db.close();db=null;
  const after=inventory(path.join(drill,'data/nitido.db'));for(const [name,fingerprint]of Object.entries(before))if(name!=='pro_schema_migrations')assert.equal(after[name],fingerprint,`Migration changed ${name}`);assert.deepEqual(inventory(path.join(source,'data/nitido.db')),before);
  db=new Database(path.join(drill,'data/nitido.db'));db.prepare("INSERT INTO jobs VALUES('post-release','qa-owner','new accepted data must survive rollback')").run();db.close();db=null;await fs.writeFile(path.join(drill,'data/pro-uploads/new-after-release.bin'),Buffer.from([9,8,7,6]));
  const current=inventory(path.join(drill,'data/nitido.db')),latest=await backup(drill,currentArchive,{quiesced:true});await restore(currentArchive,rollbackDrill);assert.deepEqual(inventory(path.join(rollbackDrill,'data/nitido.db')),current);await compareUploadBytes(drill,rollbackDrill,latest);
  const report={status:'passed',scope:'Offline synthetic release/rollback preparation, not infrastructure acceptance',candidateSha,remoteCalls:0,manifestVersion:2,uploadRoots:UPLOAD_ROOTS,baselineRestore:'all row fingerprints and all upload bytes equal',migrationVersions:[11,12,13,14],migrationIdempotent:true,existingMarketplaceProRowsPreserved:true,frozenWorkSnapshotsPreserved:true,sourceUnchanged:true,rollback:'new isolated restore of post-release v14 state; post-release row and Pro upload preserved',checks:{postReleaseRowPreserved:true,postReleasePrivateUploadPreserved:true,oldBackupNeverOverwritesCurrentState:true},createdAt:new Date().toISOString()};
  await fs.writeFile(path.join(output,'simulation-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});for(const target of Object.keys(TARGETS))await fs.writeFile(path.join(output,target+'-dry-run.json'),JSON.stringify(prepareReleasePlan(target,candidateSha),null,2)+'\n',{flag:'wx',mode:0o600});return report;
 }finally{db?.close();await fs.rm(root,{recursive:true,force:true});}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){try{const [action,arg,sha]=process.argv.slice(2);if(action==='plan')console.log(JSON.stringify(prepareReleasePlan(arg,sha),null,2));else if(action==='simulate')console.log(JSON.stringify(await simulateLocalRelease(path.resolve(arg),sha),null,2));else throw Error('Usage: release-preparation.mjs plan sandbox|production SHA | simulate NEW_OUTPUT_DIRECTORY SHA');}catch(error){console.error(error.message);process.exitCode=1;}}
