/** Owner-approved source-only translator. Launched inside the existing app container.
 * Input is pinned repository UI copy; output stays private until encrypted upload.
 */
(async()=>{
 const fs=require('node:fs'),crypto=require('node:crypto'),zlib=require('node:zlib'),{spawn}=require('node:child_process');
 const [base,runId,countText,mode]=process.argv.slice(1);
 if(!/^https:\/\/raw\.githubusercontent\.com\/Nelu251174\/nitido\/[0-9a-f]{40}$/.test(base)||!/^\d+$/.test(runId)||!/^\d+$/.test(countText)||Number(countText)>50)throw Error('Invalid pinned launch');
 const root='/app/data/nitido-eu-localization-20261014',prefix='/app/data/eu-'+runId;
 fs.mkdirSync(root,{recursive:true,mode:0o700});fs.chmodSync(root,0o700);
 let encoded='';for(let i=0;i<Number(countText);i++)encoded+=fs.readFileSync(prefix+'-'+i,'utf8');
 const uploadUrl=Buffer.from(encoded,'base64').toString();
 const destination=new URL(uploadUrl);if(destination.protocol!=='https:'||!destination.hostname.endsWith('.blob.core.windows.net'))throw Error('Unexpected artifact destination');
 async function pinned(file){const r=await fetch(base+'/'+file);if(!r.ok)throw Error('Pinned source download HTTP '+r.status);return r.text();}
 const publicKey=await pinned('scripts/i18n-transfer-public-key.pub');
 const status={probe:mode==='probe',complete:false,exitCode:null,providerConfigured:Boolean(process.env.OPENAI_API_KEY?.trim()),runtime:process.version};
 const bundle={status,sourceSha:base.split('/').at(-1),files:{}};
 try{
  const [source,generator,manifest]=await Promise.all([pinned('messages/ro.json'),pinned('scripts/i18n-translate.mjs'),pinned('messages/manifest.json')]);
  const copy=JSON.parse(source);bundle.sourceHash=crypto.createHash('sha256').update(JSON.stringify(copy)).digest('hex');
  if(bundle.sourceHash!==JSON.parse(manifest).sourceHash)throw Error('Pinned UI source hash mismatch');
  fs.writeFileSync(root+'/source.json',source,{mode:0o600});fs.writeFileSync(root+'/generator.mjs',generator,{mode:0o600});
  if(!status.probe){
   if(!status.providerConfigured)throw Error('Translation provider is not configured');
   status.exitCode=await new Promise(resolve=>{const child=spawn(process.execPath,[root+'/generator.mjs'],{env:{...process.env,NITIDO_TRANSLATION_SOURCE:root+'/source.json',NITIDO_TRANSLATION_OUTPUT:root+'/catalogs',NITIDO_TRANSLATION_MAX_USD:'20'},stdio:'ignore'});child.on('exit',resolve);child.on('error',()=>resolve(1));});
   if(fs.existsSync(root+'/catalogs'))for(const file of fs.readdirSync(root+'/catalogs'))if(/^(?:bg|hr|cs|da|nl|en|et|fi|fr|de|el|hu|ga|it|lv|lt|mt|pl|pt|sk|sl|es|sv|manifest|translation-progress)\.json$/.test(file))bundle.files[file]=JSON.parse(fs.readFileSync(root+'/catalogs/'+file,'utf8'));
   status.complete=bundle.files['manifest.json']?.complete===true;
  }
 }catch(error){status.failure=error instanceof Error?error.message:'Source-only task failed';status.exitCode=1;}
 const key=crypto.randomBytes(32),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 const ciphertext=Buffer.concat([cipher.update(JSON.stringify(bundle),'utf8'),cipher.final()]);
 const wrapped=crypto.publicEncrypt({key:publicKey,oaepHash:'sha256',padding:crypto.constants.RSA_PKCS1_OAEP_PADDING},key);
 const body=Buffer.from(JSON.stringify({algorithm:'RSA-OAEP-SHA256/AES-256-GCM',key:wrapped.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:ciphertext.toString('base64')}));
 const compressed=zlib.deflateRawSync(body),filename=Buffer.from('bundle.enc.json');
 let crc=0xffffffff;for(const byte of body){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(body.length,22);local.writeUInt16LE(filename.length,26);
 const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(body.length,24);central.writeUInt16LE(filename.length,28);
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+filename.length,12);end.writeUInt32LE(local.length+filename.length+compressed.length,16);
 const zip=Buffer.concat([local,filename,compressed,central,filename,end]);fs.writeFileSync(root+'/catalogs-private.zip',zip,{mode:0o600});
 const uploaded=await fetch(uploadUrl,{method:'PUT',headers:{'x-ms-blob-type':'BlockBlob','Content-Type':'application/zip'},body:zip});if(!uploaded.ok)throw Error('Encrypted artifact upload failed');
 for(let i=0;i<Number(countText);i++)fs.unlinkSync(prefix+'-'+i);
})().catch(()=>{process.exitCode=1;});
