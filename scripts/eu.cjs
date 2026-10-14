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
  // Extend a completed/stopped source-only checkpoint without resetting spending.
  const progressFile=root+'/catalogs/translation-progress.json';
  if(!status.probe&&fs.existsSync(progressFile)){
   const lockFile=root+'/catalogs/.translation.lock';
   if(fs.existsSync(lockFile)){const pid=Number(fs.readFileSync(lockFile,'utf8'));let active=false;try{process.kill(pid,0);active=true;}catch(error){if(error.code!=='ESRCH')throw error;}if(active)throw Error('A source-only generator is still active');fs.unlinkSync(lockFile);}
   const progress=JSON.parse(fs.readFileSync(progressFile,'utf8'));
   const previous=JSON.parse(fs.readFileSync(root+'/source.json','utf8'));
   if(!progress.historical429Credit){
    // These recorded HTTP 429 requests were rejected before model processing.
    // Every historical payload used 12000 output tokens and at least 1321 wire
    // bytes (fixed prompt/schema envelope; shortest locale name). Credit only
    // this proven minimum; preserve all processed usage and uncertain reserves.
    const count=(progress.failures??[]).filter(item=>item.message==='Translation provider HTTP 429').length;
    const minimum=(1321+8192)*0.75/1000000+12000*4.5/1000000;
    const credit=count*minimum,processed=progress.inputTokens*0.75/1000000+progress.outputTokens*4.5/1000000;
    if(progress.model!=='gpt-5.4-mini'||count>progress.requests||progress.chargedUpperUsd-credit<processed-0.000001)throw Error('Declined-request reservation evidence is inconsistent');
    progress.chargedUpperUsd-=credit;
    progress.historical429Credit={count,minimumReservedUsd:minimum,creditUsd:credit,evidenceSourceSha:'7da9ecdbc5c68a28355cf5094284841f6035ebfb'};
   }
   if(progress.sourceHash!==bundle.sourceHash){
    const previousHash=crypto.createHash('sha256').update(JSON.stringify(previous)).digest('hex');
    if(previousHash!==progress.sourceHash||Object.entries(previous).some(([id,text])=>copy[id]!==text))throw Error('Only an additive UI source extension can resume this budget');
    progress.sourceHash=bundle.sourceHash;progress.completed=[];
   }
   if(progress.currencyWordBoundaryRevision!==2){
    // Earlier case-insensitive shielding also matched letters inside words.
    const repair=Object.entries(previous).filter(([,text])=>/\B(?:RON|EUR)|(?:RON|EUR)\B/i.test(text)).map(([id])=>id);
    for(const locale of ['bg','hr','cs','da','nl','en','et','fi','fr','de','el','hu','ga','it','lv','lt','mt','pl','pt','sk','sl','es','sv']){
     const file=root+'/catalogs/'+locale+'.json';if(!fs.existsSync(file))continue;
     const catalog=JSON.parse(fs.readFileSync(file,'utf8'));for(const id of repair)delete catalog[id];
     fs.writeFileSync(file+'.tmp',JSON.stringify(catalog,null,2)+'\n',{mode:0o600});fs.renameSync(file+'.tmp',file);
    }
    progress.currencyWordBoundaryRevision=2;progress.completed=[];
   }
   fs.writeFileSync(progressFile+'.tmp',JSON.stringify(progress,null,2)+'\n',{mode:0o600});fs.renameSync(progressFile+'.tmp',progressFile);
  }
  fs.writeFileSync(root+'/source.json',source,{mode:0o600});fs.writeFileSync(root+'/generator.mjs',generator,{mode:0o600});
  if(!status.probe){
   if(!status.providerConfigured)throw Error('Translation provider is not configured');
   status.exitCode=await new Promise(resolve=>{const child=spawn(process.execPath,[root+'/generator.mjs'],{env:{...process.env,NITIDO_TRANSLATION_SOURCE:root+'/source.json',NITIDO_TRANSLATION_OUTPUT:root+'/catalogs',NITIDO_TRANSLATION_MAX_USD:'20',NITIDO_TRANSLATION_CONCURRENCY:'1',NITIDO_TRANSLATION_MAX_REQUESTS:'1339'},stdio:'ignore'});child.on('exit',resolve);child.on('error',()=>resolve(1));});
   if(fs.existsSync(root+'/catalogs'))for(const file of fs.readdirSync(root+'/catalogs'))if(/^(?:bg|hr|cs|da|nl|en|et|fi|fr|de|el|hu|ga|it|lv|lt|mt|pl|pt|sk|sl|es|sv|manifest|translation-progress)\.json$/.test(file))bundle.files[file]=JSON.parse(fs.readFileSync(root+'/catalogs/'+file,'utf8'));
   status.complete=bundle.files['manifest.json']?.complete===true;
  }
 }catch(error){status.failure=error instanceof Error?error.message:'Source-only task failed';status.exitCode=1;}
 const key=crypto.randomBytes(32),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 const ciphertext=Buffer.concat([cipher.update(JSON.stringify(bundle),'utf8'),cipher.final()]);
 const wrapped=crypto.publicEncrypt({key:publicKey,oaepHash:'sha256',padding:crypto.constants.RSA_PKCS1_OAEP_PADDING},key);
 const body=Buffer.from(JSON.stringify({algorithm:'RSA-OAEP-SHA256/AES-256-GCM',key:wrapped.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:ciphertext.toString('base64')}));
 const compressed=zlib.deflateRawSync(body),filename=Buffer.from('bundle.enc.json'),paddingName=Buffer.from('padding.bin');
 // Exact-sized transport lets the receiver finalize with accurate metadata.
 // Both payload and padding contain no plaintext UI or credentials.
 const ARCHIVE_BYTES=24000000,overhead=30+filename.length+30+paddingName.length+46+filename.length+46+paddingName.length+22;
 const paddingLength=ARCHIVE_BYTES-overhead-compressed.length;
 if(paddingLength<0)throw Error('Encrypted payload exceeds transport limit');
 const padding=Buffer.alloc(paddingLength),table=Array.from({length:256},(_,i)=>{let n=i;for(let bit=0;bit<8;bit++)n=(n>>>1)^((n&1)?0xedb88320:0);return n>>>0;});
 const crc32=data=>{let n=0xffffffff;for(const byte of data)n=table[(n^byte)&255]^(n>>>8);return (n^0xffffffff)>>>0;};
 function local(name,method,crc,size,original){const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(method,8);h.writeUInt32LE(crc,14);h.writeUInt32LE(size,18);h.writeUInt32LE(original,22);h.writeUInt16LE(name.length,26);return h;}
 function central(name,method,crc,size,original,offset){const h=Buffer.alloc(46);h.writeUInt32LE(0x02014b50);h.writeUInt16LE(20,4);h.writeUInt16LE(20,6);h.writeUInt16LE(method,10);h.writeUInt32LE(crc,16);h.writeUInt32LE(size,20);h.writeUInt32LE(original,24);h.writeUInt16LE(name.length,28);h.writeUInt32LE(offset,42);return h;}
 const crc=crc32(body),padCrc=crc32(padding),first=local(filename,8,crc,compressed.length,body.length),second=local(paddingName,0,padCrc,padding.length,padding.length);
 const secondOffset=first.length+filename.length+compressed.length;
 const dir=[central(filename,8,crc,compressed.length,body.length,0),filename,central(paddingName,0,padCrc,padding.length,padding.length,secondOffset),paddingName];
 const dirSize=dir.reduce((n,b)=>n+b.length,0),dirOffset=secondOffset+second.length+paddingName.length+padding.length;
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(2,8);end.writeUInt16LE(2,10);end.writeUInt32LE(dirSize,12);end.writeUInt32LE(dirOffset,16);
 const zip=Buffer.concat([first,filename,compressed,second,paddingName,padding,...dir,end]);if(zip.length!==ARCHIVE_BYTES)throw Error('Incorrect encrypted transport size');fs.writeFileSync(root+'/catalogs-private.zip',zip,{mode:0o600});
 const uploaded=await fetch(uploadUrl,{method:'PUT',headers:{'x-ms-blob-type':'BlockBlob','Content-Type':'application/zip'},body:zip});if(!uploaded.ok)throw Error('Encrypted artifact upload failed');
 for(let i=0;i<Number(countText);i++)fs.unlinkSync(prefix+'-'+i);
})().catch(()=>{process.exitCode=1;});
