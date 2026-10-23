// Owner explicitly approved this encrypted transfer to NITIDO runtimes on 2026-10-23.
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {apnsSigningKey,APNS_IDENTITY} from './apns-credential-check.mjs';
import {sealFirebaseConfiguration} from './firebase-credential-transfer.mjs';

export function sealApprovedApnsTransfer(privateKey,teamId,recipient){
  const key=apnsSigningKey(privateKey,teamId);
  const payload={kind:'NITIDO_APNS_APPROVED_TRANSFER_V1',...APNS_IDENTITY,privateKey:key.export({type:'pkcs8',format:'pem'}),createdAt:new Date().toISOString(),destinations:['sandbox.nitido.ro','nitido.ro']};
  return {...sealFirebaseConfiguration(payload,recipient),format:'NITIDO_APNS_APPROVED_TRANSFER_V1'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(!process.argv.includes('--owner-approved-transfer'))throw Error('APNS_TRANSFER_APPROVAL_REQUIRED');
    const recipient=await readFile('scripts/apns-approved-transfer-recipient.pem','utf8');
    const encrypted=sealApprovedApnsTransfer(process.env.APNS_PRIVATE_KEY,process.env.APPLE_TEAM_ID,recipient);
    await writeFile('apns-approved-configuration.encrypted.json',JSON.stringify(encrypted),{mode:0o600});
    console.log(JSON.stringify({status:'encrypted_for_approved_nitido_runtime_installation',plaintextKeyExported:false,notificationSent:false}));
  }catch(error){console.log(JSON.stringify({status:'blocked',reason:/^APNS_[A-Z0-9_]+$/.test(error.message)?error.message:'APNS_APPROVED_TRANSFER_FAILED'}));process.exitCode=1}
}
