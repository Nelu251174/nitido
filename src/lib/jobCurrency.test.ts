import {describe,it,expect} from 'vitest';
import Sqlite from 'better-sqlite3';
import {currencyOfJob,firmAmountForJob,jobGrossTotals,serializeJobCurrency,jobScheduleContext} from './jobCurrency';
import {financialReadMoney} from './financialReadMoney';
import {earningsForMonth,earningTotals} from './monthlyFirmEarnings';

function euro(grossMinor=10001){return JSON.stringify({currency:'EUR',countryCode:'DE',city:'Berlin',tariffId:'synthetic-test-only',revision:1,recordedAt:'2026-11-02T10:00:00Z',netMinor:grossMinor,vatMinor:0,vatBps:0,grossMinor,clientTotalMinor:grossMinor,creditMinor:0,durationMinutes:180,workers:1,personMinutes:180,lines:[{code:'cleaning',amountMinor:grossMinor},{code:'vat',amountMinor:0}]});}

describe('immutable job currency and reports',()=>{
 it('retains legacy Romanian amounts and rejects an unverifiable foreign currency',()=>{
  expect(currencyOfJob(null)).toBe('RON');expect(currencyOfJob('{}')).toBe('RON');
  expect(currencyOfJob({currency:'EUR',pricing_snapshot:'{"currency":"RON","countryCode":"RO"}'})).toBe('RON');
  expect(serializeJobCurrency({price_gross:550,pricing_snapshot:null})).toEqual({price_gross:550,pricing_snapshot:null,currency:'RON'});
  expect(currencyOfJob('{"currency":"EUR","countryCode":"DE"}')).toBeNull();
  expect(currencyOfJob('{"currency":"USD"}')).toBeNull();
 });
 it('uses the immutable work country timezone while retaining the legacy Romanian timezone',()=>{
  expect(jobScheduleContext(null)).toEqual({countryCode:'RO',timeZone:'Europe/Bucharest'});
  expect(jobScheduleContext(euro())).toEqual({countryCode:'DE',timeZone:'Europe/Berlin'});
  expect(jobScheduleContext('{"currency":"EUR","countryCode":"US"}')).toBeNull();
 });
 it('reads exact native EUR from the frozen snapshot and splits the firm share in cents',()=>{
  const job={pricing_snapshot:euro(),price_gross:999};
  expect(serializeJobCurrency(job)).toMatchObject({currency:'EUR',price_gross:100.01});
  expect(firmAmountForJob(job)).toBe(82.01);
  expect(firmAmountForJob({price_gross:100.01})).toBe(82);
 });
 it('keeps mixed RON/EUR totals separate and excludes corrupt currency data',()=>{
  const totals=jobGrossTotals([{price_gross:550},{price_gross:999,pricing_snapshot:euro()},{pricing_snapshot:euro(1),price_gross:999},{pricing_snapshot:'broken',price_gross:500}]);
  expect(totals).toEqual({RON:{amountMinor:55000,amount:550,count:1},EUR:{amountMinor:10002,amount:100.02,count:2},unrecognizedCount:1});
 });
 it('uses EUR stored cents for read DTOs and never guesses the Stripe fee currency',()=>{
  expect(financialReadMoney({currency:'EUR',amount_gross:100,amount_net:82,commission_amount:18,amount_gross_minor:10001,amount_net_minor:8201,commission_amount_minor:1800,stripe_fee_amount:50})).toMatchObject({currency:'EUR',amount_gross:100.01,amount_net:82.01,commission_amount:18,stripe_fee_currency:null});
  expect(financialReadMoney({currency:'RON',amount_gross:550,amount_net:437,commission_amount:113,stripe_fee_currency:'EUR'})).toMatchObject({currency:'RON',amount_gross:550,amount_net:437,commission_amount:113,stripe_fee_currency:'EUR'});
  expect(financialReadMoney({currency:'EUR',amount_gross:100,amount_net:82})).toMatchObject({amount_gross:null,amount_net:null});
 });
 it('reports monthly firm earnings from stored cents without leaking the pricing snapshot',()=>{
  const db=new Sqlite(':memory:');
  try{
   db.exec(`CREATE TABLE users(id TEXT,name TEXT);CREATE TABLE firms(id TEXT,user_id TEXT);CREATE TABLE jobs(id TEXT,client_id TEXT,accepted_firm_id TEXT,street TEXT,city TEXT,completed_at TEXT,arrived_confirmed_at TEXT,duration_minutes INTEGER,status TEXT,pricing_snapshot TEXT);CREATE TABLE payments(job_id TEXT,amount_net REAL,status TEXT,refund_status TEXT,dispute_status TEXT,transfer_status TEXT,payout_status TEXT,currency TEXT,amount_net_minor INTEGER);INSERT INTO users VALUES('c','Synthetic client');INSERT INTO firms VALUES('f','u');INSERT INTO jobs VALUES('ro','c','f','Test','Constanța','2026-11-02T10:00:00Z','2026-11-02T07:00:00Z',180,'completed',NULL);INSERT INTO payments VALUES('ro',410,'captured','none','none','sent','pending','RON',41000);`);
   db.prepare("INSERT INTO jobs VALUES('eu','c','f','Test','Berlin','2026-11-02T10:00:00Z','2026-11-02T07:00:00Z',180,'completed',?)").run(euro());
   db.exec("INSERT INTO payments VALUES('eu',80,'captured','none','none','sent','pending','EUR',8201)");
   const rows=earningsForMonth(db,'u','2026-11');expect(rows.find(r=>r.id==='eu')).toMatchObject({currency:'EUR',net:82.01,confirmedNet:82.01});
   expect(rows.some(r=>'pricingSnapshot' in r)).toBe(false);
   expect(earningTotals(rows)).toEqual({RON:410,EUR:82.01,unrecognized:0});
  }finally{db.close();}
 });
});
