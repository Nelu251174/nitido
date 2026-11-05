import {activeAccountSql,activeFirmSql} from './accountStatus';
import type { Database } from "better-sqlite3";
import { newId } from "@/lib/db";
import { hasValidWorkProof, auditWorkflow } from "@/lib/proofOfWork";

export type ReviewCreateResult = {ok:true;id:string} | {ok:false;status:400|403|404|409;error:string};

export function recalculateFirmRating(db:Database,firmId:string):void {
  const value=db.prepare(`SELECT COALESCE(SUM(r.stars),0) sum,COUNT(*) count FROM ratings r JOIN jobs j ON j.id=r.job_id
    WHERE r.firm_id=? AND r.status='active' AND r.moderation_status='published' AND j.status='completed' AND r.client_id=j.client_id AND r.firm_id=j.accepted_firm_id
      AND EXISTS(SELECT 1 FROM payments p WHERE p.job_id=j.id AND p.status='captured')
      AND (SELECT COUNT(*) FROM job_photos p WHERE p.job_id=j.id AND p.uploaded_by_firm_id=r.firm_id AND p.proof_type='ARRIVAL' AND p.status='VALID' AND p.validated_at IS NOT NULL)>=COALESCE((SELECT arrival_min FROM job_photo_rules WHERE job_id=j.id),1)
      AND (SELECT COUNT(*) FROM job_photos p WHERE p.job_id=j.id AND p.uploaded_by_firm_id=r.firm_id AND p.proof_type='COMPLETION' AND p.status='VALID' AND p.validated_at IS NOT NULL)>=COALESCE((SELECT completion_min FROM job_photo_rules WHERE job_id=j.id),1)`
    ).get(firmId) as {sum:number;count:number};
  db.prepare("UPDATE firms SET rating_sum=?,rating_count=? WHERE id=?").run(value.sum,value.count,firmId);
}

export function createVerifiedReview(db:Database,input:{jobId:string;clientId:string;rating:number;reviewText?:string|null;punctuality?:boolean;quality?:boolean;communication?:boolean}):ReviewCreateResult {
  if(!Number.isInteger(input.rating)||input.rating<1||input.rating>5) return {ok:false,status:400,error:"Rating invalid (1-5 stele)"};
  if(input.reviewText!=null&&typeof input.reviewText!=="string")return {ok:false,status:400,error:"Comentariu invalid"};
  const text=input.reviewText?.trim()||null;
  if(text&&text.length>2000) return {ok:false,status:400,error:"Recenzia poate avea maximum 2000 de caractere"};
  const job=db.prepare(`SELECT j.client_id,j.accepted_firm_id,j.status,p.status payment_status
    FROM jobs j LEFT JOIN payments p ON p.job_id=j.id WHERE j.id=?`).get(input.jobId) as {client_id:string;accepted_firm_id:string|null;status:string;payment_status:string|null}|undefined;
  if(!job) return {ok:false,status:404,error:"Lucrare inexistentă"};
  if(job.client_id!==input.clientId) return {ok:false,status:403,error:"Nu poți evalua lucrarea altui client"};
  if(job.status!=="completed"||!job.accepted_firm_id) return {ok:false,status:409,error:"Doar lucrările finalizate pot primi rating"};
  if(job.payment_status!=="captured"||!hasValidWorkProof(db,input.jobId,job.accepted_firm_id,"ARRIVAL")||!hasValidWorkProof(db,input.jobId,job.accepted_firm_id,"COMPLETION")) return {ok:false,status:409,error:"Recenzia verificată devine disponibilă după finalizarea completă și confirmarea plății"};
  if(db.prepare("SELECT 1 FROM ratings WHERE job_id=?").get(input.jobId)) return {ok:false,status:409,error:"Lucrarea a primit deja un rating"};
  const id=newId("rating");
  try { db.prepare(`INSERT INTO ratings(id,job_id,firm_id,client_id,stars,punctuality,quality,communication,comment,status,moderation_status)
    VALUES(?,?,?,?,?,?,?,?,?,'active','published')`).run(id,input.jobId,job.accepted_firm_id,input.clientId,input.rating,input.punctuality?1:0,input.quality?1:0,input.communication?1:0,text); }
  catch { return {ok:false,status:409,error:"Lucrarea a primit deja un rating"}; }
  recalculateFirmRating(db,job.accepted_firm_id); auditWorkflow(db,"VERIFIED_REVIEW_CREATED",input.jobId,job.accepted_firm_id,input.clientId,{reviewId:id});
  return {ok:true,id};
}

