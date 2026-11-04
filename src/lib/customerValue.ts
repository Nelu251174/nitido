import {currencyOfJob,jobGrossTotals} from './jobCurrency';
import type {Database} from 'better-sqlite3';
import {calculateOperationalMargin,validateManualEstimate} from './operationalMargin';
// Invoked inside the same read transaction as the customer record. No date or page limit.
export function customerValue(db:Database,clientId:string){
 if(!db.inTransaction)throw new Error('Customer value requires a consistent read transaction');
 const totals=db.prepare(`SELECT COUNT(*) totalJobs,
  SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) completedJobs,
  0 AS completedServiceValueBani,
  MIN(created_at) firstJobAt,MAX(created_at) latestJobAt FROM jobs WHERE client_id=?`).get(clientId) as {totalJobs:number;completedJobs:number|null;completedServiceValueBani:number|null;firstJobAt:string|null;latestJobAt:string|null};
 const monetaryRows=db.prepare("SELECT price_gross,pricing_snapshot FROM jobs WHERE client_id=? AND status='completed'").all(clientId) as {price_gross:number;pricing_snapshot:string|null}[];
 const monetaryByCurrency=jobGrossTotals(monetaryRows);
 let confirmedJobs=0,estimatedJobs=0,knownConfirmedMarginBani=0;
 const rows=db.prepare(`SELECT c.definition_json,j.pricing_snapshot FROM job_actual_costs c JOIN jobs j ON j.id=c.job_id
  WHERE j.client_id=? AND j.status='completed' AND c.revision=(SELECT MAX(x.revision) FROM job_actual_costs x WHERE x.job_id=c.job_id)`).iterate(clientId);
 for(const row of rows){if(currencyOfJob((row as {pricing_snapshot:string|null}).pricing_snapshot)!=='RON')continue;const margin=calculateOperationalMargin(validateManualEstimate(JSON.parse((row as {definition_json:string}).definition_json)));if(margin.status==='confirmed'){confirmedJobs++;knownConfirmedMarginBani+=margin.marginBani!;}else if(margin.status==='estimated')estimatedJobs++;}
 const completedJobs=totals.completedJobs??0,completedServiceValueBani=monetaryByCurrency.RON.amountMinor;
 if(!Number.isSafeInteger(completedServiceValueBani)||!Number.isSafeInteger(knownConfirmedMarginBani))throw new Error('Customer value exceeds supported precision');
 return {...totals,completedJobs,completedServiceValueBani,monetaryCurrency:'RON' as const,monetaryByCurrency,margin:{currency:'RON' as const,excludedOtherCurrencyJobs:monetaryByCurrency.EUR.count+monetaryByCurrency.unrecognizedCount,confirmedJobs,estimatedJobs,missingOrIncompleteJobs:monetaryByCurrency.RON.count-confirmedJobs-estimatedJobs,knownConfirmedBani:knownConfirmedMarginBani,totalBani:monetaryByCurrency.RON.count>0&&confirmedJobs===monetaryByCurrency.RON.count?knownConfirmedMarginBani:null}};
}
