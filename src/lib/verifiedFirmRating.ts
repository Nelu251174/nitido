import type {Database} from 'better-sqlite3';
/** Match the public verified-review contract, including the frozen photo minima. */
export function verifiedFirmRating(db:Database,firmId:string):{average:number|null;count:number}{
 const result=db.prepare(`SELECT AVG(r.stars) average,COUNT(*) count FROM ratings r JOIN jobs j ON j.id=r.job_id
  WHERE r.firm_id=? AND r.status='active' AND r.moderation_status='published' AND j.status='completed'
   AND r.client_id=j.client_id AND r.firm_id=j.accepted_firm_id
   AND EXISTS(SELECT 1 FROM payments p WHERE p.job_id=j.id AND p.status='captured')
   AND (SELECT COUNT(*) FROM job_photos p WHERE p.job_id=j.id AND p.uploaded_by_firm_id=r.firm_id AND p.proof_type='ARRIVAL' AND p.status='VALID' AND p.validated_at IS NOT NULL)>=COALESCE((SELECT arrival_min FROM job_photo_rules WHERE job_id=j.id),1)
   AND (SELECT COUNT(*) FROM job_photos p WHERE p.job_id=j.id AND p.uploaded_by_firm_id=r.firm_id AND p.proof_type='COMPLETION' AND p.status='VALID' AND p.validated_at IS NOT NULL)>=COALESCE((SELECT completion_min FROM job_photo_rules WHERE job_id=j.id),1)`)
  .get(firmId) as {average:number|null;count:number};
 return result;
}
