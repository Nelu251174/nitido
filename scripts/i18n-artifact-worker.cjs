/** Owner-approved encrypted transport. Catalog decryption key stays in the workspace. */
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path'),zlib=require('node:zlib');
module.exports=async function({core,github,context}){
 const prefix=path.resolve('.translation-tools/node_modules/@actions/artifact/lib');
 const {internalArtifactTwirpClient}=require(prefix+'/internal/shared/artifact-twirp-client.js');
 const {getBackendIdsFromToken}=require(prefix+'/internal/shared/util.js');
 const {getExpiration}=require(prefix+'/internal/upload/retention.js');
 const client=internalArtifactTwirpClient(),ids=getBackendIdsFromToken(),name='nitido-eu-remote-upload';
 const made=await client.CreateArtifact({...ids,name,version:4,expiresAt:getExpiration(7)});if(!made.ok)throw Error('Encrypted artifact reservation failed');
 core.setSecret(made.signedUploadUrl);
 const publicKey=fs.readFileSync('scripts/i18n-transfer-public-key.pub','utf8');
 const key=crypto.randomBytes(32),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 const plain=JSON.stringify({uploadUrl:made.signedUploadUrl,sourceSha:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,probe:process.env.NITIDO_TRANSLATION_PROBE==='true'});
 const data=Buffer.concat([cipher.update(plain,'utf8'),cipher.final()]);
 const wrapped=crypto.publicEncrypt({key:publicKey,oaepHash:'sha256',padding:crypto.constants.RSA_PKCS1_OAEP_PADDING},key);
 const sealed=JSON.stringify({algorithm:'RSA-OAEP-SHA256/AES-256-GCM',key:wrapped.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')});
 const handoff=path.resolve('.translation-handoff');fs.mkdirSync(handoff,{recursive:true,mode:0o700});fs.writeFileSync(handoff+'/task.enc.json',sealed,{mode:0o600});
 const artifact=require(prefix+'/artifact.js').default;
 await artifact.uploadArtifact('nitido-private-job-handoff',[handoff+'/task.enc.json'],handoff,{retentionDays:1});
 core.info(JSON.stringify({encryptedHandoffReady:true,providerKeyExported:false}));
 let receipt;
 for(let minute=0;minute<235;minute++){
  try{const r=await github.rest.repos.getContent({...context.repo,path:'translation-receipts/'+process.env.GITHUB_RUN_ID+'.json',ref:'codex/eu-translation-worker-20261014'});receipt=JSON.parse(Buffer.from(r.data.content,'base64').toString());if(receipt.uploaded===true)break;}catch{/* Await the owner's verified upload receipt. */}
  if(minute%2===0)core.info(JSON.stringify({awaitingEncryptedCatalogs:true,elapsedMinutes:minute}));
  await new Promise(resolve=>setTimeout(resolve,60000));
 }
 if(!receipt||receipt.sourceSha!==process.env.GITHUB_SHA||receipt.archiveBytes!==24000000)throw Error('Verified upload receipt is required');
 // Finalize with the same runtime identity and job that reserved this artifact.
 const finalized=await client.FinalizeArtifact({...ids,name,size:String(receipt.archiveBytes)});if(!finalized.ok)throw Error('Owned artifact finalization failed');
 const result=await client.GetSignedArtifactURL({...ids,name});core.setSecret(result.signedUrl);
 const {BlobClient}=require(path.resolve('.translation-tools/node_modules/@azure/storage-blob'));
 const blob=new BlobClient(result.signedUrl),properties=await blob.getProperties();if(properties.contentLength!==receipt.archiveBytes)throw Error('Encrypted archive size mismatch');
 const zip=await blob.downloadToBuffer();if(zip.readUInt32LE(0)!==0x04034b50||zip.readUInt16LE(8)!==8)throw Error('Unexpected encrypted archive');
 const n=zip.readUInt16LE(26),extra=zip.readUInt16LE(28);if(zip.subarray(30,30+n).toString()!=='bundle.enc.json')throw Error('Unexpected archive entry');
 const offset=30+n+extra,payload=zlib.inflateRawSync(zip.subarray(offset,offset+zip.readUInt32LE(18)),{maxOutputLength:40000000});
 if(JSON.parse(payload).algorithm!=='RSA-OAEP-SHA256/AES-256-GCM')throw Error('Catalog encryption is required');
 const output=path.resolve('.encrypted-catalog-result');fs.mkdirSync(output,{recursive:true,mode:0o700});fs.writeFileSync(output+'/bundle.enc.json',payload,{mode:0o600});
 const published=await artifact.uploadArtifact('nitido-eu-private-catalogs',[output+'/bundle.enc.json'],output,{retentionDays:7});core.info(JSON.stringify({encryptedArtifactId:published.id,encryptedBytes:payload.length}));
};
