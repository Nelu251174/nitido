import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import Database from 'better-sqlite3';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function regular(file){const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Only regular files are accepted');return fs.readFile(file);}
async function checkDb(file){const db=new Database(file,{readonly:true,fileMustExist:true});try{if(db.pragma('integrity_check',{simple:true})!=='ok'||db.pragma('foreign_key_check').length)throw new Error('Database integrity check failed');}finally{db.close();}}
async function files(root,prefix=''){const result=[];for(const entry of await fs.readdir(path.join(root,prefix),{withFileTypes:true})){const relative=path.posix.join(prefix,entry.name);if(entry.isSymbolicLink())throw new Error('Symbolic links are not accepted');if(entry.isDirectory())result.push(...await files(root,relative));else if(entry.isFile())result.push(relative);else throw new Error('Special files are not accepted');}return result.sort();}
function separate(a,b){const relative=path.relative(a,b);if(!relative||(!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative)))throw new Error('Destination must be outside source');}
// Stop all application writers before backup; SQLite alone cannot freeze photo uploads.
export async function backup(source,destination,{quiesced=false}={}){
 if(!quiesced)throw new Error('Stop application writers and confirm quiesced mode before backup');
 source=await fs.realpath(source);destination=path.resolve(destination);const parent=await fs.realpath(path.dirname(destination));destination=path.join(parent,path.basename(destination));separate(source,destination);
 const sourceDb=path.join(source,'data/nitido.db');await regular(sourceDb);
 const uploads=path.join(source,'public/uploads');if((await fs.lstat(uploads)).isSymbolicLink())throw new Error('Uploads directory cannot be a link');
 await fs.mkdir(destination,{mode:0o700});
 try{
  await fs.mkdir(path.join(destination,'data'));await fs.mkdir(path.join(destination,'public/uploads'),{recursive:true});
  const db=new Database(sourceDb,{readonly:true,fileMustExist:true});try{await db.backup(path.join(destination,'data/nitido.db'));}finally{db.close();}
  for(const name of await files(uploads)){const target=path.join(destination,'public/uploads',name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,await regular(path.join(uploads,name)),{flag:'wx',mode:0o600});}
  const snapshot=new Database(path.join(destination,'data/nitido.db'));try{snapshot.pragma('journal_mode = DELETE');}finally{snapshot.close();}
  await checkDb(path.join(destination,'data/nitido.db'));
  const manifest={version:1,createdAt:new Date().toISOString(),files:[]};
  for(const name of await files(destination)){const bytes=await regular(path.join(destination,name));manifest.files.push({path:name,size:bytes.length,sha256:digest(bytes)});}
  await fs.writeFile(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx',mode:0o600});return manifest;
 }catch(error){await fs.rm(destination,{recursive:true,force:true});throw error;}
}
export async function restore(source,destination){
 source=await fs.realpath(source);destination=path.resolve(destination);const parent=await fs.realpath(path.dirname(destination));destination=path.join(parent,path.basename(destination));separate(source,destination);
 const manifest=JSON.parse(await regular(path.join(source,'manifest.json')));
 if(manifest.version!==1||!Array.isArray(manifest.files)||!manifest.files.length)throw new Error('Invalid manifest');
 const seen=new Set();
 for(const entry of manifest.files){if(typeof entry.path!=='string'||entry.path.includes('\\')||entry.path.split('/').some(s=>!s||s==='.'||s==='..')||!(entry.path==='data/nitido.db'||entry.path.startsWith('public/uploads/'))||seen.has(entry.path))throw new Error('Invalid manifest path');seen.add(entry.path);}
 if(!seen.has('data/nitido.db'))throw new Error('Database is missing');
 const actual=(await files(source)).filter(name=>name!=='manifest.json');if(actual.length!==seen.size||actual.some(name=>!seen.has(name)))throw new Error('Unexpected or missing backup files');
 // Exclusive destination: restore never overwrites a running installation.
 await fs.mkdir(destination,{mode:0o700});
 try{
  await fs.mkdir(path.join(destination,'public/uploads'),{recursive:true});
  for(const entry of manifest.files){const bytes=await regular(path.join(source,entry.path));if(bytes.length!==entry.size||digest(bytes)!==entry.sha256)throw new Error('Backup checksum mismatch');const target=path.join(destination,entry.path);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes,{flag:'wx',mode:0o600});}
  await checkDb(path.join(destination,'data/nitido.db'));return {files:seen.size};
 }catch(error){await fs.rm(destination,{recursive:true,force:true});throw error;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [action,source,destination,...flags]=process.argv.slice(2);try{if(!source||!destination||!['backup','restore'].includes(action))throw new Error('Usage: recovery.mjs backup|restore SOURCE DESTINATION [--quiesced]');const result=action==='backup'?await backup(source,destination,{quiesced:flags.includes('--quiesced')}):await restore(source,destination);console.log(JSON.stringify({ok:true,files:Array.isArray(result.files)?result.files.length:result.files}));}catch(error){console.error(error.message);process.exitCode=1;}}
