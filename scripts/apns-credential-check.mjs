import {createPrivateKey,createPublicKey,sign,verify} from 'node:crypto';
import {pathToFileURL} from 'node:url';

// Public metadata confirmed in the owner's Apple Developer screenshot.
export const APNS_IDENTITY=Object.freeze({keyId:'B45XK32J88',teamId:'LQ6L9MJ24T',bundleId:'ro.nitido.app',useSandbox:false});

export function apnsInputShape(raw){
  const text=typeof raw==='string'?raw:'';
  return {hasPkcs8Begin:text.includes('-----BEGIN PRIVATE KEY-----'),hasPkcs8End:text.includes('-----END PRIVATE KEY-----'),hasActualNewlines:/[\r\n]/.test(text),hasLiteralNewlines:/\\[rn]/.test(text),looksLikeJson:/^\s*["{]/.test(text),hasOtherPemType:/-----BEGIN (?:RSA |EC |ENCRYPTED |PUBLIC |CERTIFICATE)/.test(text)};
}

export function validateApnsKey(raw,expectedTeam){
  if(expectedTeam!==APNS_IDENTITY.teamId)throw Error('APNS_APPLE_TEAM_MISMATCH');
  if(typeof raw!=='string'||!raw.trim())throw Error('APNS_PRIVATE_KEY_MISSING');
  let text=raw.trim();
  if(text.startsWith('"')){try{const decoded=JSON.parse(text);if(typeof decoded==='string')text=decoded}catch{throw Error('APNS_PRIVATE_KEY_INVALID_PEM')}}
  text=text.replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n').replace(/\r\n?/g,'\n').trim();
  const match=text.match(/^-----BEGIN PRIVATE KEY-----\s*([A-Za-z0-9+/=\s]+?)\s*-----END PRIVATE KEY-----$/);
  if(!match)throw Error('APNS_PRIVATE_KEY_INVALID_PEM');
  const base64=match[1].replace(/\s/g,'');
  if(!base64||base64.length%4!==0||Buffer.from(base64,'base64').toString('base64')!==base64)throw Error('APNS_PRIVATE_KEY_INVALID_PEM');
  const pem='-----BEGIN PRIVATE KEY-----\n'+base64.match(/.{1,64}/g).join('\n')+'\n-----END PRIVATE KEY-----\n';
  let key;
  try{key=createPrivateKey(pem)}catch{throw Error('APNS_PRIVATE_KEY_INVALID_PEM')}
  if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw Error('APNS_PRIVATE_KEY_REQUIRES_P256');
  const now=Math.floor(Date.now()/1000),b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const input=Buffer.from(b64({alg:'ES256',kid:APNS_IDENTITY.keyId})+'.'+b64({iss:APNS_IDENTITY.teamId,iat:now}));
  const signature=sign('sha256',input,{key,dsaEncoding:'ieee-p1363'});
  const publicKey=createPublicKey(key);
  if(signature.length!==64||!verify('sha256',input,{key:publicKey,dsaEncoding:'ieee-p1363'},signature))throw Error('APNS_SIGNATURE_SELF_CHECK_FAILED');
  return {algorithm:'P-256',signatureSelfCheck:true};
}

export function checkApnsConfiguration(env){
  const status={...APNS_IDENTITY,notificationSent:false,appleAuthenticationVerified:false,deviceReceptionTested:false};
  try{
    const result=validateApnsKey(env.APNS_PRIVATE_KEY,env.APPLE_TEAM_ID);
    Object.assign(status,result,{status:'key_format_and_signature_verified',privateKeySavedInGithub:true,keyExported:false});
  }catch(error){status.status='blocked';status.reason=/^APNS_[A-Z0-9_]+$/.test(error.message)?error.message:'APNS_CONFIGURATION_VALIDATION_FAILED';status.inputShape=apnsInputShape(env.APNS_PRIVATE_KEY)}
  return status;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const status=checkApnsConfiguration(process.env);
  if(status.status==='blocked')process.exitCode=1;
  console.log(JSON.stringify(status));
}
