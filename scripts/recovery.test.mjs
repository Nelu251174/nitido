import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import {backup,restore} from './recovery.mjs';
test('isolated backup and restore preserves SQLite relations and photo bytes; rejects corruption and overwrite',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nitido-recovery-'));let db;
 try{
 const source=path.join(root,'source'),archive=path.join(root,'archive'),destination=path.join(root,'restored');
 await fs.mkdir(path.join(source,'data'),{recursive:true});await fs.mkdir(path.join(source,'public/uploads/job'),{recursive:true});
 db=new Database(path.join(source,'data/nitido.db'));db.pragma('journal_mode = WAL');db.exec("CREATE TABLE users(id TEXT PRIMARY KEY); CREATE TABLE jobs(id TEXT PRIMARY KEY,owner TEXT REFERENCES users(id),photo TEXT); INSERT INTO users VALUES('test-owner'); INSERT INTO jobs VALUES('test-job','test-owner','job/before.png');");
 const photo=Buffer.from([137,80,78,71,0,255,1]);await fs.writeFile(path.join(source,'public/uploads/job/before.png'),photo);
 await assert.rejects(backup(source,archive),/quiesced/);await backup(source,archive,{quiesced:true});db.close();db=null;
 await restore(archive,destination);const restored=new Database(path.join(destination,'data/nitido.db'));try{assert.deepEqual(restored.prepare('SELECT * FROM jobs').get(),{id:'test-job',owner:'test-owner',photo:'job/before.png'});assert.equal(restored.pragma('integrity_check',{simple:true}),'ok');}finally{restored.close();}
 assert.deepEqual(await fs.readFile(path.join(destination,'public/uploads/job/before.png')),photo);
 await assert.rejects(restore(archive,destination),/EEXIST/);assert.deepEqual(await fs.readFile(path.join(destination,'public/uploads/job/before.png')),photo);
 await fs.writeFile(path.join(archive,'public/uploads/job/before.png'),'damaged');const rejected=path.join(root,'rejected');await assert.rejects(restore(archive,rejected),/checksum/);await assert.rejects(fs.stat(rejected),/ENOENT/);
 }finally{db?.close();await fs.rm(root,{recursive:true,force:true});}
});
test('restore rejects traversal paths without creating a destination',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'nitido-invalid-'));try{await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify({version:1,files:[{path:'public/uploads/../../../escape',size:0,sha256:''}]}));await assert.rejects(restore(root,path.join(os.tmpdir(),'nitido-unwanted-restore')),/Invalid manifest path/);}finally{await fs.rm(root,{recursive:true,force:true});}});
