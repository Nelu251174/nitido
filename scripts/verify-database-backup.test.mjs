import {test} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {mkdtemp,rm,readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {verifyDatabaseBackup} from './verify-database-backup.mjs';
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'nitido-backup-'));t.after(()=>rm(root,{recursive:true,force:true}));return {root,source:join(root,'source.db'),output:join(root,'drill')};}
test('restores committed WAL rows, schema, relations and immutable history without changing source',async t=>{
 const {source,output}=await fixture(t);const db=new Database(source);t.after(()=>db.close());db.pragma('journal_mode=WAL');db.pragma('wal_autocheckpoint=0');
 db.exec(`CREATE TABLE jobs(id TEXT PRIMARY KEY);CREATE TABLE history(id TEXT PRIMARY KEY,job_id TEXT REFERENCES jobs(id),note TEXT);CREATE TRIGGER immutable BEFORE DELETE ON history BEGIN SELECT RAISE(ABORT,'retained'); END;INSERT INTO jobs VALUES('j');INSERT INTO history VALUES('h','j','Test record');`);
 const before=await readFile(source),wal=await readFile(source+'-wal');const result=await verifyDatabaseBackup(source,output);
 assert.equal(result.status,'passed');assert.deepEqual(result.counts,{history:1,jobs:1});assert.deepEqual(await readFile(source),before);assert.deepEqual(await readFile(source+'-wal'),wal);
 const restored=new Database(join(output,'restored.db'));try{assert.deepEqual(restored.prepare('SELECT * FROM history').get(),{id:'h',job_id:'j',note:'Test record'});assert.throws(()=>restored.exec('DELETE FROM history'),/retained/);}finally{restored.close();}
 const report=await readFile(join(output,'verification.json'),'utf8');assert.ok(!report.includes('Test record'));assert.equal((await stat(join(output,'snapshot.db'))).mode&0o777,0o600);
});
test('missing source never creates an empty database or a success report',async t=>{const {source,output}=await fixture(t);await assert.rejects(verifyDatabaseBackup(source,output));await assert.rejects(stat(source));await assert.rejects(stat(output));});
test('refuses existing output without overwriting files',async t=>{const {source,output}=await fixture(t);new Database(source).close();await mkdir(output);await writeFile(join(output,'snapshot.db'),'KEEP');await assert.rejects(verifyDatabaseBackup(source,output),/EEXIST/);assert.equal(await readFile(join(output,'snapshot.db'),'utf8'),'KEEP');});
test('foreign-key violations cannot produce a passing drill',async t=>{const {source,output}=await fixture(t);const db=new Database(source);db.pragma('foreign_keys=OFF');db.exec("CREATE TABLE p(id TEXT PRIMARY KEY);CREATE TABLE c(pid TEXT REFERENCES p(id));INSERT INTO c VALUES('missing');");db.close();await assert.rejects(verifyDatabaseBackup(source,output),/foreign key/);await assert.rejects(stat(join(output,'verification.json')));});
test('corrupt source cannot produce a passing drill',async t=>{const {source,output}=await fixture(t);await writeFile(source,'not a database');await assert.rejects(verifyDatabaseBackup(source,output));await assert.rejects(stat(join(output,'verification.json')));});
