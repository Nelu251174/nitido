import {randomBytes,createCipheriv,publicEncrypt,constants} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {firebaseServiceAccount,verifyFirebaseMessaging,FIREBASE_PROJECT} from './push-firebase-provision.mjs';
import {downloadFirebaseAndroidConfig} from './mobile-firebase-config.mjs';

export function sealFirebaseConfiguration(payload, publicKey) {
  const key=randomBytes(32),iv=randomBytes(12);
  try {
    const cipher=createCipheriv('aes-256-gcm',key,iv);
    const ciphertext=Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]);
    const wrapped=publicEncrypt({key:publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},key);
    return {format:'NITIDO_FIREBASE_TRANSFER_V1',key:wrapped.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};
  } finally {key.fill(0)}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const status={projectId:FIREBASE_PROJECT,notificationSent:false,deviceReceptionTested:false};
  try{
    const account=firebaseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON??'');
    Object.assign(status,await verifyFirebaseMessaging(account));
    let androidConfig=null;
    try{androidConfig=await downloadFirebaseAndroidConfig(process.env);status.androidConfig='verified'}
    catch(error){status.androidConfig='blocked';status.androidConfigReason=/^FIREBASE_ANDROID_[A-Z_]+$/.test(error.message)?error.message:'FIREBASE_ANDROID_CONFIG_FAILED'}
    const recipient=await readFile('scripts/firebase-transfer-recipient.pem','utf8');
    const sealed=sealFirebaseConfiguration({projectId:FIREBASE_PROJECT,account,androidConfig,createdAt:new Date().toISOString()},recipient);
    await writeFile('firebase-configuration.encrypted.json',JSON.stringify(sealed),{mode:0o600});
    status.status='encrypted_for_server_installation';
  }catch(error){status.status='blocked';status.reason=/^[A-Z][A-Z0-9_]+$/.test(error.message)?error.message:'FIREBASE_TRANSFER_FAILED';process.exitCode=1}
  await writeFile('firebase-transfer-status.json',JSON.stringify(status,null,2));
  console.log(JSON.stringify(status));
}
