import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,privateDecrypt,createDecipheriv,constants} from 'node:crypto';
import {sealApprovedApnsTransfer} from './apns-approved-transfer.mjs';
import {APNS_IDENTITY} from './apns-credential-check.mjs';
test('proposed transfer encrypts a normalized key only for the recipient and pins intended servers',()=>{
  const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey.export({type:'pkcs8',format:'pem'});
  const pair=generateKeyPairSync('rsa',{modulusLength:2048});
  const result=sealApprovedApnsTransfer('Downloaded key\n'+key,APNS_IDENTITY.teamId,pair.publicKey);
  assert.equal(JSON.stringify(result).includes('PRIVATE KEY'),false);assert.equal(JSON.stringify(result).includes(key.split('\n')[1]),false);
  const aes=privateDecrypt({key:pair.privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(result.key,'base64'));
  const recover=()=>{const d=createDecipheriv('aes-256-gcm',aes,Buffer.from(result.iv,'base64'));d.setAuthTag(Buffer.from(result.tag,'base64'));return JSON.parse(Buffer.concat([d.update(Buffer.from(result.ciphertext,'base64')),d.final()]).toString())};
  const payload=recover();assert.equal(payload.privateKey,key);assert.equal(payload.bundleId,'ro.nitido.app');assert.equal(payload.useSandbox,false);assert.deepEqual(payload.destinations,['sandbox.nitido.ro','nitido.ro']);
  result.ciphertext=Buffer.alloc(Buffer.from(result.ciphertext,'base64').length).toString('base64');assert.throws(recover);
});
