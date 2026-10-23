import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,privateDecrypt,createDecipheriv,constants} from 'node:crypto';
import {sealFirebaseConfiguration} from './firebase-credential-transfer.mjs';
test('only the task recipient can recover credentials and tampering is rejected',()=>{
 const pair=generateKeyPairSync('rsa',{modulusLength:2048});
 const publicKey=pair.publicKey.export({type:'spki',format:'pem'});
 const payload={account:{private_key:'synthetic-secret-that-must-not-appear-in-artifacts'},projectId:'nitido-508720'};
 const a=sealFirebaseConfiguration(payload,publicKey),b=sealFirebaseConfiguration(payload,publicKey);
 assert.equal(JSON.stringify(a).includes(payload.account.private_key),false);
 assert.notEqual(a.ciphertext,b.ciphertext);
 const key=privateDecrypt({key:pair.privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(a.key,'base64'));
 const recover=()=>{const d=createDecipheriv('aes-256-gcm',key,Buffer.from(a.iv,'base64'));d.setAuthTag(Buffer.from(a.tag,'base64'));return Buffer.concat([d.update(Buffer.from(a.ciphertext,'base64')),d.final()]).toString()};
 assert.deepEqual(JSON.parse(recover()),payload);
 a.ciphertext=Buffer.alloc(Buffer.from(a.ciphertext,'base64').length).toString('base64');assert.throws(recover);
});
