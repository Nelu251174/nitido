import {createPrivateKey, createSign} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export const FIREBASE_PROJECT = 'nitido-508720';
const COOLIFY = 'https://coolify.nitido.ro/api/v1';
const TARGETS = {sandbox: 'civaeb8joydtchvzlen6pivq', live: 'zxnelxi2cejranyvfpw0scac'};

export function firebaseServiceAccount(raw) {
  let account;
  try { account = JSON.parse(raw); } catch { throw Error('FIREBASE_SERVICE_ACCOUNT_JSON_INVALID'); }
  if (account?.type !== 'service_account' || account.project_id !== FIREBASE_PROJECT ||
      !/^[a-z0-9][a-z0-9-]*@nitido-508720\.iam\.gserviceaccount\.com$/.test(account.client_email ?? '') ||
      account.token_uri !== 'https://oauth2.googleapis.com/token') throw Error('FIREBASE_SERVICE_ACCOUNT_IDENTITY_MISMATCH');
  try {
    const key = createPrivateKey(account.private_key);
    if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength < 2048) throw Error();
  } catch { throw Error('FIREBASE_SERVICE_ACCOUNT_KEY_INVALID'); }
  return account;
}

async function googleResponse(response, prefix) {
  let body;
  try { body = await response.json(); } catch { throw Error(prefix + '_RESPONSE_INVALID'); }
  if (!response.ok) {
    const disabled = body?.error?.details?.some?.(detail => detail.reason === 'SERVICE_DISABLED');
    throw Error(disabled ? prefix + '_API_DISABLED' : prefix + '_HTTP_' + response.status);
  }
  return body;
}

export async function verifyFirebaseMessaging(account, fetcher = fetch) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const input = b64({alg: 'RS256', typ: 'JWT'}) + '.' + b64({iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600});
  const signer = createSign('RSA-SHA256'); signer.update(input); signer.end();
  const assertion = input + '.' + signer.sign(account.private_key).toString('base64url');
  const auth = await googleResponse(await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion}),
  }), 'FIREBASE_AUTH');
  if (typeof auth.access_token !== 'string' || auth.access_token.length < 10) throw Error('FIREBASE_AUTH_RESPONSE_INVALID');
  await googleResponse(await fetcher('https://fcm.googleapis.com/v1/projects/' + FIREBASE_PROJECT + '/messages:send', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: {Authorization: 'Bearer ' + auth.access_token, 'Content-Type': 'application/json'},
    body: JSON.stringify({validate_only: true, message: {topic: 'nitido-config-validation',
      notification: {title: 'NITIDO configuration validation', body: 'Validation only; no delivery'},
      data: {event_type: 'CONFIG_VALIDATION'}}}),
  }), 'FIREBASE_FCM');
  return {projectId: FIREBASE_PROJECT, providerDryRunAccepted: true, notificationSent: false, deviceReceptionTested: false};
}

export async function installFirebaseBindings(account, token, fetcher = fetch) {
  if (!token) throw Error('COOLIFY_CREDENTIAL_MISSING');
  async function call(path, method = 'GET', body) {
    const response = await fetcher(COOLIFY + path, {method, redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
      ...(body === undefined ? {} : {body: JSON.stringify(body)})});
    if (!response.ok) throw Error('COOLIFY_HTTP_' + response.status);
    return response.status === 204 ? null : response.json();
  }
  const values = {PUSH_ENABLED: 'false', FIREBASE_PROJECT_ID: FIREBASE_PROJECT,
    FIREBASE_CLIENT_EMAIL: account.client_email, FIREBASE_PRIVATE_KEY: account.private_key};
  const result = {};
  for (const [scope, app] of Object.entries(TARGETS)) {
    let existing = await call('/applications/' + app + '/envs');
    if (!Array.isArray(existing)) existing = existing.data ?? existing.envs ?? [];
    for (const [key, value] of Object.entries(values)) {
      const hasRuntime = existing.some(row => row.key === key && row.is_preview === false);
      const body = {key, value, is_buildtime: false, is_runtime: true, is_literal: true, is_shown_once: true};
      await call('/applications/' + app + '/envs', hasRuntime ? 'PATCH' : 'POST', {...body, is_preview: false});
      // Coolify may create a preview copy on POST. Protect both copies before returning.
      await call('/applications/' + app + '/envs', 'PATCH', {...body, is_preview: true});
    }
    let stored = await call('/applications/' + app + '/envs');
    if (!Array.isArray(stored)) stored = stored.data ?? stored.envs ?? [];
    for (const key of Object.keys(values)) {
      if (!stored.some(row => row.key === key && row.is_preview === false && row.is_shown_once === true)) throw Error('COOLIFY_BINDING_PROTECTION_FAILED');
      if (stored.some(row => row.key === key && row.is_shown_once !== true)) throw Error('COOLIFY_BINDING_PROTECTION_FAILED');
    }
    result[scope] = {configured: true, pushDeliveryEnabled: false, restartRequired: true};
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = {projectId: FIREBASE_PROJECT, notificationSent: false, deviceReceptionTested: false};
  try {
    const account = firebaseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '');
    Object.assign(report, await verifyFirebaseMessaging(account));
    report.servers = await installFirebaseBindings(account, process.env.COOLIFY_TOKEN);
    report.status = 'configured';
  } catch (error) {
    report.status = 'blocked';
    report.reason = /^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : 'FIREBASE_PROVISION_FAILED';
    process.exitCode = 1;
  }
  await writeFile('firebase-provision-status.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
