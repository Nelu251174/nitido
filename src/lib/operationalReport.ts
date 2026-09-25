import type {Database} from 'better-sqlite3';
import {hostLocalInstant} from './hostScheduleShared';
import {MarginError,calculateOperationalMargin,validateManualEstimate} from './operationalMargin';
export type ReportFilters={from:string;to:string;city?:string;firm?:string;client?:string;mode?:string;space?:string};
type Job={id:string;accepted_firm_id:string|null;status:string;scheduled_at:string|null;arrived_confirmed_at:string|null;scheduled_jd:number|null;arrived_jd:number|null};
export function operationalReport(db:Database,f:ReportFilters){
 let from:string,end:string;
 try{from=hostLocalInstant(f.from,0);hostLocalInstant(f.to,0);const next=new Date(f.to+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);end=hostLocalInstant(next.toISOString().slice(0,10),0);}catch{throw new MarginError('Alege date calendaristice valide.');}
 if(f.from>f.to||Date.parse(end)-Date.parse(from)>367*86400000)throw new MarginError('Alege o perioadă de maximum un an, în ordine cronologică.');
 for(const value of [f.city,f.firm,f.client])if(value!==undefined&&(typeof value!=='string'||value.length>150))throw new MarginError('Filtru invalid.');
 if(f.mode&&!['standard','express'].includes(f.mode))throw new MarginError('Mod invalid.');
 if(f.space&&!['apartament','casa','birou','altul'].includes(f.space))throw new MarginError('Tip de spațiu invalid.');
 return db.transaction(()=>{
 const where=`julianday(j.created_at)>=julianday(?) AND julianday(j.created_at)<julianday(?) AND (?='' OR j.city=?) AND (?='' OR j.accepted_firm_id=?) AND (?='' OR j.client_id=?) AND (?='' OR j.mode=?) AND (?='' OR j.space_type=?)`;
 const params=[from,end,...[f.city,f.firm,f.client,f.mode,f.space].flatMap(v=>[v??'',v??''])];
 const jobs=db.prepare(`SELECT j.id,j.accepted_firm_id,j.status,j.scheduled_at,j.arrived_confirmed_at,julianday(j.scheduled_at) scheduled_jd,julianday(j.arrived_confirmed_at) arrived_jd FROM jobs j WHERE ${where} ORDER BY j.created_at,j.id LIMIT 10001`).all(...params) as Job[];
 if(jobs.length>10000)throw new MarginError('Raportul depășește 10.000 de lucrări. Restrânge perioada sau filtrele pentru un rezultat complet.',422);
 const selected=new Set(jobs.map(j=>j.id));
 const ratings=db.prepare(`SELECT r.job_id,r.stars FROM ratings r JOIN jobs j ON j.id=r.job_id WHERE ${where} AND j.status='completed' AND r.firm_id=j.accepted_firm_id AND r.client_id=j.client_id AND r.status='active' AND r.moderation_status='published'`).all(...params) as {job_id:string;stars:number}[];
 const reviewed=db.prepare(`SELECT c.job_id,c.status,(SELECT r.outcome FROM visit_case_reviews r WHERE r.case_id=c.id ORDER BY r.created_at DESC,r.id DESC LIMIT 1) outcome FROM visit_cases c JOIN jobs j ON j.id=c.job_id WHERE ${where}`).all(...params) as {job_id:string;status:string;outcome:string|null}[];
 const proofs=db.prepare(`SELECT DISTINCT p.job_id,p.proof_type FROM job_photos p JOIN jobs j ON j.id=p.job_id WHERE ${where} AND p.status='VALID' AND p.uploaded_by_firm_id=j.accepted_firm_id AND p.proof_type IN ('ARRIVAL','COMPLETION')`).all(...params) as {job_id:string;proof_type:string}[];
 const proofMap=new Map<string,Set<string>>();for(const p of proofs){if(!proofMap.has(p.job_id))proofMap.set(p.job_id,new Set());proofMap.get(p.job_id)!.add(p.proof_type);}
 const confirmed=new Set(reviewed.filter(r=>r.outcome==='confirmed').map(r=>r.job_id));
 const unresolved=new Set(reviewed.filter(r=>!r.outcome||r.outcome==='needs_information').map(r=>r.job_id));
 const costs=db.prepare(`SELECT c.job_id,c.definition_json FROM job_actual_costs c JOIN jobs j ON j.id=c.job_id WHERE ${where} AND j.status='completed' AND c.revision=(SELECT MAX(x.revision) FROM job_actual_costs x WHERE x.job_id=c.job_id)`).all(...params) as {job_id:string;definition_json:string}[];
 let knownMarginBani=0,confirmedCosts=0,estimatedCosts=0;
 for(const c of costs){const margin=calculateOperationalMargin(validateManualEstimate(JSON.parse(c.definition_json)));if(margin.status==='confirmed'){confirmedCosts++;knownMarginBani+=margin.marginBani!;}else if(margin.status==='estimated')estimatedCosts++;}
 const completed=jobs.filter(j=>j.status==='completed').length;
 const firmIds=[...new Set(jobs.map(j=>j.accepted_firm_id).filter((id):id is string=>!!id))];
 const providers=firmIds.map(id=>{
  const firm=db.prepare('SELECT f.id,u.name,f.verified,f.suspended_until FROM firms f JOIN users u ON u.id=f.user_id WHERE f.id=?').get(id) as {id:string;name:string;verified:number;suspended_until:string|null};
  const assigned=jobs.filter(j=>j.accepted_firm_id===id),done=assigned.filter(j=>j.status==='completed'),ids=new Set(assigned.map(j=>j.id));
  const stars=ratings.filter(r=>ids.has(r.job_id));
  const timed=assigned.filter(j=>j.scheduled_jd!==null&&j.arrived_jd!==null);
  return {...firm,assigned:assigned.length,completed:done.length,noShow:assigned.filter(j=>j.status==='no_show').length,confirmedComplaintJobs:done.filter(j=>confirmed.has(j.id)).length,unreviewedComplaintJobs:assigned.filter(j=>unresolved.has(j.id)).length,ratingCount:stars.length,averageRating:stars.length?stars.reduce((s,r)=>s+r.stars,0)/stars.length:null,arrivalSamples:timed.length,arrivedByScheduled:timed.filter(j=>j.arrived_jd!<=j.scheduled_jd!).length,completedWithBothProofs:done.filter(j=>proofMap.get(j.id)?.size===2).length,score:null,automaticAllocation:false};
 }).sort((a,b)=>a.name.localeCompare(b.name,'ro')||a.id.localeCompare(b.id));
 return {filters:f,timezone:'Europe/Bucharest',basis:'Lucrări create în perioada selectată; stările și verificările sunt cele curente.',observationOnly:true,total:jobs.length,completed,waiting:jobs.filter(j=>j.status==='waiting').length,active:jobs.filter(j=>['accepted','arrived'].includes(j.status)).length,cancelled:jobs.filter(j=>j.status==='cancelled').length,noShow:jobs.filter(j=>j.status==='no_show').length,confirmedComplaintJobs:jobs.filter(j=>j.status==='completed'&&confirmed.has(j.id)).length,unreviewedComplaintJobs:[...unresolved].filter(id=>selected.has(id)).length,margin:{knownConfirmedBani:knownMarginBani,confirmedJobs:confirmedCosts,estimatedJobs:estimatedCosts,missingOrIncompleteJobs:completed-confirmedCosts-estimatedCosts,totalBani:completed>0&&confirmedCosts===completed?knownMarginBani:null},providers};
 })();
}
export type OperationalReport=ReturnType<typeof operationalReport>;
