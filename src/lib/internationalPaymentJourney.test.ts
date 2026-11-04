import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import Database from 'better-sqlite3';
import type Stripe from 'stripe';
import {internationalJobFixture,internationalFixtureNow} from './testFixtures/internationalJob';
import {createInternationalJob} from './internationalJobCreation';
import {createOffer,selectOffer} from './offers';
import {capturePayment,refundCapturedPayment} from './payments';
import {jobExecutionRules,jobPhotoRules,freezeExecutionRules} from './executionTemplates';
import {markArrivedWithProof,markCompletedWithProof} from './proofOfWork';
import {processStripeEvent} from './stripeEventProcessor';
import {reconcileSandboxPayout} from './payoutReconciliation';

const api=vi.hoisted(()=>({paymentIntents:{create:vi.fn(),retrieve:vi.fn(),capture:vi.fn(),cancel:vi.fn()},transfers:{create:vi.fn(),retrieve:vi.fn(),createReversal:vi.fn()},refunds:{create:vi.fn(),retrieve:vi.fn()},balanceTransactions:{retrieve:vi.fn(),list:vi.fn()},charges:{retrieve:vi.fn()},payouts:{retrieve:vi.fn()}}));
vi.mock('stripe',()=>({default:class {paymentIntents=api.paymentIntents;transfers=api.transfers;refunds=api.refunds;balanceTransactions=api.balanceTransactions;charges=api.charges;payouts=api.payouts}}));

