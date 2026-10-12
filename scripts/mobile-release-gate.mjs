import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// Evidence contains public receipts and assertions, never signing material or API tokens.
export function validateMobileRelease(evidence, { platform, sha, version, purpose = 'public', now = Date.now() }) {
  const fail = (message) => { throw new Error(message); };
  if (!['beta','public'].includes(purpose)) fail('Unknown release purpose');
  if (!['android', 'ios'].includes(platform)) fail('Unknown native platform');
  if (!/^[a-f0-9]{40}$/.test(sha || '') || evidence?.sourceSha !== sha) fail('Evidence must match the exact source SHA');
  if (evidence.appId !== 'ro.nitido.app' || evidence.platform !== platform) fail('Wrong app identity or platform');
  const time = Date.parse(evidence.verifiedAt);
  if (!Number.isFinite(time) || now < time || now - time > 24 * 60 * 60 * 1000) fail('Release evidence must be fresh (24 hours)');
  if (!/^[1-9][0-9]*$/.test(String(version)) || !Number.isSafeInteger(Number(version)) || Number(version) > 2100000000) fail('Invalid build version');
  if (!Number.isSafeInteger(evidence.store?.highestBuild) || evidence.store.highestBuild < 0 || Number(version) <= evidence.store.highestBuild) fail('Build version must exceed the authenticated store maximum');
  const receipt = (item, label) => {
    if (item?.verified !== true || typeof item.receipt !== 'string' || !item.receipt.trim()) fail(`Missing verified receipt: ${label}`);
  };
  receipt(evidence.store, 'current store access and maximum across tracks/versions');
  if (evidence.live?.sourceSha !== sha || evidence.live?.origin !== 'https://nitido.ro') fail('LIVE source must match the candidate');
  receipt(evidence.live, 'LIVE deployment and HTTPS checks');
  receipt(evidence.live.backup, 'LIVE backup and recovery verification');
  if (evidence.ci?.sourceSha !== sha) fail('CI source must match the candidate');
  receipt(evidence.ci, 'current native compilation and source validation');
  receipt(evidence.signing, 'existing signing identity continuity');
  if (purpose === 'public') {
    receipt(evidence.device, 'physical device QA');
    for (const flow of ['authentication', 'logout', 'push', 'location', 'camera', 'offlineRetry', 'accountDeletionRequest', 'accountDeletionFulfillment']) {
      if (evidence.device.flows?.[flow] !== true) fail(`Unverified device flow: ${flow}`);
    }
    receipt(evidence.metadata, 'privacy, data safety, review and account deletion disclosures');
  }
  if (platform === 'android') {
    receipt(evidence.compatibility, 'API 36 and native 16KB artifact checks');
    if (purpose === 'public' && evidence.compatibility.pageSize16KBRuntime !== true) fail('Android16KB runtime device proof required for public release');
    if (!Number.isSafeInteger(evidence.compatibility.targetSdk) || evidence.compatibility.targetSdk < 36 || evidence.compatibility.pageSize16KB !== true) fail('Android API/16KB compatibility missing');
  } else {
    receipt(evidence.compatibility, 'signed IPA, provisioning and SDK checks');
    if (!Number.isSafeInteger(evidence.compatibility.xcodeMajor) || !Number.isSafeInteger(evidence.compatibility.iosSdkMajor) || evidence.compatibility.xcodeMajor < 26 || evidence.compatibility.iosSdkMajor < 26) fail('Current Apple SDK requirements not met');
  }
  return { platform, purpose, appId: evidence.appId, sourceSha: sha, version: Number(version), status: 'evidence-gate-passed' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [file, platform, sha, version, purpose = 'public'] = process.argv.slice(2);
    if (!file) throw new Error('Usage: node scripts/mobile-release-gate.mjs evidence.json android|ios SHA buildNumber [beta|public]');
    console.log(JSON.stringify(validateMobileRelease(JSON.parse(fs.readFileSync(file, 'utf8')), { platform, sha, version, purpose })));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
