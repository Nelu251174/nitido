import type { Database } from "better-sqlite3";
import { newId } from "@/lib/db";

export type WorkProofType = "ARRIVAL" | "COMPLETION";

export function hasValidWorkProof(db: Database, jobId: string, firmId: string, proofType: WorkProofType): boolean {
  return Boolean(db.prepare(`SELECT 1 FROM job_photos
    WHERE job_id=? AND uploaded_by_firm_id=? AND proof_type=? AND status='VALID'
      AND validated_at IS NOT NULL LIMIT 1`).get(jobId, firmId, proofType));
}

export function auditWorkflow(db: Database, eventType: string, jobId: string, firmId: string | null, userId: string | null, details: object = {}): void {
  db.prepare(`INSERT INTO workflow_audit_log (id,event_type,job_id,firm_id,user_id,details)
    VALUES (?,?,?,?,?,?)`).run(newId("workflow"), eventType, jobId, firmId, userId, JSON.stringify(details));
}

export function assertCompletionProof(db: Database, jobId: string): { firmId: string } {
  const job = db.prepare("SELECT status,accepted_firm_id FROM jobs WHERE id=?").get(jobId) as {status:string;accepted_firm_id:string|null}|undefined;
  if (!job || job.status !== "completed" || !job.accepted_firm_id || !hasValidWorkProof(db, jobId, job.accepted_firm_id, "COMPLETION")) {
    if (job?.accepted_firm_id) auditWorkflow(db, "PAYMENT_CAPTURE_BLOCKED_MISSING_PROOF", jobId, job.accepted_firm_id, null);
    throw new Error("PAYMENT_CAPTURE_BLOCKED_MISSING_COMPLETION_PROOF");
  }
  return { firmId: job.accepted_firm_id };
}

export type ProofTransitionResult = { ok:true } | { ok:false; status:409; error:string };

export function markArrivedWithProof(db: Database, jobId:string, firmId:string, userId:string): ProofTransitionResult {
  const job=db.prepare("SELECT status FROM jobs WHERE id=? AND accepted_firm_id=?").get(jobId,firmId) as {status:string}|undefined;
  if(!job||job.status!=="accepted") return {ok:false,status:409,error:"Lucrarea nu poate fi confirmată de această firmă"};
  if(!hasValidWorkProof(db,jobId,firmId,"ARRIVAL")){
    auditWorkflow(db,"JOB_ARRIVAL_ATTEMPT_BLOCKED_MISSING_PROOF",jobId,firmId,userId);
    return {ok:false,status:409,error:"Pentru a începe lucrarea trebuie să încarci cel puțin o fotografie făcută la sosirea la locație."};
  }
  const changed=db.prepare("UPDATE jobs SET status='arrived',arrived_confirmed_at=datetime('now') WHERE id=? AND status='accepted' AND accepted_firm_id=?").run(jobId,firmId);
  if(changed.changes!==1) return {ok:false,status:409,error:"Lucrarea nu poate fi confirmată de această firmă"};
  auditWorkflow(db,"JOB_ARRIVED",jobId,firmId,userId); return {ok:true};
}

export function markCompletedWithProof(db: Database, jobId:string, firmId:string, userId:string): ProofTransitionResult {
  const job=db.prepare("SELECT status FROM jobs WHERE id=? AND accepted_firm_id=?").get(jobId,firmId) as {status:string}|undefined;
  if(!job||job.status!=="arrived") return {ok:false,status:409,error:"Lucrarea nu poate fi finalizată de această firmă"};
  if(!hasValidWorkProof(db,jobId,firmId,"COMPLETION")){
    auditWorkflow(db,"JOB_COMPLETION_ATTEMPT_BLOCKED_MISSING_PROOF",jobId,firmId,userId);
    return {ok:false,status:409,error:"Finalizarea este blocată. Încarcă fotografia obligatorie de finalizare a lucrării."};
  }
  const changed=db.prepare("UPDATE jobs SET status='completed',completed_at=datetime('now') WHERE id=? AND accepted_firm_id=? AND status='arrived'").run(jobId,firmId);
  if(changed.changes!==1) return {ok:false,status:409,error:"Lucrarea nu poate fi finalizată de această firmă"};
  auditWorkflow(db,"JOB_COMPLETED",jobId,firmId,userId); return {ok:true};
}