let db:Database.Database,fixture:ReturnType<typeof internationalJobFixture>,intent:Stripe.PaymentIntent;
let refundStatus:'pending'|'succeeded';
const gross=30976,firmShare=25400,commission=5576;
const provider=()=>api as unknown as Stripe;
function storedPayment(jobId:string){return db.prepare('SELECT * FROM payments WHERE job_id=?').get(jobId) as Record<string,unknown>;}
function providerRefund(){return {id:'re_synthetic_journey',object:'refund',payment_intent:intent.id,currency:'eur',amount:gross,status:refundStatus,livemode:false} as unknown as Stripe.Refund;}
function event(id:string,type:Stripe.Event.Type,object:Record<string,unknown>):Stripe.Event{return {id,type,livemode:false,created:Math.floor(Date.now()/1000),data:{object}} as unknown as Stripe.Event;}
function addProof(jobId:string,type:'ARRIVAL'|'COMPLETION'){
 const rules=jobPhotoRules(db,jobId),count=type==='ARRIVAL'?rules.arrivalMin:rules.completionMin;
 for(let n=0;n<count;n++)db.prepare("INSERT INTO job_photos(id,job_id,owner_user_id,uploaded_by_firm_id,proof_type,filename,mime_type,file_size,status,validated_at) VALUES(?,?,'synthetic-firm-owner','synthetic-firm',?,?, 'image/jpeg',10,'VALID',?)").run(`${type}-${n}`,jobId,type,`${type}-${n}.jpg`,new Date().toISOString());
}
async function acceptedJob(){
 const first=createInternationalJob(db,'synthetic-owner',fixture.body,internationalFixtureNow);
 expect(createInternationalJob(db,'synthetic-owner',fixture.body,internationalFixtureNow)).toMatchObject({replayed:true,booking:first.booking});
 expect(api.paymentIntents.create).not.toHaveBeenCalled();
 const offer=createOffer(db,first.booking.id,'synthetic-firm');if(!offer.ok)throw Error(offer.error);
 expect(await selectOffer(db,first.booking.id,offer.offerId,'synthetic-other')).toMatchObject({ok:false,status:403});
 expect(api.paymentIntents.create).not.toHaveBeenCalled();
 expect(await selectOffer(db,first.booking.id,offer.offerId,'synthetic-owner')).toEqual({ok:true});
 expect(db.prepare('SELECT status FROM offers WHERE id=?').get(offer.offerId)).toEqual({status:'accepted'});
 expect(db.prepare('SELECT currency,amount_gross_minor,status FROM selection_confirmations WHERE job_id=?').get(first.booking.id)).toMatchObject({currency:'EUR',amount_gross_minor:gross,status:'confirmed'});
 expect(db.prepare('SELECT team_id FROM workspace_assignments WHERE job_id=?').get(first.booking.id)).toEqual({team_id:'synthetic-team'});
 return first.booking.id;
}
function completeJob(jobId:string){
 expect(markArrivedWithProof(db,jobId,'synthetic-firm','synthetic-firm-owner')).toMatchObject({ok:false});
 addProof(jobId,'ARRIVAL');vi.setSystemTime(new Date('2026-11-03T09:00:00Z'));
 expect(markArrivedWithProof(db,jobId,'synthetic-firm','synthetic-firm-owner')).toEqual({ok:true});
 expect(markCompletedWithProof(db,jobId,'synthetic-firm','synthetic-firm-owner')).toMatchObject({ok:false});
 addProof(jobId,'COMPLETION');
 for(const item of jobExecutionRules(db,jobId).items)db.prepare('INSERT INTO workspace_checklist(job_id,item_key,done,updated_by,updated_at) VALUES(?,?,1,?,?)').run(jobId,item.key,'synthetic-firm-owner',new Date().toISOString());
 vi.setSystemTime(new Date('2026-11-03T12:00:00Z'));
 expect(markCompletedWithProof(db,jobId,'synthetic-firm','synthetic-firm-owner')).toEqual({ok:true});
}
beforeEach(()=>{
 vi.useFakeTimers();vi.setSystemTime(internationalFixtureNow);vi.resetAllMocks();
 vi.stubEnv('NODE_ENV','test');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro');vi.stubEnv('NITIDO_ENABLE_INTERNATIONAL_PRICING','true');vi.stubEnv('NITIDO_INTERNATIONAL_REVIEW_ENABLED','true');vi.stubEnv('NITIDO_STRIPE_CONNECT_TRANSFERS_ENABLED','true');vi.stubEnv('STRIPE_SECRET_KEY','sk_test_synthetic_journey_only');
 vi.stubGlobal('fetch',vi.fn(()=>{throw Error('EXTERNAL_TRANSPORT_FORBIDDEN');}));
 db=new Database(':memory:');fixture=internationalJobFixture(db);refundStatus='pending';
 api.paymentIntents.create.mockImplementation(async(params:Stripe.PaymentIntentCreateParams)=>{
  intent={...params,id:'pi_synthetic_journey',object:'payment_intent',livemode:false,status:'requires_capture',amount_received:0,amount_capturable:params.amount,metadata:params.metadata,latest_charge:{id:'ch_synthetic_journey',payment_method_details:{card:{capture_before:Date.parse('2026-11-05T08:00:00Z')/1000}}}} as unknown as Stripe.PaymentIntent;
  return structuredClone(intent);
 });
 api.paymentIntents.retrieve.mockImplementation(async()=>structuredClone(intent));
 api.paymentIntents.capture.mockImplementation(async()=>{intent={...intent,status:'succeeded',amount_received:intent.amount,amount_capturable:0};return structuredClone(intent);});
 api.paymentIntents.cancel.mockImplementation(async()=>{intent={...intent,status:'canceled',amount_capturable:0};return structuredClone(intent);});
 api.transfers.create.mockImplementation(async(params:Stripe.TransferCreateParams)=>({id:'tr_synthetic_journey',livemode:false,...params}));
 api.transfers.createReversal.mockResolvedValue({id:'trr_synthetic_journey',amount:firmShare,transfer:'tr_synthetic_journey'});
 api.refunds.create.mockImplementation(async()=>providerRefund());api.refunds.retrieve.mockImplementation(async()=>providerRefund());
 api.balanceTransactions.retrieve.mockResolvedValue({id:'txn_platform',source:'ch_synthetic_journey',amount:gross,fee:900,currency:'eur'});
 api.payouts.retrieve.mockResolvedValue({id:'po_synthetic_journey',amount:firmShare,currency:'eur',status:'paid',automatic:true,reconciliation_status:'completed',livemode:false});
 api.balanceTransactions.list.mockResolvedValue({data:[{id:'txn_recipient',source:'py_synthetic_journey',type:'payment',amount:firmShare,fee:0,net:firmShare,currency:'eur'}],has_more:false});
 api.charges.retrieve.mockResolvedValue({id:'py_synthetic_journey',balance_transaction:'txn_recipient',source_transfer:'tr_synthetic_journey',amount:firmShare,currency:'eur',livemode:false});
 api.transfers.retrieve.mockResolvedValue({id:'tr_synthetic_journey',destination:'acct_fixture',destination_payment:'py_synthetic_journey',source_transaction:'ch_synthetic_journey',amount:firmShare,currency:'eur',livemode:false,reversed:false,amount_reversed:0});
});
afterEach(()=>{db.close();vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals();});

