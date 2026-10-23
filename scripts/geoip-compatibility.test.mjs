import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const packagePath = require.resolve('geoip-country/package.json');
const geoipRequire = createRequire(packagePath);
const {lookup} = require('geoip-country');

test('patched dependency keeps local IPv4, IPv6 and mapped-address country lookup', () => {
  assert.equal(geoipRequire('ip-address/package.json').version, '10.7.4');
  for (const [ip, country] of [
    ['86.120.0.1', 'RO'], ['2a02:2f00::1', 'RO'], ['::ffff:86.120.0.1', 'RO'],
    ['8.8.8.8', 'US'], ['2001:4860:4860::8888', 'US'],
  ]) assert.equal(lookup(ip)?.country, country, ip);
  for (const ip of ['127.0.0.1', '10.0.0.1', '192.168.1.1', '::1', 'fd00::1', '192.0.2.1', 'not-an-ip', '0'.repeat(10000)]) {
    assert.equal(lookup(ip), null, ip.slice(0, 40));
  }
});

test('installation bridge is idempotent', () => {
  const updater = path.join(path.dirname(packagePath), 'scripts/updatedb.js');
  const before = readFileSync(updater);
  const result = spawnSync(process.execPath, ['scripts/patch-geoip-updater.mjs'], {cwd:root, encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(updater), before);
});

test('real GeoIP updater converts offline country and city fixtures using the patched API', () => {
  const temporary = mkdtempSync(path.join(tmpdir(), 'nitido-geoip-'));
  try {
    const input = path.join(temporary, 'csv'), output = path.join(temporary, 'data');
    mkdirSync(input); mkdirSync(output);
    const csv = (name, lines) => writeFileSync(path.join(input, `GeoLite2-${name}.csv`), lines.join('\n')+'\n');
    csv('Country-Locations-en', [
      'geoname_id,locale_code,continent_code,continent_name,country_iso_code,country_name',
      '1,en,EU,Europe,RO,Romania', '2,en,NA,North America,US,United States',
    ]);
    const countryHeader = 'network,geoname_id,registered_country_geoname_id,represented_country_geoname_id,is_anonymous_proxy,is_satellite_provider';
    csv('Country-Blocks-IPv4', [countryHeader, '0.0.0.0/32,1,,,,', '86.120.0.0/24,1,,,,', '255.255.255.255/32,2,,,,']);
    csv('Country-Blocks-IPv6', [countryHeader, '2001:db8::/32,2,,,,', '2a02:2f00::/32,1,,,,']);
    csv('City-Locations-en', [
      'geoname_id,locale_code,continent_code,continent_name,country_iso_code,country_name,subdivision_1_iso_code,subdivision_1_name,subdivision_2_iso_code,subdivision_2_name,city_name,metro_code,time_zone,is_in_european_union',
      '1,en,EU,Europe,RO,Romania,,,,,Constanta,,Europe/Bucharest,1',
    ]);
    const cityHeader = countryHeader+',postal_code,latitude,longitude,accuracy_radius';
    csv('City-Blocks-IPv4', [cityHeader, '86.120.0.0/24,1,,,,,900000,44.17,28.63,10']);
    csv('City-Blocks-IPv6', [cityHeader, '2a02:2f00::/32,1,,,,,900000,44.17,28.63,10']);
    // Debug mode consumes these local CSVs directly. The test runs with networking disabled.
    const result = spawnSync(process.execPath, [path.join(path.dirname(packagePath), 'scripts/updatedb.js'), 'debug'], {
      cwd:temporary, encoding:'utf8', timeout:15000,
      env:{PATH:process.env.PATH, GEOIP_DATADIR:output, GEOIP_TMPDATADIR:input},
    });
    assert.equal(result.status, 0, result.stderr+'\n'+result.stdout);
    const ipv4 = readFileSync(path.join(output, 'geoip-country.dat'));
    assert.equal(ipv4.length, 30);
    assert.deepEqual([0, 10, 20].map(offset => [ipv4.readUInt32BE(offset), ipv4.readUInt32BE(offset+4), ipv4.toString('utf8',offset+8,offset+10)]), [
      [0, 0, 'RO'], [0x56780000, 0x567800ff, 'RO'], [0xffffffff, 0xffffffff, 'US'],
    ]);
    const ipv6 = readFileSync(path.join(output, 'geoip-country6.dat'));
    assert.equal(ipv6.length, 36);
    assert.equal(ipv6.readBigUInt64BE(0), 0x20010db800000000n);
    assert.equal(ipv6.readBigUInt64BE(8), 0x20010db8ffffffffn);
    assert.equal(ipv6.toString('utf8',16,18), 'US');
    const city4 = readFileSync(path.join(output, 'geoip-city.dat'));
    assert.equal(city4.length, 27);
    assert.equal(city4.readUInt32BE(0), 0x56780000);
    assert.equal(city4.readUInt32BE(4), 0x567800ff);
    assert.equal(readFileSync(path.join(output, 'geoip-city6.dat')).length, 35);
  } finally {
    rmSync(temporary, {recursive:true, force:true});
  }
});
