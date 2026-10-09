import Database from 'better-sqlite3';
import {mkdir,copyFile,writeFile,chmod} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {constants,createReadStream} from 'node:fs';

function inspect(file){
 const db=new Database(file,{readonly:true,fileMustExist:true});
 try{
  const integrity=db.pragma('integrity_check');
  if(integrity.length!==1||integrity[0].integrity_check!=='ok')throw Error('SQLite integrity check failed.');
  if(db.pragma('foreign_key_check').length)throw Error('SQLite foreign key check failed.');
  const schema=db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type,name").all();
  const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const counts=Object.fromEntries(tables.map(({name})=>[name,db.prepare('SELECT COUNT(*) FROM "'+name.replaceAll('"','""')+'"').pluck().get()]));
  return {schemaSha256:createHash('sha256').update(JSON.stringify(schema)).digest('hex'),counts};
 }finally{db.close();}
}
const sha256=async file=>{const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');};

/** Non-destructive drill: source is read-only; destination must not exist. Includes committed WAL data. */
export async function verifyDatabaseBackup(sourcePath,outputPath){
 if(!sourcePath||!outputPath)throw Error('Provide a source SQLite file and a NEW output directory.');
 const source=resolve(sourcePath),output=resolve(outputPath);
 const db=new Database(source,{readonly:true,fileMustExist:true});
 try{
  // Exclusive mkdir prevents overwriting any earlier backup or drill evidence.
  await mkdir(output,{mode:0o700});
  const snapshot=join(output,'snapshot.db'),restored=join(output,'restored.db');
  await db.backup(snapshot);
  await chmod(snapshot,0o600);
  const before=inspect(snapshot);
  await copyFile(snapshot,restored,constants.COPYFILE_EXCL);
  await chmod(restored,0o600);
  const after=inspect(restored);
  const snapshotSha256=await sha256(snapshot),restoredSha256=await sha256(restored);
  if(JSON.stringify(before)!==JSON.stringify(after)||snapshotSha256!==restoredSha256)throw Error('Restored database differs from snapshot.');
  const report={status:'passed',createdAt:new Date().toISOString(),method:'SQLite online backup API; isolated restore',scope:'SQLite database only; excludes uploads, secrets, external services and application smoke tests',...after,snapshotSha256,restoredSha256};
  await writeFile(join(output,'verification.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  return report;
 }finally{db.close();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 verifyDatabaseBackup(process.argv[2],process.argv[3]).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('Backup verification FAILED:',e.message);process.exitCode=1;});
}
