import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import Database from 'better-sqlite3';
import {createHash} from 'node:crypto';
import {initializeDatabase} from './db';
import {acceptJobAtomic} from './acceptJob';
import {markArrivedWithProof,markCompletedWithProof} from './proofOfWork';
import {capturePayment} from './payments';

const api=vi.hoisted(()=>({paymentIntents:{create:vi.fn(),retrieve:vi.fn(),capture:vi.fn()},transfers:{create:vi.fn()}}));
vi.mock('stripe',()=>({default:class {paymentIntents=api.paymentIntents;transfers=api.transfers}}));
const paymentId=`pay_${createHash('sha256').update('lifecycle-job').digest('hex')}`;
const authorized={id:'pi_lifecycle',currency:'ron',amount:50000,amount_capturable:50000,amount_received:0,status:'requires_capture',metadata:{jobId:'lifecycle-job',paymentId},latest_charge:'ch_lifecycle'};
let db:Database.Database;
function proof(type:'ARRIVAL'|'COMPLETION'){
  db.prepare(`INSERT INTO job_photos(id,job_id,owner_user_id,uploaded_by_firm_id,proof_type,filename,mime_type,file_size,status,validated_at)
    VALUES (?,'lifecycle-job','firm-user','firm',?,'proof.jpg','image/jpeg',100,'VALID',datetime('now'))`).run(type,type);
}
function payment(){return db.prepare('SELECT status,transfer_status,stripe_transfer_id FROM payments WHERE job_id=?').get('lifecycle-job');}
async function finishWithProof(){
  proof('ARRIVAL');expect(markArrivedWithProof(db,'lifecycle-job','firm','firm-user').ok).toBe(true);
  proof('COMPLETION');expect(markCompletedWithProof(db,'lifecycle-job','firm','firm-user').ok).toBe(true);
  await capturePayment(db,'lifecycle-job');
}
beforeEach(()=>{
  vi.resetAllMocks();vi.stubEnv('STRIPE_SECRET_KEY','sk_test_lifecycle_mock');vi.stubEnv('NITIDO_STRIPE_CONNECT_TRANSFERS_ENABLED','false');
  db=new Database(':memory:');initializeDatabase(db);
  db.exec(`INSERT INTO users(id,role,name,stripe_customer_id,stripe_payment_method_id) VALUES ('client','client','Test Client','cus_lifecycle','pm_lifecycle'),('firm-user','firma','Test Firm',NULL,NULL);
    INSERT INTO firms(id,user_id,coverage_city,verified,stripe_account_id,stripe_account_status,stripe_transfers_capability) VALUES ('firm','firm-user','Constanța',1,'acct_lifecycle','ready','active');
    INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status) VALUES ('lifecycle-job','client','Test','Constanța',50,'apartament','asap',500,120,'waiting');`);
  api.paymentIntents.create.mockResolvedValue(authorized);api.paymentIntents.retrieve.mockResolvedValue(authorized);
  api.paymentIntents.capture.mockResolvedValue({...authorized,status:'succeeded',amount_capturable:0,amount_received:50000});
  api.transfers.create.mockResolvedValue({id:'tr_lifecycle'});
});
afterEach(()=>{db.close();vi.unstubAllEnvs();});
describe('acceptance → card HOLD → valid completion → capture → optional Connect transfer (mock Stripe)',()=>{
  it('holds on acceptance, blocks early/missing-proof capture and captures once after valid completion',async()=>{
    expect(await acceptJobAtomic(db,'lifecycle-job','firm')).toEqual({ok:true});
    expect(api.paymentIntents.create.mock.calls[0][0]).toMatchObject({capture_method:'manual',confirm:true,amount:50000,currency:'ron'});
    expect(payment()).toMatchObject({status:'authorized'});expect(api.paymentIntents.capture).not.toHaveBeenCalled();expect(api.transfers.create).not.toHaveBeenCalled();
    await expect(capturePayment(db,'lifecycle-job')).rejects.toThrow('PAYMENT_CAPTURE_BLOCKED_MISSING_COMPLETION_PROOF');
    proof('ARRIVAL');expect(markArrivedWithProof(db,'lifecycle-job','firm','firm-user').ok).toBe(true);
    expect(markCompletedWithProof(db,'lifecycle-job','firm','firm-user').ok).toBe(false);
    expect(payment()).toMatchObject({status:'authorized'});expect(api.paymentIntents.capture).not.toHaveBeenCalled();
    proof('COMPLETION');expect(markCompletedWithProof(db,'lifecycle-job','firm','firm-user').ok).toBe(true);
    await capturePayment(db,'lifecycle-job');await capturePayment(db,'lifecycle-job');
    expect(api.paymentIntents.capture).toHaveBeenCalledTimes(1);
    expect(payment()).toEqual({status:'captured',transfer_status:'blocked',stripe_transfer_id:null});expect(api.transfers.create).not.toHaveBeenCalled();
  });
  it('requests the firm transfer in the completion call only when explicitly enabled and the account is ready',async()=>{
    vi.stubEnv('NITIDO_STRIPE_CONNECT_TRANSFERS_ENABLED','true');
    expect(await acceptJobAtomic(db,'lifecycle-job','firm')).toEqual({ok:true});expect(api.transfers.create).not.toHaveBeenCalled();
    await finishWithProof();
    expect(api.transfers.create).toHaveBeenCalledWith({amount:41000,currency:'ron',destination:'acct_lifecycle',source_transaction:'ch_lifecycle',metadata:{jobId:'lifecycle-job',paymentId}},{idempotencyKey:'nitido-transfer-lifecycle-job'});
    expect(payment()).toEqual({status:'captured',transfer_status:'processed',stripe_transfer_id:'tr_lifecycle'});
    await capturePayment(db,'lifecycle-job');expect(api.transfers.create).toHaveBeenCalledTimes(1);
  });
  it('preserves successful capture but records a failed firm transfer separately',async()=>{
    vi.stubEnv('NITIDO_STRIPE_CONNECT_TRANSFERS_ENABLED','true');api.transfers.create.mockRejectedValue(Error('provider timeout'));
    expect(await acceptJobAtomic(db,'lifecycle-job','firm')).toEqual({ok:true});await finishWithProof();
    expect(payment()).toEqual({status:'captured',transfer_status:'failed',stripe_transfer_id:null});
    expect(db.prepare("SELECT COUNT(*) n FROM workflow_audit_log WHERE event_type='PAYMENT_TRANSFER_FAILED'").get()).toEqual({n:1});
  });
});
