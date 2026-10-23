import {createPrivateKey,createPublicKey,createHash,sign,verify} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {sealFirebaseConfiguration} from './firebase-credential-transfer.mjs';

// Public metadata confirmed in the owner's Apple Developer screenshot.
export const APNS_IDENTITY=Object.freeze({keyId:'B45XK32J88',teamId:'LQ6L9MJ24T',bundleId:'ro.nitido.app',useSandbox:false});

export function validateApnsKey(raw,expectedTeam){
  if(expectedTeam!==APNS_IDENTITY.teamId)throw Error('APNS_APPLE_TEAM_MISMATCH');
  if(typeof raw!=='string'||!raw.trim())throw Error('APNS_PRIVATE_KEY_MISSING');
  const pem=raw.replace(/\\n/g,'\n').replace(/\r\n/g,'\n').trim()+'\n';
  if(!/^-----BEGIN PRIVATE KEY-----\n[A-Za-z0-9+/=\n]+\n-----END PRIVATE KEY-----\n$/.test(pem))throw Error('APNS_PRIVATE_KEY_INVALID_PEM');
  let key;
  try{key=createPrivateKey(pem)}catch{throw Error('APNS_PRIVATE_KEY_INVALID_PEM')}
  if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw Error('APNS_PRIVATE_KEY_REQUIRES_P256');
  const now=Math.floor(Date.now()/1000),b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const input=Buffer.from(b64({alg:'ES256',kid:APNS_IDENTITY.keyId})+'.'+b64({iss:APNS_IDENTITY.teamId,iat:now}));
  const signature=sign('sha256',input,{key,dsaEncoding:'ieee-p1363'});
  const publicKey=createPublicKey(key);
  if(signature.length!==64||!verify('sha256',input,{key:publicKey,dsaEncoding:'ieee-p1363'},signature))throw Error('APNS_SIGNATURE_SELF_CHECK_FAILED');
  const publicKeySha256=createHash('sha256').update(publicKey.export({format:'der',type:'spki'})).digest('hex');
  return {privateKey:pem,publicKeySha256};
}

export function sealApnsConfiguration(configuration,recipient){
  return {...sealFirebaseConfiguration(configuration,recipient),format:'NITIDO_APNS_TRANSFER_V1'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const status={...APNS_IDENTITY,notificationSent:false,appleAuthenticationVerified:false,deviceReceptionTested:false};
  try{
    const key=validateApnsKey(process.env.APNS_PRIVATE_KEY,process.env.APPLE_TEAM_ID);
    const recipient=await readFile('scripts/apns-transfer-recipient.pem','utf8');
    const payload={kind:'NITIDO_APNS_RUNTIME_CONFIGURATION_V1',...APNS_IDENTITY,...key,createdAt:new Date().toISOString()};
    await writeFile('apns-configuration.encrypted.json',JSON.stringify(sealApnsConfiguration(payload,recipient)),{mode:0o600});
    Object.assign(status,{status:'key_format_and_signature_verified',publicKeySha256:key.publicKeySha256,privateKeySavedInGithub:true});
  }catch(error){status.status='blocked';status.reason=/^APNS_[A-Z0-9_]+$/.test(error.message)?error.message:'APNS_CONFIGURATION_VALIDATION_FAILED';process.exitCode=1}
  await writeFile('apns-transfer-status.json',JSON.stringify(status,null,2));
  console.log(JSON.stringify(status));
}
