import {randomBytes,createHash} from 'node:crypto';
import {writeFile,realpath} from 'node:fs/promises';
import {dirname,basename,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function base32(bytes){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let acc=0,bits=0,text='';
 for(const byte of bytes){acc=(acc<<8)|byte;bits+=8;while(bits>=5){bits-=5;text+=alphabet[(acc>>>bits)&31];}acc&=(1<<bits)-1;}
 if(bits)text+=alphabet[(acc<<(5-bits))&31];return text;
}
/** Offline provisioning only. Secrets go to a new owner-readable file outside the checkout. */
export async function provisionAdminMfa(output,email){
 if(!isAbsolute(output)||typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email))throw Error('Cale absolută și email admin valid necesare.');
 const directory=await realpath(dirname(output)),root=await realpath(repoRoot),relativePath=relative(root,directory);
 if(relativePath===''||(!relativePath.startsWith('..'+(process.platform==='win32'?'\\':'/'))&&!isAbsolute(relativePath)&&relativePath!=='..'))throw Error('Fișierul de înrolare trebuie creat în afara repository-ului.');
 const secret=base32(randomBytes(20)),codes=Array.from({length:8},()=>randomBytes(16).toString('hex'));
 const recoveryHashes=codes.map(code=>createHash('sha256').update(code).digest('hex'));
 const issuer='NITIDO Admin',label=`${issuer}:${email.trim().toLowerCase()}`;
 const data={issuer,email:email.trim().toLowerCase(),totpSecret:secret,otpauthUri:`otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`,recoveryCodes:codes,environment:{NITIDO_ADMIN_TOTP_SECRET:secret,NITIDO_ADMIN_RECOVERY_HASHES:recoveryHashes.join(',')}};
 await writeFile(resolve(directory,basename(output)),JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});
 return {created:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.argv.length!==4)throw Error('Argumente invalide');await provisionAdminMfa(process.argv[2],process.argv[3]);console.log('Fișierul de înrolare a fost creat cu acces restricționat. Nicio valoare secretă nu a fost afișată.');}
 catch{console.error('Înrolarea nu a fost creată. Verifică argumentele, calea externă și existența fișierului; un fișier existent nu este suprascris.');process.exitCode=1;}
}
