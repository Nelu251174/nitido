import type {Database} from 'better-sqlite3';
import {calculateOperationalMargin,validateManualEstimate} from './operationalMargin';
// Invoked inside the same read transaction as the customer record. No date or page limit.
export function customerValue(db:Database,clientId:string){
 if(!db.inTransaction)throw new Error('Customer value requires a consistent read transaction');
 const totals=db.prepare(`SELECT COUNT(*) totalJobs,
  SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) completedJobs,
  SUM(CASE WHEN status='completed' THEN ROUND(price_gross*100) ELSE 0 END) completedServiceValueBani,
  MIN(created_at) firstJobAt,MAX(created_at) latestJobAt FROM jobs WHERE client_id=?`).get(clientId) as {totalJobs:number;completedJobs:number|null;completedServiceValueBani:number|null;firstJobAt:string|null;latestJobAt:string|null};
 let confirmedJobs=0,estimatedJobs=0,knownConfirmedMarginBani=0;
 const rows=db.prepare(`SELECT c.definition_json FROM job_actual_costs c JOIN jobs j ON j.id=c.job_id
  WHERE j.client_id=? AND j.status='completed' AND c.revision=(SELECT MAX(x.revision) FROM job_actual_costs x WHERE x.job_id=c.job_id)`).iterate(clientId);
 for(const row of rows){const margin=calculateOperationalMargin(validateManualEstimate(JSON.parse((row as {definition_json:string}).definition_json)));if(margin.status==='confirmed'){confirmedJobs++;knownConfirmedMarginBani+=margin.marginBani!;}else if(margin.status==='estimated')estimatedJobs++;}
 const completedJobs=totals.completedJobs??0,completedServiceValueBani=totals.completedServiceValueBani??0;
 if(!Number.isSafeInteger(completedServiceValueBani)||!Number.isSafeInteger(knownConfirmedMarginBani))throw new Error('Customer value exceeds supported precision');
 return {...totals,completedJobs,completedServiceValueBani,margin:{confirmedJobs,estimatedJobs,missingOrIncompleteJobs:completedJobs-confirmedJobs-estimatedJobs,knownConfirmedBani:knownConfirmedMarginBani,totalBani:completedJobs>0&&confirmedJobs===completedJobs?knownConfirmedMarginBani:null}};
}
