import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import DatabaseCtor from "better-sqlite3";
import {SCHEMA_SQL} from "./db";
const api=vi.hoisted(()=>({paymentIntents:{create:vi.fn(),retrieve:vi.fn(),capture:vi.fn(),cancel:vi.fn()}}));
vi.mock('stripe',()=>({default:class {paymentIntents=api.paymentIntents}}));
import {authorizePayment,capturePayment,cancelPayment} from './payments';
function setup(){
  const db=new DatabaseCtor(":memory:");db.exec(SCHEMA_SQL);db.exec("ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;ALTER TABLE users ADD COLUMN stripe_payment_method_id TEXT");
  db.exec(`INSERT INTO users(id,role,name) VALUES('client','client','Client'),('firm_user','firma','Firmă'),('other_user','firma','Altă firmă');
    INSERT INTO firms(id,user_id,coverage_city,verified,stripe_account_id,stripe_account_status,stripe_transfers_capability) VALUES('firm','firm_user','Constanța',1,'acct_authoritative','ready','active'),('other','other_user','Constanța',1,'acct_other','ready','active');
    INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status,accepted_firm_id) VALUES('job','client','Secret','Constanța',50,'apartament','asap',500,120,'completed','firm');
    INSERT INTO payments(id,job_id,amount_gross,commission_amount,amount_net,status) VALUES('pay','job',500,90,410,'captured');
    INSERT INTO job_photos(id,job_id,owner_user_id,uploaded_by_firm_id,proof_type,filename,mime_type,file_size,status,validated_at) VALUES('arrival','job','firm_user','firm','ARRIVAL','a.jpg','image/jpeg',10,'VALID',datetime('now')),('completion','job','firm_user','firm','COMPLETION','c.jpg','image/jpeg',10,'VALID',datetime('now'));`);
  return db;
}

const databases:DatabaseCtor.Database[]=[];
function prepare(){const db=setup();databases.push(db);db.exec("UPDATE payments SET status='authorized',stripe_payment_intent_id='pi_test';UPDATE users SET stripe_customer_id='cus_test',stripe_payment_method_id='pm_test' WHERE id='client'");return db;}
function intent(overrides:Record<string,unknown>={}){return {id:'pi_test',currency:'ron',amount:50000,amount_capturable:50000,amount_received:0,status:'requires_capture',metadata:{jobId:'job',paymentId:'pay'},latest_charge:'ch_test',...overrides};}
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('STRIPE_SECRET_KEY','sk_test_mock');vi.stubEnv('NITIDO_STRIPE_CONNECT_TRANSFERS_ENABLED','false');});
afterEach(()=>{for(const db of databases.splice(0))db.close();vi.unstubAllEnvs();});
describe('provider payment confirmation and recovery',()=>{
 it.each(['requires_action','processing','requires_payment_method'])('does not authorize %s',async status=>{const db=prepare();db.exec('DELETE FROM payments');api.paymentIntents.create.mockResolvedValue(intent({status}));await expect(authorizePayment(db,'job',500)).rejects.toThrow('PAYMENT_AUTHORIZATION_NOT_CONFIRMED');expect(db.prepare('SELECT * FROM payments').all()).toHaveLength(0);});
 it('reuses identical authorization parameters after a network timeout',async()=>{const db=prepare();db.exec('DELETE FROM payments');api.paymentIntents.create.mockRejectedValueOnce(Error('timeout')).mockResolvedValueOnce(intent());await expect(authorizePayment(db,'job',500)).rejects.toThrow('timeout');await authorizePayment(db,'job',500);expect(api.paymentIntents.create.mock.calls[0]).toEqual(api.paymentIntents.create.mock.calls[1]);});
 it('does not reuse cancelled authorization',async()=>{const db=prepare();db.exec("UPDATE payments SET status='cancelled'");await expect(authorizePayment(db,'job',500)).rejects.toThrow('PAYMENT_NOT_AUTHORIZED');expect(api.paymentIntents.create).not.toHaveBeenCalled();});
 it.each(['capture','cancel'])('rejects missing provider ID during %s',async operation=>{const db=prepare();db.exec('UPDATE payments SET stripe_payment_intent_id=NULL');await expect((operation==='capture'?capturePayment:cancelPayment)(db,'job')).rejects.toThrow('STRIPE_PAYMENT_INTENT_MISSING');expect(db.prepare('SELECT status FROM payments').get()).toEqual({status:'authorized'});});
 it('keeps processing capture authorized locally',async()=>{const db=prepare();api.paymentIntents.retrieve.mockResolvedValue(intent());api.paymentIntents.capture.mockResolvedValue(intent({status:'processing'}));await expect(capturePayment(db,'job')).rejects.toThrow('PAYMENT_CAPTURE_NOT_CONFIRMED');expect(db.prepare('SELECT status FROM payments').get()).toEqual({status:'authorized'});});
 it.each([{currency:'eur'},{amount:49900},{metadata:{jobId:'other',paymentId:'pay'}}])('rejects mismatched payment %j',async mismatch=>{const db=prepare();api.paymentIntents.retrieve.mockResolvedValue(intent(mismatch));await expect(capturePayment(db,'job')).rejects.toThrow('PAYMENT_DETAILS_MISMATCH');expect(api.paymentIntents.capture).not.toHaveBeenCalled();});
 it('recovers a capture confirmed by Stripe after an uncertain response',async()=>{const db=prepare();api.paymentIntents.retrieve.mockResolvedValue(intent({status:'succeeded',amount_received:50000,latest_charge:{id:'ch_expanded'}}));await capturePayment(db,'job');await capturePayment(db,'job');expect(api.paymentIntents.capture).not.toHaveBeenCalled();expect(db.prepare('SELECT status,stripe_charge_id FROM payments').get()).toEqual({status:'captured',stripe_charge_id:'ch_expanded'});expect(db.prepare("SELECT * FROM workflow_audit_log WHERE event_type='PAYMENT_CAPTURED'").all()).toHaveLength(1);});
 it('rejects partial capture as full settlement',async()=>{const db=prepare();api.paymentIntents.retrieve.mockResolvedValue(intent({status:'succeeded',amount_received:49000}));await expect(capturePayment(db,'job')).rejects.toThrow('PAYMENT_CAPTURE_NOT_CONFIRMED');});
 it('records a confirmed full capture',async()=>{const db=prepare();api.paymentIntents.retrieve.mockResolvedValue(intent());api.paymentIntents.capture.mockResolvedValue(intent({status:'succeeded',amount_received:50000}));await capturePayment(db,'job');expect(db.prepare('SELECT status FROM payments').get()).toEqual({status:'captured'});expect(api.paymentIntents.capture).toHaveBeenCalledTimes(1);});
});
