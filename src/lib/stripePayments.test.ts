import {afterEach,describe,expect,it} from "vitest";
import DatabaseCtor from "better-sqlite3";
import {SCHEMA_SQL} from "./db";
import {calculatePaymentSplit,capturePayment,initiateFirmTransfer,recordStripeEvent,refundCapturedPayment} from "./payments";
import fs from "node:fs";

function setup(){
  const db=new DatabaseCtor(":memory:");db.exec(SCHEMA_SQL);
  db.exec(`INSERT INTO users(id,role,name) VALUES('client','client','Client'),('firm_user','firma','Firmă'),('other_user','firma','Altă firmă');
    INSERT INTO firms(id,user_id,coverage_city,verified,stripe_account_id,stripe_account_status,stripe_transfers_capability) VALUES('firm','firm_user','Constanța',1,'acct_authoritative','ready','active'),('other','other_user','Constanța',1,'acct_other','ready','active');
    INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status,accepted_firm_id) VALUES('job','client','Secret','Constanța',50,'apartament','asap',500,120,'completed','firm');
    INSERT INTO payments(id,job_id,amount_gross,commission_amount,amount_net,status) VALUES('pay','job',500,90,410,'captured');
    INSERT INTO job_photos(id,job_id,owner_user_id,uploaded_by_firm_id,proof_type,filename,mime_type,file_size,status,validated_at) VALUES('arrival','job','firm_user','firm','ARRIVAL','a.jpg','image/jpeg',10,'VALID',datetime('now')),('completion','job','firm_user','firm','COMPLETION','c.jpg','image/jpeg',10,'VALID',datetime('now'));`);
  return db;
}

afterEach(()=>{delete process.env.NITIDO_STRIPE_CONNECT_TRANSFERS_ENABLED;delete process.env.STRIPE_SECRET_KEY;});

describe("Stripe split architecture",()=>{
  it("derives the configured 18/82 split server-side",()=>expect(calculatePaymentSplit(500)).toEqual({clientAmount:500,firmAmount:410,platformAmount:90}));
  it("absorbs referral credit from the platform share, not firm payout",()=>expect(calculatePaymentSplit(500,20)).toEqual({clientAmount:480,firmAmount:410,platformAmount:70}));
  it("does not transfer before completed state",async()=>{const db=setup();db.prepare("UPDATE jobs SET status='arrived' WHERE id='job'").run();await expect(initiateFirmTransfer(db,"job")).rejects.toThrow("TRANSFER_BLOCKED_JOB_NOT_COMPLETED");db.close();});
  it("keeps real transfers disabled without OWNER activation",async()=>{const db=setup();expect(await initiateFirmTransfer(db,"job")).toBe("blocked");expect((db.prepare("SELECT stripe_transfer_id FROM payments WHERE id='pay'").get() as {stripe_transfer_id:null}).stripe_transfer_id).toBeNull();db.close();});
  it("deduplicates webhook event IDs",()=>{const db=setup();expect(recordStripeEvent(db,"evt_1","payment_intent.succeeded")).toBe(true);expect(recordStripeEvent(db,"evt_1","payment_intent.succeeded")).toBe(false);db.close();});
  it("makes local full refund idempotent",async()=>{const db=setup();await refundCapturedPayment(db,"job");await refundCapturedPayment(db,"job");expect((db.prepare("SELECT COUNT(*) c FROM payment_refunds").get() as {c:number}).c).toBe(1);db.close();});
  it("does not duplicate capture or transfer on replay",async()=>{const db=setup();db.prepare("UPDATE payments SET status='authorized' WHERE id='pay'").run();await capturePayment(db,"job");await capturePayment(db,"job");expect((db.prepare("SELECT status,transfer_status FROM payments WHERE id='pay'").get() as {status:string;transfer_status:string})).toEqual({status:"captured",transfer_status:"blocked"});db.close();});
  it("never accepts price, payout, or destination from API request bodies",()=>{const jobRoute=fs.readFileSync("src/app/api/jobs/route.ts","utf8");const paymentCode=fs.readFileSync("src/lib/payments.ts","utf8");expect(jobRoute).toContain("calcGrossPrice(spaceType, sqm)");expect(paymentCode).not.toMatch(/body\.(amount|payout|destination)|application_fee_amount|transfer_data/);expect(paymentCode).toContain("destination:String(row.stripe_account_id)");});
  it("shows client total and firm server-derived payout without exposing secrets",()=>{const client=fs.readFileSync("src/app/client/page.tsx","utf8");const firm=fs.readFileSync("src/app/firma/page.tsx","utf8");expect(client).toContain("job?.price_gross");expect(firm).toContain("Valoare lucrare: {job.price_gross} lei");expect(firm).toContain("calcNetForFirm(job.price_gross)");expect(client+firm).not.toMatch(/STRIPE_SECRET_KEY|client_secret/);});
});
