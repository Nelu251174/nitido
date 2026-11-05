import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import Sqlite from 'better-sqlite3';
import type Stripe from 'stripe';
import {createHash} from 'node:crypto';
import {SCHEMA_SQL} from './db';
import {cardConfirmation} from './cardConfirmation';
let db:Sqlite.Database;
const retrieve=vi.fn(),stripe={paymentIntents:{retrieve}} as unknown as Stripe;
function intent(extra:Record<string,unknown>={}){return {id:'pi_test',amount:50000,currency:'ron',customer:'cus_test',payment_method:'pm_test',capture_method:'manual',metadata:{jobId:'j',paymentId:'p'},status:'requires_action',amount_received:0,latest_charge:{id:'ch_test',payment_method_details:{card:{capture_before:Math.floor(Date.now()/1000)+7*86400}}},client_secret:'fixture_client_secret',...extra};}
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('STRIPE_SECRET_KEY','sk_test_fixture');vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY','pk_test_fixture');db=new Sqlite(':memory:');db.exec(SCHEMA_SQL);db.exec("ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;INSERT INTO users(id,role,name,stripe_customer_id) VALUES('u','client','Client','cus_test');INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status) VALUES('j','u','Test','Test',50,'apartament','asap',500,120,'waiting')");db.prepare("INSERT INTO payment_authorization_attempts(job_id,request_json,provider_key_hash,created_ms,stripe_payment_intent_id,status) VALUES(?,?,?,1,'pi_test','requires_action')").run('j',JSON.stringify({amount:50000,currency:'ron',customer:'cus_test',payment_method:'pm_test',metadata:{paymentId:'p',jobId:'j'}}),createHash('sha256').update('sk_test_fixture').digest('hex'));retrieve.mockResolvedValue(intent());});
afterEach(()=>{db.close();vi.unstubAllEnvs()});
describe('owner-bound 3DS confirmation',()=>{
 it('blocks confirmation of a waiting job with a durable cancellation request',async()=>{
   db.exec("INSERT INTO payment_cancellation_requests(job_id) VALUES('j')");
   await expect(cardConfirmation(db,stripe,'u','j','start')).rejects.toThrow('schimbat');expect(retrieve).not.toHaveBeenCalled();
 });
 it('does not persist a full hold after cancellation was requested during provider retrieval',async()=>{
   retrieve.mockImplementation(async()=>{db.exec("INSERT INTO payment_cancellation_requests(job_id) VALUES('j')");return intent({status:'requires_capture',amount_capturable:50000});});
   await expect(cardConfirmation(db,stripe,'u','j','verify')).rejects.toThrow('schimbat');expect(db.prepare('SELECT * FROM payments').all()).toHaveLength(0);
 });
 it('returns confirmation credentials only for the booking owner',async()=>{await expect(cardConfirmation(db,stripe,'other','j','start')).rejects.toThrow('găsită');expect(retrieve).not.toHaveBeenCalled();const result=await cardConfirmation(db,stripe,'u','j','start');expect(result).toMatchObject({status:'requires_action',amountMinor:50000,clientSecret:'fixture_client_secret',paymentMethodId:'pm_test'});expect(db.prepare('SELECT * FROM payments').all()).toHaveLength(0)});
 it('does not return the secret during verification',async()=>{expect(await cardConfirmation(db,stripe,'u','j','verify')).toEqual({status:'requires_action',amountMinor:50000})});
 it('persists only a server-confirmed full hold, idempotently, without allocating a firm',async()=>{retrieve.mockResolvedValue(intent({status:'requires_capture',amount_capturable:50000}));await cardConfirmation(db,stripe,'u','j','verify');await cardConfirmation(db,stripe,'u','j','verify');expect(db.prepare('SELECT status,amount_gross FROM payments').all()).toEqual([{status:'authorized',amount_gross:500}]);expect(db.prepare('SELECT status,accepted_firm_id FROM jobs').get()).toEqual({status:'waiting',accepted_firm_id:null})});
 it.each([{customer:'cus_other'},{amount:49000},{currency:'eur'},{capture_method:'automatic'},{metadata:{jobId:'other',paymentId:'p'}},{payment_method:'pm_other'}])('rejects inconsistent intent %j',async mismatch=>{retrieve.mockResolvedValue(intent(mismatch));await expect(cardConfirmation(db,stripe,'u','j','start')).rejects.toThrow();expect(db.prepare('SELECT * FROM payments').all()).toHaveLength(0)});
 it('does not claim a processing payment succeeded',async()=>{retrieve.mockResolvedValue(intent({status:'processing'}));await expect(cardConfirmation(db,stripe,'u','j','verify')).rejects.toThrow();expect(db.prepare('SELECT * FROM payments').all()).toHaveLength(0)});
 it('rejects cancelled bookings before reading Stripe',async()=>{db.exec("UPDATE jobs SET status='cancelled'");await expect(cardConfirmation(db,stripe,'u','j','start')).rejects.toThrow();expect(retrieve).not.toHaveBeenCalled()});
 it('rechecks booking changes after the provider call',async()=>{retrieve.mockImplementation(async()=>{db.exec("UPDATE jobs SET status='cancelled'");return intent()});await expect(cardConfirmation(db,stripe,'u','j','start')).rejects.toThrow('schimbat')});
 it('rejects mixed live/test public keys',async()=>{vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY','pk_live_fixture');await expect(cardConfirmation(db,stripe,'u','j','start')).rejects.toThrow('configurată')});
 it('allows authentication_required on a saved card, but not an ordinary card decline',async()=>{retrieve.mockResolvedValue(intent({status:'requires_payment_method',last_payment_error:{code:'authentication_required'}}));expect(await cardConfirmation(db,stripe,'u','j','start')).toHaveProperty('clientSecret');retrieve.mockResolvedValue(intent({status:'requires_payment_method',last_payment_error:{code:'card_declined'}}));await expect(cardConfirmation(db,stripe,'u','j','start')).rejects.toThrow()});
});

describe('EUR SCA uses the immutable quote and verified provider',()=>{
 const eurPrice={currency:'EUR',countryCode:'FR',city:'Paris',tariffId:'synthetic-fr',revision:1,recordedAt:'2030-09-12T08:00:00Z',netMinor:10001,vatMinor:2000,vatBps:2000,grossMinor:12001,creditMinor:0,clientTotalMinor:12001,durationMinutes:180,workers:2,personMinutes:360,lines:[{code:'cleaning',amountMinor:10001},{code:'vat',amountMinor:2000}]};
 async function eur(){
  db.close();db=new Sqlite(':memory:');
  const {initializeDatabase}=await import('./db');initializeDatabase(db);
  vi.spyOn(Date,'now').mockReturnValue(Date.parse('2030-09-12T08:00:00Z'));
  vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro');vi.stubEnv('NITIDO_ENABLE_INTERNATIONAL_PRICING','true');
  db.exec("INSERT INTO users(id,role,name,stripe_customer_id) VALUES('u','client','Synthetic','cus_test'),('f-user','firma','Synthetic provider',NULL);INSERT INTO firms(id,user_id,coverage_city,verified,stripe_account_id,stripe_account_status,stripe_transfers_capability,stripe_identity_country,stripe_default_currency) VALUES('f','f-user','Paris',1,'acct_synthetic','ready','active','FR','EUR');INSERT INTO workspace_teams(id,firm_id,name) VALUES('team','f','Synthetic team');INSERT INTO international_team_capacity(team_id,firm_id,verified_workers,verified_by,verified_at,valid_until,verification_reference) VALUES('team','f',2,'bootstrap_admin','2030-01-01','2031-01-01','synthetic-evidence');");
  db.prepare("INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,buffer_minutes,status,pricing_snapshot) VALUES('j','u','Synthetic','Paris',50,'apartament','asap',120.01,180,30,'waiting',?)").run(JSON.stringify(eurPrice));
  db.prepare("INSERT INTO payment_authorization_attempts(job_id,request_json,provider_key_hash,created_ms,stripe_payment_intent_id,status) VALUES('j',?,?,1,'pi_test','requires_action')").run(JSON.stringify({amount:12001,currency:'eur',customer:'cus_test',payment_method:'pm_test',metadata:{paymentId:'p',jobId:'j',firmId:'f'}}),createHash('sha256').update('sk_test_fixture').digest('hex'));
  retrieve.mockResolvedValue(intent({amount:12001,currency:'eur',metadata:{paymentId:'p',jobId:'j',firmId:'f'}}));
 }
 afterEach(()=>vi.restoreAllMocks());
 it('returns EUR exact cents and persists a confirmed hold idempotently',async()=>{
  await eur();expect(await cardConfirmation(db,stripe,'u','j','verify')).toEqual({status:'requires_action',amountMinor:12001,currency:'EUR'});
  retrieve.mockResolvedValue(intent({amount:12001,currency:'eur',metadata:{paymentId:'p',jobId:'j',firmId:'f'},status:'requires_capture',amount_capturable:12001}));
  await cardConfirmation(db,stripe,'u','j','verify');await cardConfirmation(db,stripe,'u','j','verify');
  expect(db.prepare('SELECT currency,amount_gross_minor,amount_net_minor,commission_amount_minor FROM payments').all()).toEqual([{currency:'EUR',amount_gross_minor:12001,amount_net_minor:9841,commission_amount_minor:2160}]);
 });
 it.each(["stripe_default_currency='RON'","stripe_identity_country='RO'","stripe_transfers_capability='inactive'","coverage_city='Berlin'","suspended_until='2031-01-01'"])('rejects provider identity change before Stripe: %s',async mutation=>{await eur();db.exec('UPDATE firms SET '+mutation);await expect(cardConfirmation(db,stripe,'u','j','start')).rejects.toThrow('eligibilă');expect(retrieve).not.toHaveBeenCalled();});
 it('rejects revoked crew before returning authentication credentials',async()=>{await eur();retrieve.mockImplementation(async()=>{db.exec("UPDATE international_team_capacity SET revoked_at='2030-09-12'");return intent({amount:12001,currency:'eur',metadata:{paymentId:'p',jobId:'j',firmId:'f'}})});await expect(cardConfirmation(db,stripe,'u','j','start')).rejects.toThrow('eligibilă');expect(db.prepare('SELECT * FROM payments').all()).toHaveLength(0);});
 it('rejects crew revocation during coverage expansion before saving money',async()=>{await eur();const held=intent({amount:12001,currency:'eur',metadata:{paymentId:'p',jobId:'j',firmId:'f'},status:'requires_capture',amount_capturable:12001});retrieve.mockResolvedValueOnce(held).mockImplementation(async()=>{db.exec("UPDATE international_team_capacity SET revoked_at='2030-09-12'");return held;});await expect(cardConfirmation(db,stripe,'u','j','verify')).rejects.toThrow('eligibilă');expect(db.prepare('SELECT * FROM payments').all()).toHaveLength(0);});
 it('rejects a RON intent for an EUR request and an unpinned EUR attempt',async()=>{await eur();retrieve.mockResolvedValue(intent({amount:12001,currency:'ron',metadata:{paymentId:'p',jobId:'j',firmId:'f'}}));await expect(cardConfirmation(db,stripe,'u','j','verify')).rejects.toThrow('corespund');db.exec("UPDATE payment_authorization_attempts SET request_json=json_remove(request_json,'$.metadata.firmId')");retrieve.mockClear();await expect(cardConfirmation(db,stripe,'u','j','start')).rejects.toThrow('eligibilă');expect(retrieve).not.toHaveBeenCalled();});
 it('refuses a replay whose persisted minor split is corrupt',async()=>{await eur();const held=intent({amount:12001,currency:'eur',metadata:{paymentId:'p',jobId:'j',firmId:'f'},status:'requires_capture',amount_capturable:12001});retrieve.mockResolvedValue(held);await cardConfirmation(db,stripe,'u','j','verify');db.exec('UPDATE payments SET amount_net_minor=9840,commission_amount_minor=2161');await expect(cardConfirmation(db,stripe,'u','j','verify')).rejects.toThrow('reconciliere');expect(db.prepare('SELECT COUNT(*) n FROM payments').get()).toEqual({n:1});});
});
