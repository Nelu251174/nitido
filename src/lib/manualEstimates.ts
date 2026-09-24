import type {Database} from 'better-sqlite3';
import {MarginError,validateManualEstimate,calculateOperationalMargin,type ManualEstimate} from './operationalMargin';
export const MANUAL_ESTIMATE_SCHEMA=`
CREATE TABLE IF NOT EXISTS assessment_estimates(
 assessment_id TEXT NOT NULL REFERENCES service_assessments(id),revision INTEGER NOT NULL CHECK(revision>0),
 assessment_version INTEGER NOT NULL,definition_json TEXT NOT NULL,actor_id TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(assessment_id,revision)
);
CREATE TRIGGER IF NOT EXISTS assessment_estimate_no_update BEFORE UPDATE ON assessment_estimates BEGIN SELECT RAISE(ABORT,'Estimate history is immutable'); END;
CREATE TRIGGER IF NOT EXISTS assessment_estimate_no_delete BEFORE DELETE ON assessment_estimates BEGIN SELECT RAISE(ABORT,'Estimate history is retained'); END;
`;
export function listManualEstimates(db:Database,id:string){
 const rows=db.prepare('SELECT revision,assessment_version,definition_json,actor_id,created_at FROM assessment_estimates WHERE assessment_id=? ORDER BY revision DESC LIMIT 100').all(id) as {revision:number;assessment_version:number;definition_json:string;actor_id:string;created_at:string}[];
 return rows.map(({definition_json,...r})=>{const definition=JSON.parse(definition_json) as ManualEstimate;return {...r,definition,margin:calculateOperationalMargin(definition)};});
}
export function saveManualEstimate(db:Database,args:{id:unknown;revision:unknown;assessmentVersion:unknown;definition:unknown},actorId:string,now=new Date()){
 if(typeof args.id!=='string'||!args.id||args.id.length>100||!Number.isSafeInteger(args.revision)||Number(args.revision)<0||!Number.isSafeInteger(args.assessmentVersion)||!actorId)throw new MarginError('Referință sau revizie invalidă.');
 const definition=validateManualEstimate(args.definition);
 return db.transaction(()=>{
 const assessment=db.prepare('SELECT status,version FROM service_assessments WHERE id=?').get(args.id) as {status:string;version:number}|undefined;
 if(!assessment)throw new MarginError('Cererea nu există.',404);
 if(['declined','cancelled'].includes(assessment.status)||assessment.version!==args.assessmentVersion)throw new MarginError('Cererea este închisă sau s-a modificat. Reîncarcă datele.',409);
 const current=db.prepare('SELECT COALESCE(MAX(revision),0) revision FROM assessment_estimates WHERE assessment_id=?').get(args.id) as {revision:number};
 if(current.revision!==args.revision)throw new MarginError('Alt operator a salvat o revizie. Reîncarcă înainte de editare.',409);
 db.prepare('INSERT INTO assessment_estimates VALUES(?,?,?,?,?,?)').run(args.id,current.revision+1,assessment.version,JSON.stringify(definition),actorId,now.toISOString());
 return listManualEstimates(db,args.id as string)[0];
 }).immediate();
}
