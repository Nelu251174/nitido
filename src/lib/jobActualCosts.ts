import type {Database} from 'better-sqlite3';
import {COST_CODES,MarginError,validateManualEstimate,calculateOperationalMargin,emptyManualEstimate} from './operationalMargin';
export const JOB_ACTUAL_COSTS_SCHEMA=`
CREATE TABLE IF NOT EXISTS job_actual_costs(job_id TEXT NOT NULL REFERENCES jobs(id),revision INTEGER NOT NULL CHECK(revision>0),definition_json TEXT NOT NULL,actor_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(job_id,revision));
CREATE TRIGGER IF NOT EXISTS job_actual_costs_no_update BEFORE UPDATE ON job_actual_costs BEGIN SELECT RAISE(ABORT,'Actual cost history immutable'); END;
CREATE TRIGGER IF NOT EXISTS job_actual_costs_no_delete BEFORE DELETE ON job_actual_costs BEGIN SELECT RAISE(ABORT,'Actual cost history retained'); END;
`;
export function jobCostReport(db:Database,offerId:unknown){
 if(typeof offerId!=='string'||!offerId||offerId.length>100)throw new MarginError('Referință invalidă.');
 const row=db.prepare(`SELECT j.id jobId,j.status,e.definition_json FROM assessment_offer_jobs l JOIN jobs j ON j.id=l.job_id JOIN assessment_offers o ON o.id=l.offer_id JOIN assessment_estimates e ON e.assessment_id=o.assessment_id AND e.revision=o.estimate_revision WHERE o.id=? AND o.status='accepted'`).get(offerId) as {jobId:string;status:string;definition_json:string}|undefined;
 if(!row)return null;
 const baseline=validateManualEstimate(JSON.parse(row.definition_json));
 const history=(db.prepare('SELECT revision,definition_json,actor_id,created_at FROM job_actual_costs WHERE job_id=? ORDER BY revision DESC LIMIT 100').all(row.jobId) as {revision:number;definition_json:string;actor_id:string;created_at:string}[]).map(({definition_json,...r})=>({...r,definition:validateManualEstimate(JSON.parse(definition_json))}));
 const estimated=calculateOperationalMargin(baseline),actual=history[0]?calculateOperationalMargin(history[0].definition):null;
 const initial={...emptyManualEstimate(),lines:baseline.lines,platformDiscountBani:baseline.platformDiscountBani};
 return {jobId:row.jobId,jobStatus:row.status,baseline,initial,history,estimated,actual,deltaBani:actual?.marginBani!=null&&estimated.marginBani!==null?actual.marginBani-estimated.marginBani:null};
}
export function saveJobActualCosts(db:Database,input:Record<string,unknown>,actorId:string){
 if(!db.inTransaction)throw new MarginError('Tranzacția este obligatorie.',500);
 const report=jobCostReport(db,input.offerId);
 if(!report)throw new MarginError('Oferta nu are o lucrare asociată.',404);
 if(report.jobStatus!=='completed')throw new MarginError('Costurile efective se înregistrează după finalizarea lucrării.',409);
 if(!Number.isSafeInteger(input.revision)||input.revision!==(report.history[0]?.revision??0))throw new MarginError('Raportul s-a modificat. Reîncarcă înainte de salvare.',409);
 if(!input.definition||typeof input.definition!=='object'||Array.isArray(input.definition))throw new MarginError('Costuri invalide.');
 const raw=input.definition as Record<string,unknown>;
 // Accepted service terms always come from the immutable estimate behind the booked offer.
 const definition=validateManualEstimate({...raw,lines:report.baseline.lines,platformDiscountBani:report.baseline.platformDiscountBani});
 if([definition.provider,...COST_CODES.map(c=>definition.costs[c])].some(e=>e.state==='estimated'))throw new MarginError('Costurile efective trebuie confirmate cu sursă sau marcate necunoscute.');
 if(!actorId)throw new MarginError('Operator invalid.',401);
 db.prepare('INSERT INTO job_actual_costs VALUES(?,?,?,?,?)').run(report.jobId,Number(input.revision)+1,JSON.stringify(definition),actorId,new Date().toISOString());
 return jobCostReport(db,input.offerId)!;
}
