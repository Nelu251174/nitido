import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,privateDecrypt,createDecipheriv,constants} from 'node:crypto';
import {validateApnsKey,sealApnsConfiguration,APNS_IDENTITY} from './apns-credential-transfer.mjs';

const pem=(type,options)=>generateKeyPairSync(type,options).privateKey.export({type:'pkcs8',format:'pem'});
test('accepts a complete P256 private key and binds it to the existing Apple team',()=>{
  const raw=pem('ec',{namedCurve:'prime256v1'});
  const result=validateApnsKey(raw,APNS_IDENTITY.teamId);
  assert.equal(result.privateKey,raw);assert.match(result.publicKeySha256,/^[a-f0-9]{64}$/);
  assert.equal(validateApnsKey(raw.replace(/\n/g,'\\n'),APNS_IDENTITY.teamId).privateKey,raw);
  assert.equal(validateApnsKey(JSON.stringify(raw),APNS_IDENTITY.teamId).privateKey,raw);
  assert.equal(validateApnsKey(raw.replace(/\n/g,' '),APNS_IDENTITY.teamId).privateKey,raw);
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
test('encrypted artifact contains no plaintext private key and rejects tampering',()=>{
  const recipient=generateKeyPairSync('rsa',{modulusLength:2048});
  const payload={...APNS_IDENTITY,...validateApnsKey(pem('ec',{namedCurve:'prime256v1'}),APNS_IDENTITY.teamId)};
  const envelope=sealApnsConfiguration(payload,recipient.publicKey);
  assert.equal(envelope.format,'NITIDO_APNS_TRANSFER_V1');assert.equal(JSON.stringify(envelope).includes('BEGIN PRIVATE KEY'),false);
  const key=privateDecrypt({key:recipient.privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(envelope.key,'base64'));
  const recover=()=>{const d=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));d.setAuthTag(Buffer.from(envelope.tag,'base64'));return JSON.parse(Buffer.concat([d.update(Buffer.from(envelope.ciphertext,'base64')),d.final()]).toString())};
  assert.deepEqual(recover(),payload);
  envelope.ciphertext=Buffer.alloc(Buffer.from(envelope.ciphertext,'base64').length).toString('base64');assert.throws(recover);
});
