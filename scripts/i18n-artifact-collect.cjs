/** Ciphertext collector. No OpenAI or catalog decryption key is available here. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
module.exports=async function({core,github,context}){
 const jobs=await github.rest.actions.listJobsForWorkflowRun({...context.repo,run_id:Number(process.env.GITHUB_RUN_ID)});
 const prepare=jobs.data.jobs.find(job=>job.name==='prepare'&&job.status==='completed');
 if(!prepare)throw Error('Completed handoff job is required');
 const response=await github.rest.actions.downloadJobLogsForWorkflowRun({...context.repo,job_id:prepare.id});
 const logs=typeof response.data==='string'?response.data:Buffer.from(response.data).toString();
 const line=logs.split('\n').find(line=>line.includes('NITIDO_ENCRYPTED_COLLECTION_LINK:'));
 if(!line)throw Error('Encrypted log handoff is missing');
 const encrypted=JSON.parse(line.split('NITIDO_ENCRYPTED_COLLECTION_LINK:')[1].trim());
 // Same existing runner secret as deploy.yml:18, with purpose-separated HKDF.
 const key=crypto.hkdfSync('sha256',Buffer.from(process.env.COOLIFY_TOKEN),Buffer.from('nitido-eu-link-transport'),Buffer.from(process.env.GITHUB_RUN_ID),32);
 const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(encrypted.iv,'base64'));decipher.setAuthTag(Buffer.from(encrypted.tag,'base64'));
 const url=Buffer.concat([decipher.update(Buffer.from(encrypted.data,'base64')),decipher.final()]).toString();core.setSecret(url);
 const {BlobClient}=require(path.resolve('.translation-tools/node_modules/@azure/storage-blob'));
 const blob=new BlobClient(url);let size;
 for(let minute=0;minute<235;minute++){
  try{const properties=await blob.getProperties();if(properties.contentLength>0){size=properties.contentLength;break;}}catch{/* The source-only remote task has not uploaded yet. */}
  if(minute%2===0)core.info(JSON.stringify({awaitingEncryptedCatalogs:true,elapsedMinutes:minute}));
  await new Promise(resolve=>setTimeout(resolve,60000));
 }
 if(!size||size>40000000)throw Error('Encrypted catalog upload is missing or oversized');
 const zip=await blob.downloadToBuffer();
 if(zip.readUInt32LE(0)!==0x04034b50||zip.readUInt16LE(8)!==8)throw Error('Unexpected encrypted archive');
 const filenameLength=zip.readUInt16LE(26),extraLength=zip.readUInt16LE(28);
 if(zip.subarray(30,30+filenameLength).toString()!=='bundle.enc.json')throw Error('Unexpected archive entry');
 const offset=30+filenameLength+extraLength;
 const data=zlib.inflateRawSync(zip.subarray(offset,offset+zip.readUInt32LE(18)),{maxOutputLength:40000000});
 const envelope=JSON.parse(data);if(envelope.algorithm!=='RSA-OAEP-SHA256/AES-256-GCM')throw Error('Catalog encryption is required');
 const root=path.resolve('.encrypted-catalog-result');fs.mkdirSync(root,{recursive:true,mode:0o700});fs.writeFileSync(root+'/bundle.enc.json',data,{mode:0o600});
 const artifact=require(path.resolve('.translation-tools/node_modules/@actions/artifact/lib/artifact.js')).default;
 const result=await artifact.uploadArtifact('nitido-eu-private-catalogs',[root+'/bundle.enc.json'],root,{retentionDays:7});
 core.info(JSON.stringify({encryptedArtifactId:result.id,encryptedBytes:data.length}));
};
