/** Compatibility bridge until geoip-country supports the maintained ip-address API. */
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const manifest = require.resolve('geoip-country/package.json');
const geoipRequire = createRequire(manifest);
if (require(manifest).version !== '5.0.202610140208' || geoipRequire('ip-address/package.json').version !== '10.7.4') {
  throw new Error('Review the GeoIP updater bridge before changing either pinned dependency.');
}
const file = path.join(path.dirname(manifest), 'scripts/updatedb.js');
const source = readFileSync(file, 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
const original = '8ecd70ed9aedc0217c2a2559a690ed5eceda54f0fc46d55780af2dd4a55e0c74';
const patched = '74b0e79319bb50a65a1e64c80bbebe62be47cbcf95ec9035f6bd185279b78a6c';
if (hash(source) !== patched) {
  if (hash(source) !== original) throw new Error('Unexpected GeoIP updater contents; compatibility patch was not applied.');
  // IPv4 is at most 2^32-1, so the existing decimal conversion stays exact.
  const updated = source.replaceAll('.bigInteger()', '.bigInt()');
  if (hash(updated) !== patched) throw new Error('GeoIP updater compatibility patch failed verification.');
  writeFileSync(file, updated);
}
console.log('GeoIP updater verified with ip-address 10.7.4.');
