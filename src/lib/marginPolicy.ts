import type {Database} from 'better-sqlite3';
import {MarginError,calculateOperationalMargin,type ManualEstimate} from './operationalMargin';
export const MARGIN_POLICY_SCHEMA=`
CREATE TABLE IF NOT EXISTS margin_policies(revision INTEGER PRIMARY KEY,min_bani INTEGER,min_basis_points INTEGER,reason TEXT NOT NULL,actor_id TEXT NOT NULL,created_at TEXT NOT NULL,CHECK(min_bani IS NOT NULL OR min_basis_points IS NOT NULL));
CREATE TRIGGER IF NOT EXISTS margin_policy_no_update BEFORE UPDATE ON margin_policies BEGIN SELECT RAISE(ABORT,'Margin policy immutable'); END;
CREATE TRIGGER IF NOT EXISTS margin_policy_no_delete BEFORE DELETE ON margin_policies BEGIN SELECT RAISE(ABORT,'Margin policy retained'); END;
CREATE TABLE IF NOT EXISTS offer_margin_decisions(offer_id TEXT PRIMARY KEY REFERENCES assessment_offers(id),policy_revision INTEGER NOT NULL REFERENCES margin_policies(revision),margin_bani INTEGER NOT NULL,client_due_bani INTEGER NOT NULL,cost_state TEXT NOT NULL,below_threshold INTEGER NOT NULL,exception_reason TEXT,actor_id TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS margin_decision_no_update BEFORE UPDATE ON offer_margin_decisions BEGIN SELECT RAISE(ABORT,'Margin decision immutable'); END;
CREATE TRIGGER IF NOT EXISTS margin_decision_no_delete BEFORE DELETE ON offer_margin_decisions BEGIN SELECT RAISE(ABORT,'Margin decision retained'); END;
`;
export type MarginPolicy={revision:number;min_bani:number|null;min_basis_points:number|null;reason:string;actor_id:string;created_at:string};
function note(v:unknown){if(typeof v!=='string'||!v.trim()||v.trim().length>2000)throw new MarginError('Justificarea este obligatorie, maximum 2000 caractere.');return v.trim();}
export function currentMarginPolicy(db:Database):MarginPolicy|null{return db.prepare('SELECT * FROM margin_policies ORDER BY revision DESC LIMIT 1').get() as MarginPolicy|undefined??null;}
export function saveMarginPolicy(db:Database,body:{revision:unknown;minBani:unknown;minBasisPoints:unknown;reason:unknown},actor:string,now=new Date()){
 if(!actor||!Number.isSafeInteger(body.revision)||Number(body.revision)<0)throw new MarginError('Revizie sau operator invalid.');
 const amount=body.minBani,percent=body.minBasisPoints;
 if(amount!==null&&(!Number.isSafeInteger(amount)||Number(amount)<0||Number(amount)>100000000))throw new MarginError('Pragul valoric trebuie exprimat în bani, între 0 și 100000000.');
 if(percent!==null&&(!Number.isSafeInteger(percent)||Number(percent)<0||Number(percent)>10000))throw new MarginError('Pragul procentual trebuie exprimat în puncte de bază, între 0 și 10000.');
 if(amount===null&&percent===null)throw new MarginError('Configurează cel puțin un prag.');
 const reason=note(body.reason);
 return db.transaction(()=>{const current=currentMarginPolicy(db);if((current?.revision??0)!==body.revision)throw new MarginError('Regula a fost modificată de alt operator. Reîncarcă.',409);const revision=Number(body.revision)+1;db.prepare('INSERT INTO margin_policies VALUES(?,?,?,?,?,?)').run(revision,amount,percent,reason,actor,now.toISOString());return currentMarginPolicy(db)!;}).immediate();
}
export function evaluateMarginPolicy(estimate:ManualEstimate,policy:MarginPolicy|null){
 const margin=calculateOperationalMargin(estimate);
 if(margin.marginBani===null)return {status:'incomplete' as const,margin};
 if(!policy)return {status:'not_configured' as const,margin};
 // Compare integer products, never rounded display percentages. Both configured minima must hold.
 if(policy.min_basis_points!==null&&margin.clientDueBani===0)return {status:'undefined_percentage' as const,margin};
 const below=(policy.min_bani!==null&&margin.marginBani<policy.min_bani)||(policy.min_basis_points!==null&&margin.marginBani*10000<policy.min_basis_points*margin.clientDueBani);
 return {status:below?'below' as const:'pass' as const,margin};
}
export function checkOfferMargin(db:Database,estimate:ManualEstimate,revision:unknown,exception:unknown){
 const policy=currentMarginPolicy(db),result=evaluateMarginPolicy(estimate,policy);
 if(!policy)throw new MarginError('Configurează pragul de marjă în Admin înainte de publicare.',409);
 if(policy.revision!==revision)throw new MarginError('Pragul de marjă s-a schimbat. Reîncarcă înainte de publicare.',409);
 if(result.status==='incomplete')throw new MarginError('Costurile sunt incomplete.',409);
 if(result.status==='undefined_percentage')throw new MarginError('Marja procentuală nu poate fi verificată pentru un total de zero.',409);
 const exceptionReason=result.status==='below'?note(exception):null;
 return {policy,result,exceptionReason};
}
export function recordOfferMargin(db:Database,offerId:string,check:ReturnType<typeof checkOfferMargin>,actor:string,now:Date){db.prepare('INSERT INTO offer_margin_decisions VALUES(?,?,?,?,?,?,?,?,?)').run(offerId,check.policy.revision,check.result.margin.marginBani,check.result.margin.clientDueBani,check.result.margin.status,check.result.status==='below'?1:0,check.exceptionReason,actor,now.toISOString());}
export function marginExceptionReport(db:Database){return db.prepare(`SELECT d.*,o.assessment_id,o.estimate_revision,o.status AS offer_status,p.min_bani,p.min_basis_points FROM offer_margin_decisions d JOIN assessment_offers o ON o.id=d.offer_id JOIN margin_policies p ON p.revision=d.policy_revision WHERE d.below_threshold=1 ORDER BY d.created_at DESC,d.offer_id LIMIT 200`).all();}
