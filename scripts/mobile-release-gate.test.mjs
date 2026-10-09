import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMobileRelease } from './mobile-release-gate.mjs';
const sha = 'a'.repeat(40);
const now = Date.parse('2026-10-09T12:00:00Z');
const receipt = { verified: true, receipt: 'synthetic local acceptance only' };
function fixture(platform = 'android') { return {
  appId:'ro.nitido.app', platform, sourceSha:sha, verifiedAt:new Date(now).toISOString(),
  store:{ ...receipt, highestBuild:18 }, ci:{ ...receipt,sourceSha:sha }, live:{ ...receipt, sourceSha:sha, origin:'https://nitido.ro',backup:receipt }, signing:receipt, metadata:receipt,
  device:{ ...receipt, flows:Object.fromEntries(['authentication','logout','push','location','camera','offlineRetry','accountDeletionRequest','accountDeletionFulfillment'].map(k => [k,true])) },
  compatibility:{ ...receipt, targetSdk:36, pageSize16KB:true, pageSize16KBRuntime:true, xcodeMajor:26, iosSdkMajor:26 }
}; }
const opts = {platform:'android',sha,version:19,now};
test('accepts complete fresh synthetic evidence for both platforms', () => {
  assert.equal(validateMobileRelease(fixture(), opts).status,'evidence-gate-passed');
  assert.equal(validateMobileRelease(fixture('ios'), {...opts,platform:'ios'}).platform,'ios');
});
test('refuses candidate source drift, wrong identity, stale or future evidence', () => {
  for(const patch of [{sourceSha:'b'.repeat(40)},{appId:'wrong.app'},{platform:'ios'},{verifiedAt:new Date(now-86400001).toISOString()},{verifiedAt:new Date(now+1).toISOString()}]) {
    assert.throws(()=>validateMobileRelease({...fixture(),...patch},opts));
  }
});
test('refuses version reuse and unverified store access', () => {
  assert.throws(()=>validateMobileRelease(fixture(), {...opts,version:18}),/maximum/);
  assert.throws(()=>validateMobileRelease({...fixture(),store:{highestBuild:18}},opts),/receipt/);
});
test('blocks current code until LIVE deployment and device deletion fulfillment verified', () => {
  const e=fixture();e.live.sourceSha='b'.repeat(40);assert.throws(()=>validateMobileRelease(e,opts),/LIVE/);
  const f=fixture();f.device.flows.accountDeletionFulfillment=false;assert.throws(()=>validateMobileRelease(f,opts),/Fulfillment/);
});
test('blocks incompatible native artifact evidence', () => {
  const e=fixture();e.compatibility.pageSize16KB=false;assert.throws(()=>validateMobileRelease(e,opts),/compatibility/);
  const f=fixture('ios');f.compatibility.iosSdkMajor=25;assert.throws(()=>validateMobileRelease(f,{...opts,platform:'ios'}),/SDK/);
});

test('rejects missing and malformed SDK evidence and non-decimal versions', () => {
  for (const bad of [undefined,null,'36',NaN,Infinity,35.5]) {
    const e=fixture();e.compatibility.targetSdk=bad;assert.throws(()=>validateMobileRelease(e,opts));
    for(const key of ['xcodeMajor','iosSdkMajor']) {
      const f=fixture('ios');f.compatibility[key]=bad;assert.throws(()=>validateMobileRelease(f,{...opts,platform:'ios'}));
    }
  }
  for(const version of ['1e2','19.0',' 19','+19','0x13','019',Infinity,NaN]) assert.throws(()=>validateMobileRelease(fixture(),{...opts,version}));
});

test('beta enables device testing without asserting public device or metadata completion', () => {
  const e=fixture();delete e.device;delete e.metadata;delete e.compatibility.pageSize16KBRuntime;
  assert.equal(validateMobileRelease(e,{...opts,purpose:'beta'}).purpose,'beta');
  assert.throws(()=>validateMobileRelease(e,opts));
});
test('beta still requires same-source CI and verified LIVE backup', () => {
  const e=fixture();delete e.live.backup;assert.throws(()=>validateMobileRelease(e,{...opts,purpose:'beta'}),/backup/);
  const f=fixture();f.ci.sourceSha='b'.repeat(40);assert.throws(()=>validateMobileRelease(f,{...opts,purpose:'beta'}),/CI/);
});
