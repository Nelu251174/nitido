import {EXECUTION_SCOPES} from './executionTemplatesShared';
import type {Database} from 'better-sqlite3';
import {hostLocalInstant} from './hostScheduleShared';
import {MarginError,calculateOperationalMargin,validateManualEstimate} from './operationalMargin';
export type ReportFilters={from:string;to:string;city?:string;firm?:string;client?:string;mode?:string;space?:string;service?:string;zone?:string};
type Job={id:string;client_id:string;created_at:string;accepted_at:string|null;price_gross:number;guarantee_of:string|null;accepted_firm_id:string|null;status:string;scheduled_at:string|null;arrived_confirmed_at:string|null;scheduled_jd:number|null;arrived_jd:number|null};
export function operationalReport(db:Database,f:ReportFilters){
 let from:string,end:string;
 try{from=hostLocalInstant(f.from,0);hostLocalInstant(f.to,0);const next=new Date(f.to+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);end=hostLocalInstant(next.toISOString().slice(0,10),0);}catch{throw new MarginError('Alege date calendaristice valide.');}
 if(f.from>f.to||Date.parse(end)-Date.parse(from)>367*86400000)throw new MarginError('Alege o perioadă de maximum un an, în ordine cronologică.');
 for(const value of [f.city,f.firm,f.client,f.zone])if(value!==undefined&&(typeof value!=='string'||value.length>150))throw new MarginError('Filtru invalid.');
 if(f.mode&&!['standard','express'].includes(f.mode))throw new MarginError('Mod invalid.');
 if(f.space&&!['apartament','casa','birou','altul'].includes(f.space))throw new MarginError('Tip de spațiu invalid.');
 if(f.service&&f.service!=='legacy'&&!EXECUTION_SCOPES.some(([key])=>key===f.service))throw new MarginError('Serviciu invalid.');
 return db.transaction(()=>{
 const where=`julianday(j.created_at)>=julianday(?) AND julianday(j.created_at)<julianday(?) AND (?='' OR j.city=?) AND (?='' OR j.accepted_firm_id=?) AND (?='' OR j.client_id=?) AND (?='' OR j.mode=?) AND (?='' OR j.space_type=?) AND (?='' OR j.postal_code=?) AND (?='' OR COALESCE((SELECT scope FROM job_execution_rules er WHERE er.job_id=j.id),'legacy')=?)`;
 const params=[from,end,...[f.city,f.firm,f.client,f.mode,f.space,f.zone,f.service].flatMap(v=>[v??'',v??''])];
 const jobs=db.prepare(`SELECT j.id,j.client_id,j.created_at,j.accepted_at,j.price_gross,j.guarantee_of,j.accepted_firm_id,j.status,j.scheduled_at,j.arrived_confirmed_at,julianday(j.scheduled_at) scheduled_jd,julianday(j.arrived_confirmed_at) arrived_jd FROM jobs j WHERE ${where} ORDER BY j.created_at,j.id LIMIT 10001`).all(...params) as Job[];
 if(jobs.length>10000)throw new MarginError('Raportul depășește 10.000 de lucrări. Restrânge perioada sau filtrele pentru un rezultat complet.',422);
 const selected=new Set(jobs.map(j=>j.id));
 const ratings=db.prepare(`SELECT r.job_id,r.stars FROM ratings r JOIN jobs j ON j.id=r.job_id WHERE ${where} AND j.status='completed' AND r.firm_id=j.accepted_firm_id AND r.client_id=j.client_id AND r.status='active' AND r.moderation_status='published'`).all(...params) as {job_id:string;stars:number}[];
 const reviewed=db.prepare(`SELECT c.job_id,c.status,(SELECT r.outcome FROM visit_case_reviews r WHERE r.case_id=c.id ORDER BY r.created_at DESC,r.id DESC LIMIT 1) outcome FROM visit_cases c JOIN jobs j ON j.id=c.job_id WHERE ${where}`).all(...params) as {job_id:string;status:string;outcome:string|null}[];
 const proofs=db.prepare(`SELECT DISTINCT p.job_id,p.proof_type FROM job_photos p JOIN jobs j ON j.id=p.job_id WHERE ${where} AND p.status='VALID' AND p.uploaded_by_firm_id=j.accepted_firm_id AND p.proof_type IN ('ARRIVAL','COMPLETION')`).all(...params) as {job_id:string;proof_type:string}[];
 const proofMap=new Map<string,Set<string>>();for(const p of proofs){if(!proofMap.has(p.job_id))proofMap.set(p.job_id,new Set());proofMap.get(p.job_id)!.add(p.proof_type);}
 const confirmed=new Set(reviewed.filter(r=>r.outcome==='confirmed').map(r=>r.job_id));
 const unresolved=new Set(reviewed.filter(r=>!r.outcome||r.outcome==='needs_information').map(r=>r.job_id));
 const costs=db.prepare(`SELECT c.job_id,c.definition_json FROM job_actual_costs c JOIN jobs j ON j.id=c.job_id WHERE ${where} AND j.status='completed' AND c.revision=(SELECT MAX(x.revision) FROM job_actual_costs x WHERE x.job_id=c.job_id)`).all(...params) as {job_id:string;definition_json:string}[];
 let knownMarginBani=0,confirmedRevenueBani=0,confirmedCosts=0,estimatedCosts=0;
 for(const c of costs){const margin=calculateOperationalMargin(validateManualEstimate(JSON.parse(c.definition_json)));if(margin.status==='confirmed'){confirmedCosts++;knownMarginBani+=margin.marginBani!;confirmedRevenueBani+=margin.clientDueBani;}else if(margin.status==='estimated')estimatedCosts++;}
 const completed=jobs.filter(j=>j.status==='completed').length;
 const firmIds=[...new Set(jobs.map(j=>j.accepted_firm_id).filter((id):id is string=>!!id))];
 const providers=firmIds.map(id=>{
  const firm=db.prepare('SELECT f.id,u.name,f.verified,f.suspended_until FROM firms f JOIN users u ON u.id=f.user_id WHERE f.id=?').get(id) as {id:string;name:string;verified:number;suspended_until:string|null};
  const assigned=jobs.filter(j=>j.accepted_firm_id===id),done=assigned.filter(j=>j.status==='completed'),ids=new Set(assigned.map(j=>j.id));
  const stars=ratings.filter(r=>ids.has(r.job_id));
  const timed=assigned.filter(j=>j.scheduled_jd!==null&&j.arrived_jd!==null);
  return {...firm,assigned:assigned.length,completed:done.length,noShow:assigned.filter(j=>j.status==='no_show').length,confirmedComplaintJobs:done.filter(j=>confirmed.has(j.id)).length,unreviewedComplaintJobs:assigned.filter(j=>unresolved.has(j.id)).length,ratingCount:stars.length,averageRating:stars.length?stars.reduce((s,r)=>s+r.stars,0)/stars.length:null,arrivalSamples:timed.length,arrivedByScheduled:timed.filter(j=>j.arrived_jd!<=j.scheduled_jd!).length,completedWithBothProofs:done.filter(j=>proofMap.get(j.id)?.size===2).length,score:null,automaticAllocation:false};
 }).sort((a,b)=>a.name.localeCompare(b.name,'ro')||a.id.localeCompare(b.id));
 const ratio=(numerator:number,denominator:number)=>({numerator,denominator,percent:denominator?numerator*100/denominator:null});
 const median=(values:number[])=>{values.sort((a,b)=>a-b);return {minutes:values.length?(values[Math.floor((values.length-1)/2)]+values[Math.floor(values.length/2)])/2:null,samples:values.length};};
 const utc=(value:string)=>Date.parse(/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)?value:value.replace(' ','T')+(value.length===10?'T00:00:00Z':'Z'));
 const elapsed=(start:string,finish:string|null)=>finish?(utc(finish)-utc(start))/60000:NaN;
 const allocation=median(jobs.map(j=>elapsed(j.created_at,j.accepted_at)).filter(n=>Number.isFinite(n)&&n>=0));
 const firstOffers=db.prepare(`SELECT j.id,j.created_at,MIN(o.created_at) offered_at FROM jobs j JOIN offers o ON o.job_id=j.id WHERE ${where} GROUP BY j.id`).all(...params) as {created_at:string;offered_at:string}[];
 const offerTime=median(firstOffers.map(o=>elapsed(o.created_at,o.offered_at)).filter(n=>Number.isFinite(n)&&n>=0));
 const returning=db.prepare(`SELECT COUNT(*) n FROM jobs j WHERE ${where} AND j.status='completed' AND EXISTS(SELECT 1 FROM jobs previous WHERE previous.client_id=j.client_id AND previous.status='completed' AND (julianday(previous.created_at)<julianday(j.created_at) OR (julianday(previous.created_at)=julianday(j.created_at) AND previous.id<j.id)))`).get(...params) as {n:number};
 const lifetime=db.prepare(`SELECT COUNT(DISTINCT h.client_id) clients,COUNT(*) completedJobs,SUM(ROUND(h.price_gross*100)) serviceValueBani FROM jobs h WHERE h.status='completed' AND h.client_id IN (SELECT j.client_id FROM jobs j WHERE ${where})`).get(...params) as {clients:number;completedJobs:number;serviceValueBani:number|null};
 // Assessment requests have their own creation cohort. Unsupported filters must not turn conversion into 100%.
 let requests:null|{total:number;converted:number;percent:number|null;offerMedianMinutes:number|null;offerSamples:number}=null;
 if(!f.firm&&!f.mode&&!f.space&&!f.zone&&f.service!=='legacy'&&f.service!=='standard'&&f.service!=='express'){
 const rows=db.prepare(`SELECT a.id,a.created_at,(SELECT MIN(o.created_at) FROM assessment_offers o WHERE o.assessment_id=a.id) offered_at,EXISTS(SELECT 1 FROM assessment_offers o JOIN assessment_offer_jobs link ON link.offer_id=o.id WHERE o.assessment_id=a.id) converted FROM service_assessments a WHERE julianday(a.created_at)>=julianday(?) AND julianday(a.created_at)<julianday(?) AND (?='' OR json_extract(a.payload,'$.city')=?) AND (?='' OR a.client_id=?) AND (?='' OR json_extract(a.payload,'$.category')=?) LIMIT 10001`).all(from,end,f.city??'',f.city??'',f.client??'',f.client??'',f.service??'',f.service??'') as {created_at:string;offered_at:string|null;converted:number}[];
 if(rows.length>10000)throw new MarginError('Raportul depășește 10.000 de cereri. Restrânge perioada sau filtrele.',422);
 const converted=rows.filter(r=>r.converted).length,timing=median(rows.map(r=>elapsed(r.created_at,r.offered_at)).filter(n=>Number.isFinite(n)&&n>=0));
 requests={total:rows.length,converted,percent:rows.length?converted*100/rows.length:null,offerMedianMinutes:timing.minutes,offerSamples:timing.samples};
 }
 const kpis={requests,allocation,offerTime,cancellation:ratio(jobs.filter(j=>j.status==='cancelled').length,jobs.length),noShow:ratio(jobs.filter(j=>j.status==='no_show').length,jobs.length),complaints:ratio(jobs.filter(j=>j.status==='completed'&&confirmed.has(j.id)).length,completed),remediation:ratio(jobs.filter(j=>!!j.guarantee_of).length,jobs.length),repeatOrders:ratio(returning.n,completed),averageOrderBani:completed?Math.round(jobs.filter(j=>j.status==='completed').reduce((sum,j)=>sum+Math.round(j.price_gross*100),0)/completed):null,rating:{count:ratings.length,average:ratings.length?ratings.reduce((sum,r)=>sum+r.stars,0)/ratings.length:null},lifetime:{...lifetime,serviceValueBani:lifetime.serviceValueBani??0,basis:'Valoarea serviciilor finalizate în tot istoricul clienților din selecție; nu încasări și nu profit.'},providerAcceptance:{percent:null,reason:'Nu există un registru complet al invitațiilor primite și acceptate de prestatori. Ofertele selectate de client nu reprezintă rata de acceptare a prestatorului.'}};
 return {kpis,filters:f,timezone:'Europe/Bucharest',basis:'Lucrări create în perioada selectată; stările și verificările sunt cele curente.',observationOnly:true,total:jobs.length,completed,waiting:jobs.filter(j=>j.status==='waiting').length,active:jobs.filter(j=>['accepted','arrived'].includes(j.status)).length,cancelled:jobs.filter(j=>j.status==='cancelled').length,noShow:jobs.filter(j=>j.status==='no_show').length,confirmedComplaintJobs:jobs.filter(j=>j.status==='completed'&&confirmed.has(j.id)).length,unreviewedComplaintJobs:[...unresolved].filter(id=>selected.has(id)).length,margin:{knownConfirmedBasisPoints:confirmedRevenueBani?Math.round(knownMarginBani*10000/confirmedRevenueBani):null,totalBasisPoints:completed>0&&confirmedCosts===completed&&confirmedRevenueBani?Math.round(knownMarginBani*10000/confirmedRevenueBani):null,knownConfirmedBani:knownMarginBani,confirmedJobs:confirmedCosts,estimatedJobs:estimatedCosts,missingOrIncompleteJobs:completed-confirmedCosts-estimatedCosts,totalBani:completed>0&&confirmedCosts===completed?knownMarginBani:null},providers};
 })();
}
export type OperationalReport=ReturnType<typeof operationalReport>;