function publicName(name:string):string { const parts=name.trim().split(/\s+/); return `${parts[0]||"Client"}${parts[1]?` ${parts[1][0].toUpperCase()}.`:""}`; }
function redact(text:string|null,street:string):string|null { const safe=street?text?.split(street).join("[adresă eliminată]"):text; return safe?.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,"[email eliminat]").replace(/(?:\+?40|0)\s?7(?:[\s.-]?\d){8}/g,"[telefon eliminat]")??null; }

export function getPublicTrustSnapshot(db:Database,firmId?:string){
  const where=firmId?"AND r.firm_id=?":""; const params=firmId?[firmId]:[];
  const reviews=db.prepare(`SELECT r.id,r.firm_id,r.stars,r.comment,r.created_at,j.street,u.name reviewer_name,fu.name firm_name
    FROM ratings r JOIN jobs j ON j.id=r.job_id JOIN users u ON u.id=r.client_id JOIN firms f ON f.id=r.firm_id JOIN users fu ON fu.id=f.user_id
    WHERE ${activeAccountSql(db,'fu.id')} AND r.status='active' AND r.moderation_status='published' AND j.status='completed' AND r.client_id=j.client_id AND r.firm_id=j.accepted_firm_id ${where}
      AND EXISTS(SELECT 1 FROM payments p WHERE p.job_id=j.id AND p.status='captured')
      AND (SELECT COUNT(*) FROM job_photos p WHERE p.job_id=j.id AND p.uploaded_by_firm_id=r.firm_id AND p.proof_type='ARRIVAL' AND p.status='VALID' AND p.validated_at IS NOT NULL)>=COALESCE((SELECT arrival_min FROM job_photo_rules WHERE job_id=j.id),1)
      AND (SELECT COUNT(*) FROM job_photos p WHERE p.job_id=j.id AND p.uploaded_by_firm_id=r.firm_id AND p.proof_type='COMPLETION' AND p.status='VALID' AND p.validated_at IS NOT NULL)>=COALESCE((SELECT completion_min FROM job_photo_rules WHERE job_id=j.id),1)
    ORDER BY r.created_at DESC LIMIT 12`).all(...params) as {id:string;firm_id:string;stars:number;comment:string|null;created_at:string;street:string;reviewer_name:string;firm_name:string}[];
  const firms=db.prepare(`SELECT f.id,u.name,f.verified,f.coverage_city,
    (SELECT COUNT(*) FROM jobs j WHERE j.accepted_firm_id=f.id AND j.status='completed') completed_jobs
    FROM firms f JOIN users u ON u.id=f.user_id WHERE ${activeAccountSql(db,"u.id")} ${firmId?"AND f.id=?":""} ORDER BY u.name`).all(...params) as {id:string;name:string;verified:number;coverage_city:string;completed_jobs:number}[];
  const aggregates=db.prepare(`SELECT r.firm_id,COUNT(*) review_count,AVG(r.stars) average_rating FROM ratings r JOIN jobs j ON j.id=r.job_id
    WHERE ${activeFirmSql(db,'r.firm_id')} AND r.status='active' AND r.moderation_status='published' AND j.status='completed' AND r.client_id=j.client_id AND r.firm_id=j.accepted_firm_id ${firmId?"AND r.firm_id=?":""}
      AND EXISTS(SELECT 1 FROM payments p WHERE p.job_id=j.id AND p.status='captured')
      AND (SELECT COUNT(*) FROM job_photos p WHERE p.job_id=j.id AND p.uploaded_by_firm_id=r.firm_id AND p.proof_type='ARRIVAL' AND p.status='VALID' AND p.validated_at IS NOT NULL)>=COALESCE((SELECT arrival_min FROM job_photo_rules WHERE job_id=j.id),1)
      AND (SELECT COUNT(*) FROM job_photos p WHERE p.job_id=j.id AND p.uploaded_by_firm_id=r.firm_id AND p.proof_type='COMPLETION' AND p.status='VALID' AND p.validated_at IS NOT NULL)>=COALESCE((SELECT completion_min FROM job_photo_rules WHERE job_id=j.id),1)
    GROUP BY r.firm_id`).all(...params) as {firm_id:string;review_count:number;average_rating:number}[];
  const byFirm=new Map(aggregates.map(a=>[a.firm_id,a]));
  const summary=db.prepare(`SELECT COUNT(*) count,AVG(r.stars) average FROM ratings r JOIN jobs j ON j.id=r.job_id WHERE ${activeFirmSql(db,'r.firm_id')} AND r.status='active' AND r.moderation_status='published' AND j.status='completed' AND r.client_id=j.client_id AND r.firm_id=j.accepted_firm_id ${where} AND EXISTS(SELECT 1 FROM payments p WHERE p.job_id=j.id AND p.status='captured') AND (SELECT COUNT(*) FROM job_photos p WHERE p.job_id=j.id AND p.uploaded_by_firm_id=r.firm_id AND p.proof_type='ARRIVAL' AND p.status='VALID' AND p.validated_at IS NOT NULL)>=COALESCE((SELECT arrival_min FROM job_photo_rules WHERE job_id=j.id),1) AND (SELECT COUNT(*) FROM job_photos p WHERE p.job_id=j.id AND p.uploaded_by_firm_id=r.firm_id AND p.proof_type='COMPLETION' AND p.status='VALID' AND p.validated_at IS NOT NULL)>=COALESCE((SELECT completion_min FROM job_photo_rules WHERE job_id=j.id),1)`).get(...params) as {count:number;average:number|null};
  return {summary,reviews:reviews.map(r=>({id:r.id,firmId:r.firm_id,firmName:r.firm_name,rating:r.stars,reviewText:redact(r.comment,r.street),reviewer:publicName(r.reviewer_name),badge:"Recenzie verificată",createdAt:r.created_at})),firms:firms.map(f=>({...f,review_count:byFirm.get(f.id)?.review_count??0,average_rating:byFirm.get(f.id)?.average_rating??null}))};
}

