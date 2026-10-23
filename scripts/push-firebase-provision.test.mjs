import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {firebaseServiceAccount, verifyFirebaseMessaging, installFirebaseBindings} from './push-firebase-provision.mjs';
const {privateKey} = generateKeyPairSync('rsa', {modulusLength: 2048, privateKeyEncoding: {type: 'pkcs8', format: 'pem'}, publicKeyEncoding: {type: 'spki', format: 'pem'}});
const account = {type: 'service_account', project_id: 'nitido-508720', client_email: 'synthetic@nitido-508720.iam.gserviceaccount.com', token_uri: 'https://oauth2.googleapis.com/token', private_key: privateKey};
test('rejects other projects, credential types, OAuth destinations and invalid keys before use', () => {
  assert.equal(firebaseServiceAccount(JSON.stringify(account)).project_id, 'nitido-508720');
  for (const changed of [{project_id: 'other-project'}, {type: 'authorized_user'}, {token_uri: 'https://example.invalid/token'}, {client_email: 'other@another.iam.gserviceaccount.com'}]) {
    assert.throws(() => firebaseServiceAccount(JSON.stringify({...account, ...changed})), /IDENTITY_MISMATCH/);
  }
  assert.throws(() => firebaseServiceAccount(JSON.stringify({...account, private_key: 'SYNTHETIC_SECRET'})), error => error.message === 'FIREBASE_SERVICE_ACCOUNT_KEY_INVALID');
});
test('verifies FCM with validate_only and no device token, then reports no delivery', async () => {
  const calls = [];
  const result = await verifyFirebaseMessaging(account, async (url, options) => {
    calls.push({url, options});
    return Response.json(calls.length === 1 ? {access_token: 'synthetic-access-token-only'} : {});
  });
  assert.equal(calls[0].url, 'https://oauth2.googleapis.com/token');
  const message = JSON.parse(calls[1].options.body);
  assert.equal(message.validate_only, true); assert.equal(message.message.token, undefined);
  assert.equal(result.notificationSent, false); assert.equal(result.deviceReceptionTested, false);
  assert.equal(JSON.stringify(result).includes('synthetic-access-token-only'), false);
  await assert.rejects(verifyFirebaseMessaging(account, async () => Response.json({error: {message: 'SYNTHETIC_SECRET'}}, {status: 403})), error => error.message === 'FIREBASE_AUTH_HTTP_403');
});
test('writes only scoped runtime bindings, keeps delivery disabled and locks runtime and preview copies', async () => {
  const tables = new Map(), writes = [];
  const result = await installFirebaseBindings(account, 'synthetic-coolify-token', async (url, options) => {
    assert.ok(url.startsWith('https://coolify.nitido.ro/api/v1/applications/'));
    const rows = tables.get(url) ?? [{key: 'STRIPE_SECRET_KEY', value: 'unrelated-placeholder', is_preview: false}]; tables.set(url, rows);
    if (options.method === 'GET') return Response.json(rows);
    const value = JSON.parse(options.body); writes.push(value);
    const index = rows.findIndex(row => row.key === value.key && row.is_preview === value.is_preview);
    if (index === -1) rows.push(value); else rows[index] = value;
    return Response.json({ok: true});
  });
  assert.equal(writes.length, 16);
  assert.ok(writes.every(row => row.is_buildtime === false && row.is_runtime && row.is_shown_once));
  assert.ok(writes.filter(row => row.key === 'PUSH_ENABLED').every(row => row.value === 'false'));
  assert.ok(writes.every(row => ['PUSH_ENABLED', 'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'].includes(row.key)));
  assert.equal(result.live.pushDeliveryEnabled, false);
  assert.equal(JSON.stringify(result).includes('PRIVATE KEY'), false);
  for (const rows of tables.values()) assert.equal(rows.find(row => row.key === 'STRIPE_SECRET_KEY').value, 'unrelated-placeholder');
});
