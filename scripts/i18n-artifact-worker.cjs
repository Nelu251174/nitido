/** Owner-authorized private catalog job. Run only inside GitHub Actions.
 * Prepares a private handoff for the managed operator, without exporting the host's
 * OpenAI credential. Only a temporary, artifact-specific upload URL reaches the
 * host. Every handoff and result is encrypted to an operator-only private key
 * before any artifact upload. The resulting ZIP contains ciphertext, never a public
 * website upload. No application database or customer records are read.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
module.exports=async function({core}){
 const prefix=path.resolve('.translation-tools/node_modules/@actions/artifact/lib');
 const {internalArtifactTwirpClient}=require(prefix+'/internal/shared/artifact-twirp-client.js');
 const {getBackendIdsFromToken}=require(prefix+'/internal/shared/util.js');
 const {getExpiration}=require(prefix+'/internal/upload/retention.js');
 const {BlobClient}=require(path.resolve('.translation-tools/node_modules/@azure/storage-blob'));
 const client=internalArtifactTwirpClient();
 const ids=getBackendIdsFromToken(),name='nitido-eu-private-catalogs';
 const made=await client.CreateArtifact({...ids,name,version:4,expiresAt:getExpiration(7)});
 if(!made.ok)throw Error('Private artifact could not be created');
 const uploadUrl=made.signedUploadUrl;
 core.setSecret(uploadUrl);
 const publicKey=fs.readFileSync('scripts/i18n-transfer-public-key.pub','utf8');
 function seal(plaintext){
  const key=crypto.randomBytes(32),iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const ciphertext=Buffer.concat([cipher.update(plaintext,'utf8'),cipher.final()]);
  const wrapped=crypto.publicEncrypt({key:publicKey,oaepHash:'sha256',padding:crypto.constants.RSA_PKCS1_OAEP_PADDING},key);
  return JSON.stringify({algorithm:'RSA-OAEP-SHA256/AES-256-GCM',key:wrapped.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:ciphertext.toString('base64')});
 }
 const source=fs.readFileSync('messages/ro.json','utf8');
 const generator=fs.readFileSync('scripts/i18n-translate.mjs','utf8');
 const probe=process.env.NITIDO_TRANSLATION_PROBE==='true';
 const sourceHash=crypto.createHash('sha256').update(source).digest('hex');
 const generatorHash=crypto.createHash('sha256').update(generator).digest('hex');
 const base=`https://raw.githubusercontent.com/Nelu251174/nitido/${process.env.GITHUB_SHA}`;
 const bootstrap=`(async()=>{
 const fs=require('node:fs'),crypto=require('node:crypto'),zlib=require('node:zlib'),{spawn}=require('node:child_process');
 const root='/app/data/nitido-eu-localization-20261014';
 fs.mkdirSync(root,{recursive:true,mode:0o700});fs.chmodSync(root,0o700);
 const sources=${JSON.stringify([{url:base+'/messages/ro.json',file:'source.json',hash:sourceHash},{url:base+'/scripts/i18n-translate.mjs',file:'generator.mjs',hash:generatorHash}])};
 for(const item of sources){const res=await fetch(item.url);if(!res.ok)throw Error('Pinned source download failed');const bytes=Buffer.from(await res.arrayBuffer());if(crypto.createHash('sha256').update(bytes).digest('hex')!==item.hash)throw Error('Pinned source hash mismatch');fs.writeFileSync(root+'/'+item.file,bytes,{mode:0o600});}
 const status={probe:${probe},complete:false,exitCode:null};
 if(!status.probe){status.exitCode=await new Promise(resolve=>{const child=spawn(process.execPath,[root+'/generator.mjs'],{env:{...process.env,NITIDO_TRANSLATION_SOURCE:root+'/source.json',NITIDO_TRANSLATION_OUTPUT:root+'/catalogs',NITIDO_TRANSLATION_MAX_USD:'20'},stdio:'ignore'});child.on('exit',code=>resolve(code));child.on('error',()=>resolve(1));});}
 const bundle={status,sourceSha:${JSON.stringify(process.env.GITHUB_SHA)},sourceHash:${JSON.stringify(sourceHash)},files:{}};
 if(!status.probe&&fs.existsSync(root+'/catalogs'))for(const file of fs.readdirSync(root+'/catalogs'))if(/^(?:bg|hr|cs|da|nl|en|et|fi|fr|de|el|hu|ga|it|lv|lt|mt|pl|pt|sk|sl|es|sv|manifest|translation-progress)\\.json$/.test(file))bundle.files[file]=JSON.parse(fs.readFileSync(root+'/catalogs/'+file,'utf8'));
 status.complete=bundle.files['manifest.json']?.complete===true;
 const publicKey=${JSON.stringify(publicKey)};
 ${seal.toString()}
 const body=Buffer.from(seal(JSON.stringify(bundle))),compressed=zlib.deflateRawSync(body),filename=Buffer.from('bundle.enc.json');
 let crc=0xffffffff;for(const byte of body){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(body.length,22);local.writeUInt16LE(filename.length,26);
 const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(body.length,24);central.writeUInt16LE(filename.length,28);
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+filename.length,12);end.writeUInt32LE(local.length+filename.length+compressed.length,16);
 const zip=Buffer.concat([local,filename,compressed,central,filename,end]);fs.writeFileSync(root+'/catalogs-private.zip',zip,{mode:0o600});
 const uploaded=await fetch(${JSON.stringify(uploadUrl)},{method:'PUT',headers:{'x-ms-blob-type':'BlockBlob','Content-Type':'application/zip'},body:zip});if(!uploaded.ok)throw Error('Private artifact upload failed');
 })().catch(()=>{process.exitCode=1;});`;
 const encoded=Buffer.from(bootstrap).toString('base64');
 const command=`node -e 'eval(Buffer.from("${encoded}","base64").toString())'`;
 core.setSecret(encoded);core.setSecret(command);
 // Ciphertext only: the operator private key stays outside this public repo,
 // outside Actions and outside the application host. No upload URL is exposed.
 const handoff=path.resolve('.translation-handoff');fs.mkdirSync(handoff,{recursive:true,mode:0o700});
 fs.writeFileSync(handoff+'/task.enc.json',seal(JSON.stringify({name:`Owner-approved private EU catalog job ${process.env.GITHUB_RUN_ID}`,command,frequency:'0 0 * * *',enabled:false,container:null,timeout:14400})),{mode:0o600});
 const artifact=require(prefix+'/artifact.js').default;
 const transferred=await artifact.uploadArtifact('nitido-private-job-handoff',[handoff+'/task.enc.json'],handoff,{retentionDays:1});
 core.info(JSON.stringify({handoffArtifactId:transferred.id,probe}));
 const blob=new BlobClient(uploadUrl);let size;
 for(let attempt=0;attempt<235;attempt++){
  try{const props=await blob.getProperties();if(props.contentLength>0){size=props.contentLength;break;}}catch{/* Not uploaded yet. */}
  if(attempt%2===0)core.info(JSON.stringify({waitingForPrivateCatalogs:true,elapsedMinutes:attempt}));
  await new Promise(resolve=>setTimeout(resolve,60000));
 }
 if(!size)throw Error('Private catalog artifact timeout');
 const result=await client.FinalizeArtifact({...ids,name,size:String(size)});
 if(!result.ok)throw Error('Private artifact finalization failed');
 core.info(JSON.stringify({artifactId:result.artifactId,bytes:size,probe}));
};