/** Private, owner-filtered list. Eligibility uses the existing verified-review policy. */
export function getOwnReviewJobs(db:Database,clientId:string){
 return db.prepare(`SELECT j.id,j.space_type,j.sqm,j.completed_at,u.name firmName,
 r.id reviewId,r.stars rating,r.comment reviewText,r.moderation_status moderationStatus,
 CASE WHEN EXISTS(SELECT 1 FROM payments p WHERE p.job_id=j.id AND p.status='captured')
 AND (SELECT COUNT(*) FROM job_photos p WHERE p.job_id=j.id AND p.uploaded_by_firm_id=j.accepted_firm_id AND p.proof_type='ARRIVAL' AND p.status='VALID' AND p.validated_at IS NOT NULL)>=COALESCE((SELECT arrival_min FROM job_photo_rules WHERE job_id=j.id),1)
 AND (SELECT COUNT(*) FROM job_photos p WHERE p.job_id=j.id AND p.uploaded_by_firm_id=j.accepted_firm_id AND p.proof_type='COMPLETION' AND p.status='VALID' AND p.validated_at IS NOT NULL)>=COALESCE((SELECT completion_min FROM job_photo_rules WHERE job_id=j.id),1) THEN 1 ELSE 0 END eligible
 FROM jobs j JOIN firms f ON f.id=j.accepted_firm_id JOIN users u ON u.id=f.user_id
 LEFT JOIN ratings r ON r.job_id=j.id AND r.client_id=j.client_id
 WHERE j.client_id=? AND j.status='completed' ORDER BY j.completed_at DESC,j.id`).all(clientId) as OwnReviewJob[];
}
export type OwnReviewJob={id:string;space_type:string;sqm:number;completed_at:string;firmName:string;reviewId:string|null;rating:number|null;reviewText:string|null;moderationStatus:string|null;eligible:number};
