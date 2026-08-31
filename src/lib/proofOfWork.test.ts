import DatabaseCtor from "better-sqlite3";
import type { Database } from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { SCHEMA_SQL } from "./db";
import { capturePayment } from "./payments";
import { assertCompletionProof, hasValidWorkProof, markArrivedWithProof, markCompletedWithProof } from "./proofOfWork";

function setup(): Database {
  const db=new DatabaseCtor(":memory:"); db.exec(SCHEMA_SQL);
  db.exec(`INSERT INTO users(id,role,name) VALUES ('client_a','client','Client A'),('client_b','client','Client B'),('user_a','firma','Firma A'),('user_b','firma','Firma B');
    INSERT INTO firms(id,user_id,coverage_city,verified) VALUES ('firm_a','user_a','Constanța',1),('firm_b','user_b','Constanța',1);`);
  return db;
}
function job(db:Database,id:string,status="accepted",firm="firm_a",client="client_a"){
  db.prepare(`INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status,accepted_firm_id)
    VALUES (?,?,'Test','Constanța',50,'apartament','asap',500,120,?,?)`).run(id,client,status,firm);
}
function proof(db:Database,id:string,jobId:string,firmId:string,type:"ARRIVAL"|"COMPLETION",status="VALID"){
  const userId=firmId==="firm_a"?"user_a":"user_b";
  db.prepare(`INSERT INTO job_photos(id,job_id,owner_user_id,uploaded_by_firm_id,proof_type,filename,mime_type,file_size,status,validated_at)
    VALUES (?,?,?,?,?,'proof.jpg','image/jpeg',100,?,datetime('now'))`).run(id,jobId,userId,firmId,type,status);
}

describe("server-authoritative proof-of-work gates",()=>{
  let db:Database; beforeEach(()=>{db=setup();});
  it("blocks arrival without ARRIVAL proof",()=>{job(db,"j1");const r=markArrivedWithProof(db,"j1","firm_a","user_a");expect(r.ok).toBe(false);expect((db.prepare("SELECT status FROM jobs WHERE id='j1'").get() as {status:string}).status).toBe("accepted");});
  it("allows arrival after valid ARRIVAL proof",()=>{job(db,"j1");proof(db,"p1","j1","firm_a","ARRIVAL");expect(markArrivedWithProof(db,"j1","firm_a","user_a").ok).toBe(true);});
  it("does not accept another firm's proof or transition",()=>{job(db,"j1");proof(db,"p1","j1","firm_b","ARRIVAL");expect(hasValidWorkProof(db,"j1","firm_a","ARRIVAL")).toBe(false);expect(markArrivedWithProof(db,"j1","firm_b","user_b").ok).toBe(false);});
  it("blocks completion without COMPLETION proof and records the attempt",()=>{job(db,"j1","arrived");expect(markCompletedWithProof(db,"j1","firm_a","user_a").ok).toBe(false);expect((db.prepare("SELECT status FROM jobs WHERE id='j1'").get() as {status:string}).status).toBe("arrived");expect((db.prepare("SELECT count(*) n FROM workflow_audit_log WHERE event_type='JOB_COMPLETION_ATTEMPT_BLOCKED_MISSING_PROOF'").get() as {n:number}).n).toBe(1);});
  it("allows completion with the allocated firm's valid proof",()=>{job(db,"j1","arrived");proof(db,"p1","j1","firm_a","COMPLETION");expect(markCompletedWithProof(db,"j1","firm_a","user_a").ok).toBe(true);});
  it("cannot reuse proof from another job",()=>{job(db,"j1","arrived");job(db,"j2","arrived");proof(db,"p1","j2","firm_a","COMPLETION");expect(markCompletedWithProof(db,"j1","firm_a","user_a").ok).toBe(false);});
  it("rejects deleted or unvalidated proof",()=>{job(db,"j1","arrived");proof(db,"p1","j1","firm_a","COMPLETION","DELETED");expect(hasValidWorkProof(db,"j1","firm_a","COMPLETION")).toBe(false);});
  it("payment capture is blocked without completed state and proof",async()=>{job(db,"j1","arrived");db.prepare("INSERT INTO payments(id,job_id,amount_gross,commission_amount,amount_net,status) VALUES ('pay','j1',500,75,425,'authorized')").run();await expect(capturePayment(db,"j1")).rejects.toThrow("PAYMENT_CAPTURE_BLOCKED");expect((db.prepare("SELECT status FROM payments WHERE id='pay'").get() as {status:string}).status).toBe("authorized");});
  it("payment capture proceeds only after valid completion proof",async()=>{job(db,"j1","arrived");proof(db,"p1","j1","firm_a","COMPLETION");expect(markCompletedWithProof(db,"j1","firm_a","user_a").ok).toBe(true);db.prepare("INSERT INTO payments(id,job_id,amount_gross,commission_amount,amount_net,status) VALUES ('pay','j1',500,75,425,'authorized')").run();await capturePayment(db,"j1");expect((db.prepare("SELECT status FROM payments WHERE id='pay'").get() as {status:string}).status).toBe("captured");});
  it("replayed completion cannot transition or duplicate capture",()=>{job(db,"j1","arrived");proof(db,"p1","j1","firm_a","COMPLETION");expect(markCompletedWithProof(db,"j1","firm_a","user_a").ok).toBe(true);expect(markCompletedWithProof(db,"j1","firm_a","user_a").ok).toBe(false);});
  it("assertion binds completion proof to the allocated firm and job",()=>{job(db,"j1","completed");proof(db,"p1","j1","firm_b","COMPLETION");expect(()=>assertCompletionProof(db,"j1")).toThrow();});
});
