import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import {backup,restore,UPLOAD_ROOTS} from './recovery.mjs';
import {createHash} from 'node:crypto';
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

test('v2 preserves all public, private Marketplace and Pro bytes with source unchanged',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nitido-private-backup-'));
 try{
  const source=path.join(root,'source'),archive=path.join(root,'archive'),restored=path.join(root,'restored');
  for(const uploadRoot of UPLOAD_ROOTS)await fs.mkdir(path.join(source,uploadRoot,'nested'),{recursive:true});
  const database=path.join(source,'data/nitido.db'),db=new Database(database);db.exec("CREATE TABLE users(id TEXT PRIMARY KEY); CREATE TABLE media(id TEXT PRIMARY KEY,owner_id TEXT REFERENCES users(id),location TEXT); INSERT INTO users VALUES('synthetic');");
  const samples=new Map();for(const [index,uploadRoot]of UPLOAD_ROOTS.entries()){const name=uploadRoot+'/nested/photo.bin',bytes=Buffer.from([0,index,255,13,10]);samples.set(name,bytes);await fs.writeFile(path.join(source,name),bytes);db.prepare('INSERT INTO media VALUES(?,?,?)').run(String(index),'synthetic',name);}db.close();
  await fs.writeFile(path.join(source,'data/unrelated-config.json'),'not an upload or database');
  const sourceSha=createHash('sha256').update(await fs.readFile(database)).digest('hex');
  const manifest=await backup(source,archive,{quiesced:true});assert.equal(manifest.version,2);assert.deepEqual(manifest.uploadRoots,UPLOAD_ROOTS);assert.equal(manifest.files.length,4);assert.equal(manifest.files.some(f=>f.path.endsWith('unrelated-config.json')),false);
  await restore(archive,restored);for(const [name,bytes]of samples){assert.deepEqual(await fs.readFile(path.join(restored,name)),bytes);assert.deepEqual(await fs.readFile(path.join(source,name)),bytes);}
  assert.equal(createHash('sha256').update(await fs.readFile(database)).digest('hex'),sourceSha);
  const copy=new Database(path.join(restored,'data/nitido.db'));try{assert.equal(copy.prepare('SELECT COUNT(*) FROM media').pluck().get(),3);assert.equal(copy.pragma('integrity_check',{simple:true}),'ok');assert.deepEqual(copy.pragma('foreign_key_check'),[]);}finally{copy.close();}
  await fs.writeFile(path.join(archive,'data/pro-uploads/nested/photo.bin'),'corrupted');const rejected=path.join(root,'rejected');await assert.rejects(restore(archive,rejected),/checksum/);await assert.rejects(fs.stat(rejected),/ENOENT/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('WAL backup reads committed journal rows without creating or modifying source companions',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nitido-wal-source-'));let writer;
 try{
  for(const mode of ['closed-checkpointed','open-quiesced']){
   const source=path.join(root,mode),archive=path.join(root,mode+'-archive');await fs.mkdir(path.join(source,'data'),{recursive:true});await fs.mkdir(path.join(source,'public/uploads'),{recursive:true});
   writer=new Database(path.join(source,'data/nitido.db'));writer.pragma('journal_mode=WAL');writer.pragma('wal_autocheckpoint=0');writer.exec('CREATE TABLE committed(id INTEGER PRIMARY KEY);INSERT INTO committed VALUES(42)');
   if(mode==='closed-checkpointed'){writer.close();writer=null;}
   const beforeNames=(await fs.readdir(path.join(source,'data'))).sort(),before=await Promise.all(beforeNames.map(name=>fs.readFile(path.join(source,'data',name))));
   await backup(source,archive,{quiesced:true});assert.deepEqual((await fs.readdir(path.join(source,'data'))).sort(),beforeNames);
   for(const [index,name]of beforeNames.entries())assert.deepEqual(await fs.readFile(path.join(source,'data',name)),before[index],`Source ${name} changed`);
   const restored=new Database(path.join(archive,'data/nitido.db'),{readonly:true});try{assert.equal(restored.prepare('SELECT id FROM committed').pluck().get(),42);assert.equal(restored.pragma('integrity_check',{simple:true}),'ok');}finally{restored.close();}
   assert.equal((await fs.readdir(archive)).some(name=>name.startsWith('.sqlite-source-')),false);
   writer?.close();writer=null;
  }
 }finally{writer?.close();await fs.rm(root,{recursive:true,force:true});}
});

test('restores legacy v1 manifest without rewriting the archive and preserves empty v2 directories',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nitido-legacy-backup-'));
 try{
  const source=path.join(root,'source'),archive=path.join(root,'archive');for(const dir of UPLOAD_ROOTS)await fs.mkdir(path.join(source,dir),{recursive:true});
  const db=new Database(path.join(source,'data/nitido.db'));db.exec('CREATE TABLE example(id INTEGER PRIMARY KEY); INSERT INTO example VALUES(1)');db.close();
  const manifest=await backup(source,archive,{quiesced:true});await restore(archive,path.join(root,'v2'));for(const dir of UPLOAD_ROOTS)assert((await fs.stat(path.join(root,'v2',dir))).isDirectory());
  const legacy=path.join(root,'legacy');await fs.mkdir(path.join(legacy,'data'),{recursive:true});await fs.mkdir(path.join(legacy,'public/uploads'),{recursive:true});await fs.copyFile(path.join(archive,'data/nitido.db'),path.join(legacy,'data/nitido.db'));
  const raw=JSON.stringify({version:1,createdAt:manifest.createdAt,files:manifest.files});await fs.writeFile(path.join(legacy,'manifest.json'),raw);await restore(legacy,path.join(root,'v1'));assert.equal(await fs.readFile(path.join(legacy,'manifest.json'),'utf8'),raw);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('v2 rejects symbolic upload roots, nested links, undeclared roots and traversal with clean failure',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nitido-backup-paths-'));
 try{
  const source=path.join(root,'source');await fs.mkdir(path.join(source,'data'),{recursive:true});await fs.mkdir(path.join(source,'public/uploads'),{recursive:true});
  const db=new Database(path.join(source,'data/nitido.db'));db.exec('CREATE TABLE example(id INTEGER PRIMARY KEY)');db.close();
  const elsewhere=path.join(root,'elsewhere');await fs.mkdir(elsewhere);await fs.writeFile(path.join(elsewhere,'photo'),'external');await fs.symlink(elsewhere,path.join(source,'data/pro-uploads'),'dir');
  const rejected=path.join(root,'rejected');await assert.rejects(backup(source,rejected,{quiesced:true}),/symbolic links/);await assert.rejects(fs.stat(rejected),/ENOENT/);await fs.unlink(path.join(source,'data/pro-uploads'));
  await fs.symlink(path.join(elsewhere,'photo'),path.join(source,'data/nitido.db-wal'));await assert.rejects(backup(source,rejected,{quiesced:true}),/regular files/);await assert.rejects(fs.stat(rejected),/ENOENT/);await fs.unlink(path.join(source,'data/nitido.db-wal'));
  await fs.mkdir(path.join(source,'data/uploads'));await fs.symlink(path.join(elsewhere,'photo'),path.join(source,'data/uploads/link'));await assert.rejects(backup(source,rejected,{quiesced:true}),/Symbolic links/);await assert.rejects(fs.stat(rejected),/ENOENT/);await fs.unlink(path.join(source,'data/uploads/link'));
  const invalid=path.join(root,'invalid');await fs.mkdir(invalid);
  for(const [roots,entry]of [[['public/uploads','data'], 'data/uploads/photo'],[['public/uploads'], 'data/uploads/photo'],[['public/uploads','data/pro-uploads'], 'data/pro-uploads/../../../escape']]){await fs.writeFile(path.join(invalid,'manifest.json'),JSON.stringify({version:2,uploadRoots:roots,files:[{path:entry,size:0,sha256:'a'.repeat(64)}]}));await assert.rejects(restore(invalid,rejected),/Invalid manifest/);await assert.rejects(fs.stat(rejected),/ENOENT/);}
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('restore rejects traversal paths without creating a destination',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'nitido-invalid-'));try{await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify({version:1,files:[{path:'public/uploads/../../../escape',size:0,sha256:'a'.repeat(64)}]}));await assert.rejects(restore(root,path.join(os.tmpdir(),'nitido-unwanted-restore')),/Invalid manifest path/);}finally{await fs.rm(root,{recursive:true,force:true});}});

test('multi-chunk files survive restoration and invalid metadata is rejected',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nitido-stream-'));
 try{
 const source=path.join(root,'source'),archive=path.join(root,'backup'),destination=path.join(root,'restored');
 await fs.mkdir(path.join(source,'data'),{recursive:true});await fs.mkdir(path.join(source,'public/uploads'),{recursive:true});
 const db=new Database(path.join(source,'data/nitido.db'));db.exec('CREATE TABLE example(id INTEGER PRIMARY KEY)');db.close();
 const photo=Buffer.alloc(3*1024*1024+19,73);photo[photo.length-1]=42;
 await fs.writeFile(path.join(source,'public/uploads/large.bin'),photo);
 const manifest=await backup(source,archive,{quiesced:true});assert.equal(manifest.files.find(f=>f.path.endsWith('large.bin')).size,photo.length);
 await restore(archive,destination);assert.deepEqual(await fs.readFile(path.join(destination,'public/uploads/large.bin')),photo);
 const invalid=path.join(root,'invalid');await fs.mkdir(invalid);
 for(const entry of [null,{path:'data/nitido.db',size:-1,sha256:'a'.repeat(64)},{path:'data/nitido.db',size:1,sha256:'invalid'}]){
 await fs.writeFile(path.join(invalid,'manifest.json'),JSON.stringify({version:1,files:[entry]}));await assert.rejects(restore(invalid,path.join(root,'rejected')),/Invalid manifest path/);await assert.rejects(fs.stat(path.join(root,'rejected')),/ENOENT/);
 }
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
