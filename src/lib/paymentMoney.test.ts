import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import Sqlite from 'better-sqlite3';
import {createHash} from 'node:crypto';
import type Stripe from 'stripe';
import {initializeDatabase} from './db';
import {ensurePaymentMoneySchema,moneyFromPayment,authorizationMoney} from './paymentMoney';
const api=vi.hoisted(()=>({paymentIntents:{create:vi.fn(),retrieve:vi.fn(),capture:vi.fn(),cancel:vi.fn()},transfers:{create:vi.fn(),createReversal:vi.fn()},refunds:{create:vi.fn(),retrieve:vi.fn()},v2:{core:{accounts:{create:vi.fn(),retrieve:vi.fn()}}}}));
vi.mock('stripe',()=>({default:class {paymentIntents=api.paymentIntents;transfers=api.transfers;refunds=api.refunds;v2=api.v2}}));
import {authorizePayment,capturePayment,cancelPayment,refundCapturedPayment,applyStripeRefund,calculatePaymentSplit,initiateFirmTransfer} from './payments';
import {ensureAuthorizationCoverage} from './authorizationCoverage';
import {createOrReuseRecipientAccount} from './stripeConnect';
const paymentId=`pay_${createHash('sha256').update('eur-job').digest('hex')}`;
const snapshot={currency:'EUR',countryCode:'ES',grossMinor:12345,creditMinor:0,clientTotalMinor:12345,tariffId:'es-madrid-household',revision:1};
let db:Sqlite.Database;
function intent(patch:Record<string,unknown>={}){return {id:'pi_eur',currency:'eur',amount:12345,amount_capturable:12345,amount_received:0,status:'requires_capture',capture_method:'manual',metadata:{jobId:'eur-job',paymentId},latest_charge:{id:'ch_eur',payment_method_details:{card:{capture_before:Math.floor(Date.now()/1000)+86400}}},...patch};}
function refund(patch:Record<string,unknown>={}){return {id:'re_eur',payment_intent:'pi_eur',currency:'eur',amount:12345,status:'succeeded',...patch} as unknown as Stripe.Refund;}
function saved(){return db.prepare("SELECT * FROM payments WHERE job_id='eur-job'").get() as Record<string,unknown>;}
function updateSnapshot(patch:Record<string,unknown>){db.prepare("UPDATE jobs SET pricing_snapshot=? WHERE id='eur-job'").run(JSON.stringify({...snapshot,...patch}));}
beforeEach(()=>{
 vi.resetAllMocks();vi.stubEnv('NODE_ENV','test');vi.stubEnv('STRIPE_SECRET_KEY','sk_test_synthetic_eur');vi.stubEnv('NEXT_PUBLIC_SITE_URL','http://localhost:3210');vi.stubEnv('NITIDO_ENABLE_INTERNATIONAL_PRICING','true');vi.stubEnv('NITIDO_INTERNATIONAL_LIVE_APPROVED','');vi.stubEnv('NITIDO_STRIPE_CONNECT_TRANSFERS_ENABLED','false');
 db=new Sqlite(':memory:');initializeDatabase(db);ensurePaymentMoneySchema(db);
 // Synthetic corruption fixtures only; production snapshots remain immutable.
 db.exec('DROP TRIGGER IF EXISTS jobs_pricing_snapshot_immutable');
 db.exec("INSERT INTO users(id,role,name,stripe_customer_id,stripe_payment_method_id) VALUES('eur-c','client','Synthetic client','cus_eur','pm_eur'),('eur-u','firma','Synthetic firm',NULL,NULL);INSERT INTO firms(id,user_id,coverage_city,verified,stripe_account_id,stripe_account_status,stripe_transfers_capability,stripe_identity_country,stripe_default_currency) VALUES('eur-f','eur-u','Madrid',1,'acct_eur','ready','active','ES','EUR')");
 db.prepare("INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status,accepted_firm_id,pricing_snapshot) VALUES('eur-job','eur-c','Synthetic','Madrid',50,'apartament','asap',123.45,180,'completed','eur-f',?)").run(JSON.stringify(snapshot));
 db.exec("INSERT INTO job_photos(id,job_id,owner_user_id,uploaded_by_firm_id,proof_type,filename,mime_type,file_size,status,validated_at) VALUES('eur-a','eur-job','eur-u','eur-f','ARRIVAL','synthetic-a.jpg','image/jpeg',10,'VALID',datetime('now')),('eur-z','eur-job','eur-u','eur-f','COMPLETION','synthetic-z.jpg','image/jpeg',10,'VALID',datetime('now'))");
 api.paymentIntents.create.mockResolvedValue(intent());api.paymentIntents.retrieve.mockResolvedValue(intent());api.paymentIntents.capture.mockResolvedValue(intent({status:'succeeded',amount_received:12345}));api.paymentIntents.cancel.mockResolvedValue(intent({status:'canceled',amount_capturable:0}));api.refunds.create.mockResolvedValue(refund());api.refunds.retrieve.mockResolvedValue(refund());api.transfers.create.mockResolvedValue({id:'tr_eur'});api.transfers.createReversal.mockResolvedValue({id:'trr_eur'});
});
afterEach(()=>{db.close();vi.unstubAllEnvs()});
describe('currency-aware authoritative payment money',()=>{
 it('authorizes exact EUR cents from the stored snapshot, not the legacy amount argument',async()=>{
  await authorizePayment(db,'eur-job',999999);
  expect(api.paymentIntents.create.mock.calls[0][0]).toMatchObject({amount:12345,currency:'eur',capture_method:'manual'});
  expect(saved()).toMatchObject({currency:'EUR',amount_gross:123.45,amount_gross_minor:12345,amount_net_minor:10123,commission_amount_minor:2222});
 });
 it('rounds the EUR firm share in cents rather than whole euros',()=>{
  expect(authorizationMoney(db,'eur-job',0)).toMatchObject({firmAmount:101.23,platformAmount:22.22,firmAmountMinor:10123,platformAmountMinor:2222});
 });
 it.each([{}, {countryCode:'RO'}, {currency:'USD'}, {grossMinor:12345.5}, {clientTotalMinor:12344}, {creditMinor:20}, {revision:0}, {tariffId:''}])('fails closed for a disabled or corrupt EUR contract: %j',async patch=>{
  if(!Object.keys(patch).length)vi.stubEnv('NITIDO_ENABLE_INTERNATIONAL_PRICING','false');else updateSnapshot(patch);
  await expect(authorizePayment(db,'eur-job',123.45)).rejects.toThrow();expect(api.paymentIntents.create).not.toHaveBeenCalled();expect(saved()).toBeUndefined();
 });
 it('refuses applying RON credits to a EUR booking',async()=>{
  await expect(authorizePayment(db,'eur-job',123.45,null,20)).rejects.toThrow('EUR_CREDIT_NOT_SUPPORTED');expect(api.paymentIntents.create).not.toHaveBeenCalled();
 });
 it('preserves the Romanian whole-lei rounding and credit floor',()=>{
  db.exec("UPDATE jobs SET pricing_snapshot=NULL WHERE id='eur-job'");
  for(const gross of [501,750,1001])for(const credit of [0,20,500]){
   const legacy=calculatePaymentSplit(gross,credit),money=authorizationMoney(db,'eur-job',gross,credit);
   expect({clientAmount:money.clientAmount,firmAmount:money.firmAmount,platformAmount:money.platformAmount}).toEqual(legacy);
   expect(money.currency).toBe('RON');expect(money.clientAmountMinor).toBe(legacy.clientAmount*100);
  }
 });
 it('migrates a legacy payment additively without changing its values',()=>{
  const legacy=new Sqlite(':memory:');try{
   legacy.exec("CREATE TABLE payments(id TEXT,amount_gross INTEGER,commission_amount INTEGER,amount_net INTEGER);INSERT INTO payments VALUES('old',501,90,411)");
   const before=legacy.prepare('SELECT amount_gross,commission_amount,amount_net FROM payments').get();ensurePaymentMoneySchema(legacy);ensurePaymentMoneySchema(legacy);
   expect(legacy.prepare('SELECT amount_gross,commission_amount,amount_net FROM payments').get()).toEqual(before);
   expect(moneyFromPayment(legacy.prepare('SELECT * FROM payments').get() as Record<string,unknown>)).toMatchObject({currency:'RON',clientAmountMinor:50100,firmAmountMinor:41100});
  }finally{legacy.close()}
 });
 it.each([1.1,1.01,19.99,1234.56])('reads valid fractional RON amounts in exact cents: %s',value=>{
  const cents=Math.round(value*100);
  expect(moneyFromPayment({currency:'RON',amount_gross:value,amount_net:0,commission_amount:value})).toMatchObject({clientAmountMinor:cents,platformAmountMinor:cents,firmAmountMinor:0});
 });
 it('preserves the Romanian split when a fractional credit creates binary subtraction noise',()=>{
  db.exec("UPDATE jobs SET pricing_snapshot=NULL WHERE id='eur-job'");
  expect(authorizationMoney(db,'eur-job',100,1.1)).toMatchObject({currency:'RON',clientAmount:98.9,firmAmount:82,clientAmountMinor:9890,firmAmountMinor:8200,platformAmountMinor:1690});
 });
 it.each([1.001,1.105,0.0001,Number.MAX_SAFE_INTEGER,Number.POSITIVE_INFINITY])('rejects real extra decimals or unsafe legacy amounts: %s',value=>{
  expect(()=>moneyFromPayment({currency:'RON',amount_gross:value,amount_net:0,commission_amount:value})).toThrow('PAYMENT_AMOUNT_INVALID');
 });
 it('reuses an uncertain EUR authorization with the same parameters and idempotency key',async()=>{
  api.paymentIntents.create.mockRejectedValueOnce(Error('synthetic timeout')).mockResolvedValueOnce(intent());
  await expect(authorizePayment(db,'eur-job',123.45)).rejects.toThrow('synthetic timeout');await authorizePayment(db,'eur-job',999);
  expect(api.paymentIntents.create.mock.calls[0]).toEqual(api.paymentIntents.create.mock.calls[1]);
 });
 it('verifies EUR authorization coverage without capturing',async()=>{
  await authorizePayment(db,'eur-job',0,null,0,undefined,{requiredUntil:Date.now()+3600000});
  expect(db.prepare('SELECT currency,state,amount_minor FROM authorization_coverage').get()).toEqual({currency:'EUR',state:'verified',amount_minor:12345});expect(api.paymentIntents.capture).not.toHaveBeenCalled();
 });
 it('rejects a mismatched currency from an expanded coverage intent',async()=>{
  api.paymentIntents.retrieve.mockResolvedValue(intent({currency:'ron'}));
  await expect(ensureAuthorizationCoverage(db,api as unknown as Stripe,intent() as unknown as Stripe.PaymentIntent,{jobId:'eur-job',paymentId,amountMinor:12345,currency:'EUR',requiredUntil:Date.now()+3600000})).rejects.toThrow();
  expect(api.paymentIntents.cancel).not.toHaveBeenCalled();
 });
 it('rejects an explicit null coverage currency rather than treating it as legacy RON',async()=>{
  await expect(ensureAuthorizationCoverage(db,api as unknown as Stripe,intent() as unknown as Stripe.PaymentIntent,{jobId:'eur-job',paymentId,amountMinor:12345,currency:null as unknown as 'EUR',requiredUntil:Date.now()+3600000})).rejects.toThrow('PAYMENT_CURRENCY_INVALID');
  expect(api.paymentIntents.retrieve).not.toHaveBeenCalled();
 });
 it('captures and transfers EUR once with exact persisted cents even after rollout is disabled',async()=>{
  await authorizePayment(db,'eur-job',0);vi.stubEnv('NITIDO_ENABLE_INTERNATIONAL_PRICING','false');vi.stubEnv('NITIDO_STRIPE_CONNECT_TRANSFERS_ENABLED','true');
  await capturePayment(db,'eur-job');await capturePayment(db,'eur-job');
  expect(api.paymentIntents.capture).toHaveBeenCalledTimes(1);expect(api.transfers.create).toHaveBeenCalledTimes(1);
  expect(api.transfers.create.mock.calls[0][0]).toMatchObject({amount:10123,currency:'eur',destination:'acct_eur'});
 });
 it('does not transfer a new EUR payment to a recipient whose stored foreign currency was not configured',async()=>{
  await authorizePayment(db,'eur-job',0);vi.stubEnv('NITIDO_STRIPE_CONNECT_TRANSFERS_ENABLED','true');db.exec("UPDATE firms SET stripe_default_currency='RON' WHERE id='eur-f'");
  await capturePayment(db,'eur-job');expect(api.transfers.create).not.toHaveBeenCalled();expect(saved()).toMatchObject({status:'captured',transfer_status:'failed'});
 });
 it('refuses transfer when the provider identity moved to another EUR country',async()=>{
  vi.stubEnv('NITIDO_STRIPE_CONNECT_TRANSFERS_ENABLED','true');
  await authorizePayment(db,'eur-job',123.45);db.exec("UPDATE payments SET status='captured';UPDATE firms SET stripe_identity_country='FR' WHERE id='eur-f'");
  await expect(initiateFirmTransfer(db,'eur-job')).rejects.toThrow('CONNECTED_ACCOUNT_CURRENCY_MISMATCH');expect(api.transfers.create).not.toHaveBeenCalled();
 });
 it('cancels the original EUR authorization when rollout is disabled, with replay deduplication',async()=>{
  await authorizePayment(db,'eur-job',0);vi.stubEnv('NITIDO_ENABLE_INTERNATIONAL_PRICING','false');
  await cancelPayment(db,'eur-job');api.paymentIntents.retrieve.mockResolvedValue(intent({status:'canceled',amount_capturable:0}));await cancelPayment(db,'eur-job');
  expect(api.paymentIntents.cancel).toHaveBeenCalledTimes(1);expect(saved()).toMatchObject({status:'cancelled',currency:'EUR'});
 });
 it('refunds and reverses exact EUR cents once after rollout is disabled',async()=>{
  await authorizePayment(db,'eur-job',0);await capturePayment(db,'eur-job');db.exec("UPDATE payments SET stripe_transfer_id='tr_eur'");vi.stubEnv('NITIDO_ENABLE_INTERNATIONAL_PRICING','false');
  expect(await refundCapturedPayment(db,'eur-job')).toBe('succeeded');expect(await refundCapturedPayment(db,'eur-job')).toBe('succeeded');
  expect(api.refunds.create).toHaveBeenCalledTimes(1);expect(api.transfers.createReversal.mock.calls[0][1]).toEqual({amount:10123});
  expect(db.prepare('SELECT currency,amount_minor FROM payment_refunds').get()).toEqual({currency:'EUR',amount_minor:12345});
 });
 it('rejects a RON refund for a EUR payment without marking it refunded',async()=>{
  await authorizePayment(db,'eur-job',0);await capturePayment(db,'eur-job');api.refunds.create.mockResolvedValue(refund({currency:'ron'}));
  await expect(refundCapturedPayment(db,'eur-job')).rejects.toThrow('REFUND_DETAILS_MISMATCH');expect(saved()).toMatchObject({status:'captured'});
 });
 it('rejects replay if a persisted refund denomination was corrupted',async()=>{
  await authorizePayment(db,'eur-job',0);await capturePayment(db,'eur-job');await refundCapturedPayment(db,'eur-job');db.exec("UPDATE payment_refunds SET currency='RON'");
  expect(()=>applyStripeRefund(db,paymentId,refund())).toThrow('REFUND_DETAILS_MISMATCH');
 });
 it('rejects unknown stored currencies and missing EUR minor amounts',()=>{
  expect(()=>moneyFromPayment({currency:'USD',amount_gross:500,amount_net:410,commission_amount:90})).toThrow('PAYMENT_CURRENCY_INVALID');
  expect(()=>moneyFromPayment({currency:'EUR',amount_gross:123.45,amount_net:101.23,commission_amount:22.22})).toThrow('PAYMENT_AMOUNT_INVALID');
 });
 it('creates a new EUR recipient only from the stored verified firm country, never the visitor IP',async()=>{
  db.exec("UPDATE firms SET stripe_account_id=NULL WHERE id='eur-f'");api.v2.core.accounts.create.mockResolvedValue({id:'acct_new_eur'});
  await createOrReuseRecipientAccount(db,'eur-u');expect(api.v2.core.accounts.create.mock.calls[0][0]).toMatchObject({identity:{country:'ES'},defaults:{currency:'eur'}});
 });
 it('does not create a foreign recipient when international rollout is disabled',async()=>{
  db.exec("UPDATE firms SET stripe_account_id=NULL WHERE id='eur-f'");vi.stubEnv('NITIDO_ENABLE_INTERNATIONAL_PRICING','false');
  await expect(createOrReuseRecipientAccount(db,'eur-u')).rejects.toThrow('INTERNATIONAL_PRICING_DISABLED');expect(api.v2.core.accounts.create).not.toHaveBeenCalled();
 });
});