describe('isolated integrated EUR journey — simulated Stripe, never a real sandbox payment',()=>{
 it('connects the owned quote, actual crew, completion proof, capture, fee event, payout and refund replay in exact EUR cents',async()=>{
  const jobId=await acceptedJob(),snapshot=db.prepare('SELECT pricing_snapshot FROM jobs WHERE id=?').get(jobId);
  expect(api.paymentIntents.create).toHaveBeenCalledTimes(1);
  expect(api.paymentIntents.create.mock.calls[0][0]).toMatchObject({amount:gross,currency:'eur',capture_method:'manual',metadata:{jobId,firmId:'synthetic-firm',pricingSource:'server'}});
  expect(storedPayment(jobId)).toMatchObject({status:'authorized',currency:'EUR',amount_gross_minor:gross,amount_net_minor:firmShare,commission_amount_minor:commission});
  await expect(capturePayment(db,jobId)).rejects.toThrow('PAYMENT_CAPTURE_BLOCKED_MISSING_COMPLETION_PROOF');
  expect(api.paymentIntents.capture).not.toHaveBeenCalled();completeJob(jobId);
  vi.stubEnv('NITIDO_ENABLE_INTERNATIONAL_PRICING','false');
  await capturePayment(db,jobId);await capturePayment(db,jobId);
  expect(api.paymentIntents.capture).toHaveBeenCalledTimes(1);expect(api.transfers.create).toHaveBeenCalledTimes(1);
  expect(api.transfers.create.mock.calls[0][0]).toMatchObject({amount:firmShare,currency:'eur',destination:'acct_fixture',source_transaction:'ch_synthetic_journey'});
  const chargeEvent=event('evt_charge_journey','charge.succeeded',{id:'ch_synthetic_journey',payment_intent:intent.id,balance_transaction:'txn_platform',currency:'eur',amount:gross});
  await processStripeEvent(db,provider(),chargeEvent);await processStripeEvent(db,provider(),chargeEvent);
  expect(api.balanceTransactions.retrieve).toHaveBeenCalledTimes(1);
  expect(storedPayment(jobId)).toMatchObject({status:'captured',stripe_fee_amount:900,stripe_fee_currency:'EUR',transfer_status:'processed'});
  db.prepare("INSERT INTO stripe_bank_payouts(account_id,payout_id,amount_minor,currency,status,arrival_date) VALUES('acct_fixture','po_synthetic_journey',?,'eur','paid',1)").run(firmShare);
  const beforePayout=db.prepare('SELECT * FROM payments').all();
  expect(await reconcileSandboxPayout(db,provider(),'acct_fixture','po_synthetic_journey')).toMatchObject({status:'matched',currency:'eur',payoutAmountMinor:firmShare,differenceMinor:0,lines:[{jobId,transferCurrency:'eur',settlementCurrency:'eur',issue:null}]});
  expect(db.prepare('SELECT * FROM payments').all()).toEqual(beforePayout);
  expect(await refundCapturedPayment(db,jobId)).toBe('pending');
  expect(storedPayment(jobId)).toMatchObject({status:'captured',refund_status:'pending',transfer_status:'reversed'});
  refundStatus='succeeded';const refundEvent=event('evt_refund_journey','refund.updated',{id:'re_synthetic_journey'});
  await processStripeEvent(db,provider(),refundEvent);expect(await processStripeEvent(db,provider(),refundEvent)).toMatchObject({duplicate:true});
  expect(await refundCapturedPayment(db,jobId)).toBe('succeeded');
  expect(api.refunds.create).toHaveBeenCalledTimes(1);expect(api.transfers.createReversal).toHaveBeenCalledTimes(1);
  expect(api.transfers.createReversal.mock.calls[0][1]).toEqual({amount:firmShare});
  expect(storedPayment(jobId)).toMatchObject({status:'refunded',refund_status:'succeeded',currency:'EUR',amount_gross_minor:gross,amount_net_minor:firmShare});
  expect(db.prepare('SELECT COUNT(*) n FROM jobs').get()).toEqual({n:1});expect(db.prepare('SELECT COUNT(*) n FROM payments').get()).toEqual({n:1});
  expect(db.prepare('SELECT pricing_snapshot FROM jobs WHERE id=?').get(jobId)).toEqual(snapshot);
  const afterRefund=await reconcileSandboxPayout(db,provider(),'acct_fixture','po_synthetic_journey');
  expect(afterRefund.status).toBe('needs_review');expect(afterRefund.issues).toContain('UNRESOLVED_LINES');
  expect(fetch).not.toHaveBeenCalled();
 });
 it('keeps Romanian ledger money and marks a simulated source-currency transfer rejection explicitly, with fees still in EUR',async()=>{
  vi.stubEnv('NITIDO_ENABLE_INTERNATIONAL_PRICING','false');
  db.exec("UPDATE firms SET coverage_city='Constanța',stripe_identity_country='RO',stripe_default_currency='RON' WHERE id='synthetic-firm'");
  const ronSnapshot=JSON.stringify({currency:'RON',recordedAt:internationalFixtureNow.toISOString(),grossBani:55000,creditBani:2000,clientTotalBani:53000,lines:[{code:'cleaning',amountBani:55000},{code:'express60',amountBani:0},{code:'platform_credit',amountBani:-2000}]});
  db.prepare("INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,scheduled_at,price_gross,credit_applied,duration_minutes,buffer_minutes,status,mode,pricing_snapshot) VALUES('synthetic-ron','synthetic-owner','Synthetic RO','Constanța',70,'apartament','scheduled','2026-11-03T09:00:00Z',550,20,180,30,'waiting','standard',?)").run(ronSnapshot);
  db.transaction(()=>freezeExecutionRules(db,'synthetic-ron','standard',undefined,'maintenance')).immediate();
  const offer=createOffer(db,'synthetic-ron','synthetic-firm');if(!offer.ok)throw Error(offer.error);
  expect(await selectOffer(db,'synthetic-ron',offer.offerId,'synthetic-owner')).toEqual({ok:true});
  expect(api.paymentIntents.create.mock.calls[0][0]).toMatchObject({amount:53000,currency:'ron'});
  expect(storedPayment('synthetic-ron')).toMatchObject({currency:'RON',amount_gross_minor:53000,amount_net_minor:45100,commission_amount_minor:7900});
  completeJob('synthetic-ron');
  // Stripe requires a source-linked transfer to use the source balance-transaction currency.
  // This conditional provider rejection is simulated; no actual account settlement was read.
  api.transfers.create.mockRejectedValueOnce(Error('SYNTHETIC_SOURCE_TRANSACTION_CURRENCY_MISMATCH'));
  await capturePayment(db,'synthetic-ron');
  expect(storedPayment('synthetic-ron')).toMatchObject({status:'captured',transfer_status:'failed',stripe_transfer_id:null});
  expect(api.transfers.create.mock.calls[0][0]).toMatchObject({amount:45100,currency:'ron'});
  // Explicitly synthetic settlement numbers, not a measured FX rate or a bank receipt.
  api.balanceTransactions.retrieve.mockResolvedValue({id:'txn_ron_settlement',source:'ch_synthetic_journey',amount:10000,fee:300,currency:'eur'});
  await processStripeEvent(db,provider(),event('evt_ron_charge','charge.succeeded',{id:'ch_synthetic_journey',payment_intent:intent.id,balance_transaction:'txn_ron_settlement',currency:'ron',amount:53000}));
  expect(storedPayment('synthetic-ron')).toMatchObject({status:'captured',transfer_status:'failed',currency:'RON',amount_gross_minor:53000,amount_net_minor:45100,commission_amount_minor:7900,stripe_fee_amount:300,stripe_fee_currency:'EUR'});
  expect(db.prepare('SELECT pricing_snapshot FROM jobs WHERE id=?').get('synthetic-ron')).toEqual({pricing_snapshot:ronSnapshot});
  expect(fetch).not.toHaveBeenCalled();
 });
 it('reuses uncertain authorization identity after acceptance compensation, instead of creating a second logical hold',async()=>{
  const result=createInternationalJob(db,'synthetic-owner',fixture.body,internationalFixtureNow),jobId=result.booking.id;
  const offer=createOffer(db,jobId,'synthetic-firm');if(!offer.ok)throw Error(offer.error);
  api.paymentIntents.create.mockRejectedValueOnce(Error('SYNTHETIC_UNCERTAIN_RESPONSE'));
  expect(await selectOffer(db,jobId,offer.offerId,'synthetic-owner')).toMatchObject({ok:false,status:502});
  expect(db.prepare('SELECT status,accepted_firm_id FROM jobs WHERE id=?').get(jobId)).toEqual({status:'waiting',accepted_firm_id:null});
  expect(db.prepare('SELECT COUNT(*) n FROM workspace_assignments').get()).toEqual({n:0});
  expect(await selectOffer(db,jobId,offer.offerId,'synthetic-owner')).toEqual({ok:true});
  expect(api.paymentIntents.create).toHaveBeenCalledTimes(2);expect(api.paymentIntents.create.mock.calls[0]).toEqual(api.paymentIntents.create.mock.calls[1]);
  expect(db.prepare('SELECT COUNT(*) n FROM payments').get()).toEqual({n:1});expect(fetch).not.toHaveBeenCalled();
 });
 it('holds an uncertain result for reconciliation after the safe retry window instead of creating another authorization',async()=>{
  const result=createInternationalJob(db,'synthetic-owner',fixture.body,internationalFixtureNow),jobId=result.booking.id;
  const offer=createOffer(db,jobId,'synthetic-firm');if(!offer.ok)throw Error(offer.error);
  api.paymentIntents.create.mockRejectedValueOnce(Error('SYNTHETIC_UNCERTAIN_RESPONSE'));
  expect(await selectOffer(db,jobId,offer.offerId,'synthetic-owner')).toMatchObject({ok:false,status:502});
  vi.setSystemTime(new Date(internationalFixtureNow.getTime()+21*3600000));
  expect(await selectOffer(db,jobId,offer.offerId,'synthetic-owner')).toMatchObject({ok:false,status:502});
  expect(api.paymentIntents.create).toHaveBeenCalledTimes(1);
  expect(db.prepare('SELECT status FROM payment_authorization_attempts WHERE job_id=?').get(jobId)).toEqual({status:'reconciliation_required'});
  expect(db.prepare('SELECT status,accepted_firm_id FROM jobs WHERE id=?').get(jobId)).toEqual({status:'waiting',accepted_firm_id:null});
  expect(db.prepare('SELECT COUNT(*) n FROM payments').get()).toEqual({n:0});expect(fetch).not.toHaveBeenCalled();
 });
 it('releases an insufficient hold and refuses an automatic replacement even after acceptance was compensated',async()=>{
  const result=createInternationalJob(db,'synthetic-owner',fixture.body,internationalFixtureNow),jobId=result.booking.id;
  const offer=createOffer(db,jobId,'synthetic-firm');if(!offer.ok)throw Error(offer.error);
  const create=api.paymentIntents.create.getMockImplementation()!;
  api.paymentIntents.create.mockImplementation(async(params:Stripe.PaymentIntentCreateParams)=>{await create(params);intent.latest_charge={id:'ch_synthetic_journey',payment_method_details:{card:{capture_before:Date.parse('2026-11-03T09:01:00Z')/1000}}} as unknown as Stripe.Charge;return structuredClone(intent);});
  expect(await selectOffer(db,jobId,offer.offerId,'synthetic-owner')).toMatchObject({ok:false,code:'HOLD_COVERAGE_UNCONFIRMED'});
  expect(db.prepare('SELECT state,currency,amount_minor FROM authorization_coverage').get()).toEqual({state:'released',currency:'EUR',amount_minor:gross});
  expect(db.prepare('SELECT COUNT(*) n FROM payments').get()).toEqual({n:0});
  expect(await selectOffer(db,jobId,offer.offerId,'synthetic-owner')).toMatchObject({ok:false,code:'HOLD_COVERAGE_UNCONFIRMED'});
  expect(api.paymentIntents.create).toHaveBeenCalledTimes(1);expect(api.paymentIntents.cancel).toHaveBeenCalledTimes(1);expect(fetch).not.toHaveBeenCalled();
 });
});
