import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {validateApnsKey,checkApnsConfiguration,APNS_IDENTITY} from './apns-credential-check.mjs';

const pem=(type,options)=>generateKeyPairSync(type,options).privateKey.export({type:'pkcs8',format:'pem'});
test('accepts a complete P256 private key and binds it to the existing Apple team',()=>{
  const raw=pem('ec',{namedCurve:'prime256v1'});
  const result=validateApnsKey(raw,APNS_IDENTITY.teamId);
  assert.deepEqual(result,{algorithm:'P-256',signatureSelfCheck:true});
  for(const copied of [raw.replace(/\n/g,'\\n'),JSON.stringify(raw),raw.replace(/\n/g,' ')]){
    assert.deepEqual(validateApnsKey(copied,APNS_IDENTITY.teamId),result);
  }
  assert.throws(()=>validateApnsKey(raw,'OTHERTEAM1'),/^Error: APNS_APPLE_TEAM_MISMATCH$/);
});
test('rejects missing, incomplete, RSA, wrong-curve and public keys with sanitized errors',()=>{
  for(const raw of ['', 'private-sensitive-text', '-----BEGIN PRIVATE KEY-----\nbroken\n-----END PRIVATE KEY-----']){
    assert.throws(()=>validateApnsKey(raw,APNS_IDENTITY.teamId),/^Error: APNS_PRIVATE_KEY_(MISSING|INVALID_PEM)$/);
  }
  for(const raw of [pem('rsa',{modulusLength:2048}),pem('ec',{namedCurve:'secp384r1'})]){
    assert.throws(()=>validateApnsKey(raw,APNS_IDENTITY.teamId),/^Error: APNS_PRIVATE_KEY_REQUIRES_P256$/);
  }
  const pub=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).publicKey.export({type:'spki',format:'pem'});
  assert.throws(()=>validateApnsKey(pub,APNS_IDENTITY.teamId),/^Error: APNS_PRIVATE_KEY_INVALID_PEM$/);
});
test('successful status contains no key, signature or credential payload; failures remain sanitized',()=>{
  const raw=pem('ec',{namedCurve:'prime256v1'});
  const status=checkApnsConfiguration({APNS_PRIVATE_KEY:raw,APPLE_TEAM_ID:APNS_IDENTITY.teamId});
  assert.deepEqual(status,{...APNS_IDENTITY,notificationSent:false,appleAuthenticationVerified:false,deviceReceptionTested:false,algorithm:'P-256',signatureSelfCheck:true,status:'key_format_and_signature_verified',privateKeySavedInGithub:true,keyExported:false});
  assert.equal(JSON.stringify(status).includes('BEGIN PRIVATE KEY'),false);assert.equal(JSON.stringify(status).includes(raw.split('\n')[1]),false);
  const invalid=checkApnsConfiguration({APNS_PRIVATE_KEY:'private-sensitive-text',APPLE_TEAM_ID:APNS_IDENTITY.teamId});
  assert.equal(invalid.status,'blocked');assert.equal(invalid.reason,'APNS_PRIVATE_KEY_INVALID_PEM');assert.equal(JSON.stringify(invalid).includes('private-sensitive-text'),false);
});
