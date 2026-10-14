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
 const ids=getBackendIdsFromToken(),name='nitido-eu-remote-upload';
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
 const probe=process.env.NITIDO_TRANSLATION_PROBE==='true';
 // Ciphertext only: the operator private key stays outside this public repo,
 // outside Actions and outside the application host. No upload URL is exposed.
 const handoff=path.resolve('.translation-handoff');fs.mkdirSync(handoff,{recursive:true,mode:0o700});
 fs.writeFileSync(handoff+'/task.enc.json',seal(JSON.stringify({uploadUrl,sourceSha:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,probe})),{mode:0o600});
 const artifact=require(prefix+'/artifact.js').default;
 const transferred=await artifact.uploadArtifact('nitido-private-job-handoff',[handoff+'/task.enc.json'],handoff,{retentionDays:1});
 core.info(JSON.stringify({handoffArtifactId:transferred.id,probe}));
 core.info('NITIDO_ENCRYPTED_HANDOFF:'+fs.readFileSync(handoff+'/task.enc.json','utf8'));
 // Existing runner-local secret binding, already used by deploy.yml:18.
 // No managed-executor credential is copied or newly configured here.
 // The owner authorized encrypted link transport within this GitHub workflow.
 if(!process.env.COOLIFY_TOKEN)throw Error('Runner link-protection secret is not configured');
 const key=crypto.hkdfSync('sha256',Buffer.from(process.env.COOLIFY_TOKEN),Buffer.from('nitido-eu-link-transport'),Buffer.from(process.env.GITHUB_RUN_ID),32);
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 const data=Buffer.concat([cipher.update(uploadUrl,'utf8'),cipher.final()]);
 core.info('NITIDO_ENCRYPTED_COLLECTION_LINK:'+JSON.stringify({iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')}));
};
