import {jobPhotoRules,jobExecutionRules} from './executionTemplates';
import type { Database } from "better-sqlite3";
import { newId } from "@/lib/db";

export type WorkProofType = "ARRIVAL" | "COMPLETION";

function validWorkProof(db: Database, jobId: string, firmId: string, proofType: WorkProofType): {id:string}|undefined {
  const required=jobPhotoRules(db,jobId)[proofType==='ARRIVAL'?'arrivalMin':'completionMin'];
  const proofs=db.prepare(`SELECT id FROM job_photos
    WHERE job_id=? AND uploaded_by_firm_id=? AND proof_type=? AND status='VALID'
      AND validated_at IS NOT NULL ORDER BY id LIMIT ?`).all(jobId, firmId, proofType,required) as {id:string}[];
  return proofs.length>=required?proofs[0]:undefined;
}
export function hasValidWorkProof(db: Database, jobId: string, firmId: string, proofType: WorkProofType): boolean {
  return Boolean(validWorkProof(db,jobId,firmId,proofType));
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
  return db.transaction(():ProofTransitionResult=>{
  const job=db.prepare("SELECT status FROM jobs WHERE id=? AND accepted_firm_id=?").get(jobId,firmId) as {status:string}|undefined;
  if(!job||job.status!=="accepted") return {ok:false,status:409,error:"Lucrarea nu poate fi confirmată de această firmă"};
  const proof=validWorkProof(db,jobId,firmId,"ARRIVAL");
  if(!proof){
    auditWorkflow(db,"JOB_ARRIVAL_ATTEMPT_BLOCKED_MISSING_PROOF",jobId,firmId,userId);
    return {ok:false,status:409,error:`Pentru a începe lucrarea sunt necesare ${jobPhotoRules(db,jobId).arrivalMin} fotografii valide de sosire, conform cerințelor acestei lucrări.`};
  }
  const changed=db.prepare("UPDATE jobs SET status='arrived',arrived_confirmed_at=datetime('now') WHERE id=? AND status='accepted' AND accepted_firm_id=?").run(jobId,firmId);
  if(changed.changes!==1) return {ok:false,status:409,error:"Lucrarea nu poate fi confirmată de această firmă"};
  auditWorkflow(db,"JOB_ARRIVED",jobId,firmId,userId,{proofId:proof.id,proofType:"ARRIVAL"}); return {ok:true};
  }).immediate();
}

export function markCompletedWithProof(db: Database, jobId:string, firmId:string, userId:string): ProofTransitionResult {
  return db.transaction(():ProofTransitionResult=>{
  const job=db.prepare("SELECT status FROM jobs WHERE id=? AND accepted_firm_id=?").get(jobId,firmId) as {status:string}|undefined;
  if(!job||job.status!=="arrived") return {ok:false,status:409,error:"Lucrarea nu poate fi finalizată de această firmă"};
  const proof=validWorkProof(db,jobId,firmId,"COMPLETION");
  if(!proof){
    auditWorkflow(db,"JOB_COMPLETION_ATTEMPT_BLOCKED_MISSING_PROOF",jobId,firmId,userId);
    return {ok:false,status:409,error:`Finalizarea este blocată. Sunt necesare ${jobPhotoRules(db,jobId).completionMin} fotografii valide de finalizare, conform cerințelor acestei lucrări.`};
  }
  const rules=jobExecutionRules(db,jobId);
  if(rules.revision>0){
    const done=db.prepare('SELECT item_key FROM workspace_checklist WHERE job_id=? AND done=1').all(jobId) as {item_key:string}[];
    if(!rules.items.every(item=>done.some(d=>d.item_key===item.key))||db.prepare("SELECT 1 FROM visit_cases WHERE job_id=? AND category='task' AND status NOT IN ('resolved','closed')").get(jobId))return {ok:false,status:409,error:'Completează lista de verificări confirmată pentru această lucrare și soluționează sarcinile raportate înainte de finalizare.'};
  }
  const changed=db.prepare("UPDATE jobs SET status='completed',completed_at=datetime('now') WHERE id=? AND accepted_firm_id=? AND status='arrived'").run(jobId,firmId);
  if(changed.changes!==1) return {ok:false,status:409,error:"Lucrarea nu poate fi finalizată de această firmă"};
  auditWorkflow(db,"JOB_COMPLETED",jobId,firmId,userId,{proofId:proof.id,proofType:"COMPLETION"}); return {ok:true};
  }).immediate();
}
