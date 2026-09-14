import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {provisionAdminMfa} from './admin-mfa-provision.mjs';
test('writes strong factors to a new private file and returns no credentials',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nitido-enrollment-'));try{
   const path=join(dir,'enrollment.json');assert.deepEqual(await provisionAdminMfa(path,'admin@example.com'),{created:true});
   const data=JSON.parse(await readFile(path,'utf8'));assert.match(data.totpSecret,/^[A-Z2-7]{32}$/);assert.equal((await stat(path)).mode&0o777,0o600);assert.equal(data.recoveryCodes.length,8);assert.equal(new Set(data.recoveryCodes).size,8);
   for(const code of data.recoveryCodes)assert.match(code,/^[a-f0-9]{32}$/);
   assert.equal(data.environment.NITIDO_ADMIN_RECOVERY_HASHES,data.recoveryCodes.map(code=>createHash('sha256').update(code).digest('hex')).join(','));
   const uri=new URL(data.otpauthUri);assert.equal(uri.protocol,'otpauth:');assert.equal(uri.searchParams.get('secret'),data.totpSecret);assert.equal(uri.searchParams.get('digits'),'6');assert.equal(uri.searchParams.get('period'),'30');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('never overwrites an existing enrollment file or follows its symlink',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nitido-enrollment-'));try{
   const path=join(dir,'existing.json');await writeFile(path,'original');await assert.rejects(provisionAdminMfa(path,'admin@example.com'));assert.equal(await readFile(path,'utf8'),'original');
   const link=join(dir,'link.json');await symlink(path,link);await assert.rejects(provisionAdminMfa(link,'admin@example.com'));assert.equal(await readFile(path,'utf8'),'original');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('rejects destinations in the checkout, including a symlinked directory',async()=>{
 await assert.rejects(provisionAdminMfa(resolve('must-not-be-created.json'),'admin@example.com'));
 const dir=await mkdtemp(join(tmpdir(),'nitido-enrollment-'));try{const link=join(dir,'repo');await symlink(resolve('.'),link);await assert.rejects(provisionAdminMfa(join(link,'must-not-be-created.json'),'admin@example.com'));}finally{await rm(dir,{recursive:true,force:true});}
});
test('rejects invalid email and relative destination before creating a file',async()=>{
 await assert.rejects(provisionAdminMfa('relative.json','admin@example.com'));
 await assert.rejects(provisionAdminMfa('/tmp/not-created.json','invalid'));
});
