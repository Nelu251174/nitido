import {afterEach,beforeEach,describe,it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {MANUAL_ESTIMATE_SCHEMA,listManualEstimates,saveManualEstimate} from './manualEstimates';
import {emptyManualEstimate} from './operationalMargin';
let db:Database.Database;
const draft=()=>({...emptyManualEstimate(),lines:[{label:'Evaluare manuală',amountBani:50000}],reason:'Datele sunt încă în curs de verificare.'});
const args=()=>({id:'a',revision:0,assessmentVersion:1,definition:draft()});
beforeEach(()=>{db=new Database(':memory:');db.pragma('foreign_keys=ON');db.exec("CREATE TABLE service_assessments(id TEXT PRIMARY KEY,status TEXT,version INTEGER);INSERT INTO service_assessments VALUES('a','submitted',1);"+MANUAL_ESTIMATE_SCHEMA);});
afterEach(()=>db.close());
describe('manual estimate revisions',()=>{
 it('saves incomplete drafts honestly with actor, time and assessment revision',()=>{const saved=saveManualEstimate(db,args(),'admin-session');expect(saved).toMatchObject({revision:1,assessment_version:1,actor_id:'admin-session',margin:{status:'incomplete',marginBani:null}});});
 it('rejects stale operator revisions and changed assessment data',()=>{saveManualEstimate(db,args(),'operator1');expect(()=>saveManualEstimate(db,args(),'operator2')).toThrow(/operator/);db.exec("UPDATE service_assessments SET version=2");expect(()=>saveManualEstimate(db,{...args(),revision:1},'operator2')).toThrow(/modificat/);});
 it.each(['cancelled','declined'])('blocks %s requests',status=>{db.prepare('UPDATE service_assessments SET status=?').run(status);expect(()=>saveManualEstimate(db,args(),'operator')).toThrow(/închisă/);});
 it('retains earlier amounts and reasons; SQL updates/deletes are rejected',()=>{saveManualEstimate(db,args(),'operator1');const updated=draft();updated.lines[0].amountBani=60000;updated.reason='Suprafață clarificată';saveManualEstimate(db,{...args(),revision:1,definition:updated},'operator2');const rows=listManualEstimates(db,'a');expect(rows.map(r=>r.margin.grossBani)).toEqual([60000,50000]);expect(()=>db.exec("UPDATE assessment_estimates SET actor_id='forged'")).toThrow(/immutable/);expect(()=>db.exec('DELETE FROM assessment_estimates')).toThrow(/retained/);});
 it('rolls back a saved revision if the enclosing audit fails',()=>{expect(()=>db.transaction(()=>{saveManualEstimate(db,args(),'operator');throw Error('audit unavailable');}).immediate()).toThrow();expect(listManualEstimates(db,'a')).toEqual([]);});
 it('requires an existing assessment and an identified actor',()=>{expect(()=>saveManualEstimate(db,{...args(),id:'missing'},'operator')).toThrow(/nu există/);expect(()=>saveManualEstimate(db,args(),'')).toThrow(/invalidă/);});
});
