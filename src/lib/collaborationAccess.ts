import type { Database } from "better-sqlite3";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { calcGrossPrice, type SpaceType } from "./pricing";

export class AccessError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const COLLABORATION_SCHEMA = `
CREATE TABLE IF NOT EXISTS workspace_members (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('team','property')),
 resource_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('worker','manager','viewer')),
 active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
 UNIQUE(kind,resource_id,user_id)
);
CREATE INDEX IF NOT EXISTS workspace_members_user ON workspace_members(user_id,active);
CREATE TABLE IF NOT EXISTS workspace_invites (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, kind TEXT NOT NULL,
 resource_id TEXT NOT NULL, role TEXT NOT NULL, email TEXT NOT NULL,
 invited_by TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL,
 accepted_by TEXT REFERENCES users(id), revoked INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS workspace_invites_resource ON workspace_invites(kind,resource_id,revoked);
CREATE TABLE IF NOT EXISTS workspace_execution_reports (
 job_id TEXT PRIMARY KEY REFERENCES jobs(id), submitted_by TEXT NOT NULL REFERENCES users(id),
 note TEXT NOT NULL DEFAULT '', submitted_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workspace_approvals (
 id TEXT PRIMARY KEY, property_id TEXT NOT NULL REFERENCES workspace_properties(id),
 requested_by TEXT NOT NULL REFERENCES users(id), request_key TEXT NOT NULL,
 date TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', sqm INTEGER NOT NULL,
 space_type TEXT NOT NULL, snapshot_street TEXT NOT NULL, snapshot_city TEXT NOT NULL, price_bani INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','fulfilled')),
 decided_by TEXT REFERENCES users(id), decision_note TEXT, decided_at TEXT,
 job_id TEXT UNIQUE REFERENCES jobs(id), created_at TEXT NOT NULL,
 UNIQUE(requested_by,request_key)
);
CREATE INDEX IF NOT EXISTS workspace_approvals_property ON workspace_approvals(property_id,status);
`;
export function resourceOwner(db: Database, kind: string, id: string): string | null {
  if (kind === "team") return (db.prepare("SELECT f.user_id FROM workspace_teams t JOIN firms f ON f.id=t.firm_id WHERE t.id=? AND t.active=1").get(id) as {user_id:string}|undefined)?.user_id ?? null;
  if (kind === "property") return (db.prepare("SELECT owner_id FROM workspace_properties WHERE id=? AND archived=0").get(id) as {owner_id:string}|undefined)?.owner_id ?? null;
  return null;
}
export function resourceRole(db: Database, userId:string, kind:string, id:string):string|null {
  const owner=resourceOwner(db,kind,id); if(!owner)return null;
  if(owner===userId)return "owner";
  return (db.prepare("SELECT role FROM workspace_members WHERE kind=? AND resource_id=? AND user_id=? AND active=1").get(kind,id,userId) as {role:string}|undefined)?.role??null;
}
function audit(db:Database,userId:string,action:string,id:string){
  db.prepare("INSERT INTO workspace_audit VALUES(?,?,?,?,?)").run(randomUUID(),userId,action,id,new Date().toISOString());
}
const hash=(token:string)=>createHash("sha256").update(token).digest("hex");
export function createInvite(db:Database,userId:string,kind:string,resourceId:string,email:string,role:string){
  if(resourceOwner(db,kind,resourceId)!==userId)throw new AccessError("Nu poți invita persoane aici.",403);
  if(!(kind==="team"&&role==="worker")&&!(kind==="property"&&["manager","viewer"].includes(role)))throw new AccessError("Rol invalid.");
  const address=email.trim().toLowerCase();if(address.length>254||!/^\S+@\S+\.\S+$/.test(address))throw new AccessError("Email invalid.");
  const token=randomBytes(32).toString("base64url"),id=randomUUID(),now=new Date();
  db.prepare("INSERT INTO workspace_invites(id,token_hash,kind,resource_id,role,email,invited_by,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)").run(id,hash(token),kind,resourceId,role,address,userId,new Date(now.getTime()+7*86400000).toISOString(),now.toISOString());
  audit(db,userId,"member.invite",id);return {id,token};
}
export function acceptInvite(db:Database,userId:string,token:string){
  if(token.length>100)throw new AccessError("Invitație invalidă.");
  return db.transaction(()=>{
    const invite=db.prepare("SELECT * FROM workspace_invites WHERE token_hash=? AND revoked=0 AND expires_at>?").get(hash(token),new Date().toISOString()) as {id:string;kind:string;resource_id:string;role:string;email:string;accepted_by:string|null}|undefined;
    const user=db.prepare("SELECT email FROM users WHERE id=?").get(userId) as {email:string|null}|undefined;
    if(!invite||!resourceOwner(db,invite.kind,invite.resource_id))throw new AccessError("Invitația a expirat sau a fost revocată.",404);
    if(invite.accepted_by&&invite.accepted_by!==userId)throw new AccessError("Invitație deja folosită.",409);
    if(user?.email?.trim().toLowerCase()!==invite.email)throw new AccessError("Intră în contul cu adresa de email pentru care a fost creată invitația.",403);
    if(invite.accepted_by===userId)return {kind:invite.kind};
    db.prepare("INSERT INTO workspace_members VALUES(?,?,?,?,?,1,?) ON CONFLICT(kind,resource_id,user_id) DO UPDATE SET role=excluded.role,active=1").run(randomUUID(),invite.kind,invite.resource_id,userId,invite.role,new Date().toISOString());
    db.prepare("UPDATE workspace_invites SET accepted_by=? WHERE id=? AND accepted_by IS NULL").run(userId,invite.id);
    audit(db,userId,"member.accept",invite.id);return {kind:invite.kind};
  })();
}
export function revokeMember(db:Database,userId:string,id:string){
  const member=db.prepare("SELECT kind,resource_id,user_id FROM workspace_members WHERE id=?").get(id) as {kind:string;resource_id:string;user_id:string}|undefined;
  if(!member||resourceOwner(db,member.kind,member.resource_id)!==userId)throw new AccessError("Acces interzis.",403);
  db.transaction(()=>{db.prepare("UPDATE workspace_members SET active=0 WHERE id=?").run(id);db.prepare("UPDATE workspace_invites SET revoked=1 WHERE kind=? AND resource_id=? AND accepted_by=?").run(member.kind,member.resource_id,member.user_id);audit(db,userId,"member.revoke",id)})();
}
/** Resolve on every request: membership revocation and job reassignment take effect immediately. */
export function executionAccess(db:Database,userId:string,jobId:string){
  const row=db.prepare(`SELECT j.accepted_firm_id AS firm_id, f.user_id AS owner_id, j.status
    FROM jobs j JOIN firms f ON f.id=j.accepted_firm_id
    WHERE j.id=? AND (f.user_id=? OR EXISTS(
      SELECT 1 FROM workspace_assignments a JOIN workspace_teams t ON t.id=a.team_id
      JOIN workspace_members m ON m.kind='team' AND m.resource_id=t.id
      WHERE a.job_id=j.id AND t.firm_id=j.accepted_firm_id AND t.active=1
        AND m.user_id=? AND m.active=1 AND m.role='worker'))`).get(jobId,userId,userId) as {firm_id:string;owner_id:string;status:string}|undefined;
  return row??null;
}
export function submitExecutionReport(db:Database,userId:string,jobId:string,note:string){
  return db.transaction(()=>{
    const access=executionAccess(db,userId,jobId);
    if(!access||access.status!=="arrived")throw new AccessError("Lucrarea nu poate fi raportată.",403);
    const proofs=db.prepare("SELECT DISTINCT proof_type FROM job_photos WHERE job_id=? AND uploaded_by_firm_id=? AND status='VALID' AND validated_at IS NOT NULL AND proof_type IN ('ARRIVAL','COMPLETION')").all(jobId,access.firm_id);
    const checks=db.prepare("SELECT item_key FROM workspace_checklist WHERE job_id=? AND done=1").all(jobId) as {item_key:string}[];
    if(proofs.length<2||!["surfaces","kitchen","bathroom","floors","waste","inspection"].every(k=>checks.some(c=>c.item_key===k)))throw new AccessError("Completează toate verificările și fotografiile de început/final înainte să trimiți raportul.",409);
    if(note.length>2000)throw new AccessError("Nota poate avea maximum 2.000 de caractere.");
    db.prepare("INSERT INTO workspace_execution_reports VALUES(?,?,?,?) ON CONFLICT(job_id) DO NOTHING").run(jobId,userId,note.trim(),new Date().toISOString());
    audit(db,userId,"execution.submit",jobId);
  })();
}
export function createApproval(db:Database,userId:string,b:{propertyId:string;date:string;note:string;requestKey:string}){
  const role=resourceRole(db,userId,"property",b.propertyId);
  if(!["owner","manager"].includes(role??""))throw new AccessError("Nu poți solicita lucrări pentru această locație.",403);
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Bucharest"}).format(new Date());
  if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||b.date<today||!Number.isFinite(new Date(b.date).getTime())||new Date(b.date).toISOString().slice(0,10)!==b.date)throw new AccessError("Alege o dată validă, astăzi sau în viitor.");
  if(!b.requestKey||b.requestKey.length>100||b.note.length>2000)throw new AccessError("Cerere invalidă.");
  const property=db.prepare("SELECT sqm,space_type,street,city FROM workspace_properties WHERE id=?").get(b.propertyId) as {sqm:number;space_type:SpaceType;street:string;city:string};
  const existing=db.prepare("SELECT * FROM workspace_approvals WHERE requested_by=? AND request_key=?").get(userId,b.requestKey) as {id:string;property_id:string;date:string;note:string}|undefined;
  if(existing){if(existing.property_id!==b.propertyId||existing.date!==b.date||existing.note!==b.note.trim())throw new AccessError("Cheia aparține altei solicitări.",409);return existing.id;}
  const id=randomUUID();db.prepare("INSERT INTO workspace_approvals(id,property_id,requested_by,request_key,date,note,sqm,space_type,snapshot_street,snapshot_city,price_bani,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(id,b.propertyId,userId,b.requestKey,b.date,b.note.trim(),property.sqm,property.space_type,property.street,property.city,calcGrossPrice(property.space_type,property.sqm)*100,new Date().toISOString());audit(db,userId,"approval.request",id);return id;
}
export function decideApproval(db:Database,userId:string,id:string,approve:boolean,note:string){
  if(note.length>1000)throw new AccessError("Motiv prea lung.");
  return db.transaction(()=>{
    const approval=db.prepare("SELECT a.*,p.owner_id,p.budget_bani,p.budget_enforced FROM workspace_approvals a JOIN workspace_properties p ON p.id=a.property_id WHERE a.id=? AND p.archived=0").get(id) as {owner_id:string;status:string;property_id:string;price_bani:number;date:string;budget_bani:number;budget_enforced:number}|undefined;
    if(!approval||approval.owner_id!==userId)throw new AccessError("Numai titularul locației poate decide.",403);
    if(approval.status!=="pending"&&!(approval.status==="approved"&&!approve))throw new AccessError("Solicitarea a fost deja decisă.",409);
    if(approve&&approval.date<new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Bucharest"}).format(new Date()))throw new AccessError("Data solicitată a trecut. Creează o solicitare nouă.",409);
    if(approve&&approval.budget_enforced){
      const month=approval.date.slice(0,7);
      if(propertyMonthTotal(db,approval.property_id,month)+approval.price_bani>approval.budget_bani)throw new AccessError("Bugetul lunar nu acoperă această solicitare. Actualizează bugetul înainte de aprobare.",409);
    }
    db.prepare("UPDATE workspace_approvals SET status=?,decided_by=?,decision_note=?,decided_at=? WHERE id=? AND status IN ('pending','approved')").run(approve?"approved":"rejected",userId,note.trim(),new Date().toISOString(),id);audit(db,userId,approve?"approval.approve":"approval.reject",id);
  })();
}
/** Called inside the job creation transaction. An approval can fund exactly one matching job. */
export function consumeApproval(db:Database,userId:string,id:string,jobId:string){
  const a=db.prepare("SELECT a.*,p.owner_id,a.snapshot_street AS street,a.snapshot_city AS city FROM workspace_approvals a JOIN workspace_properties p ON p.id=a.property_id WHERE a.id=? AND p.archived=0").get(id) as {status:string;owner_id:string;property_id:string;price_bani:number;sqm:number;space_type:string;date:string;street:string;city:string}|undefined;
  const j=db.prepare("SELECT * FROM jobs WHERE id=? AND client_id=?").get(jobId,userId) as {sqm:number;space_type:string;price_gross:number;credit_applied:number;street:string;city:string;scheduled_at:string;when_type:string}|undefined;
  if(!a||a.owner_id!==userId||a.status!=="approved"||!j)throw new AccessError("Aprobarea nu mai este disponibilă.",409);
  const day=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Bucharest"}).format(new Date(j.scheduled_at));
  if(j.sqm!==a.sqm||j.space_type!==a.space_type||Math.round(j.price_gross*100)!==a.price_bani||j.street!==a.street||j.city!==a.city||day!==a.date)throw new AccessError("Detaliile sau prețul diferă de aprobare. Solicită o aprobare nouă.",409);
  db.prepare("INSERT INTO workspace_property_jobs VALUES(?,?) ON CONFLICT(job_id) DO UPDATE SET property_id=excluded.property_id").run(jobId,a.property_id);
  const result=db.prepare("UPDATE workspace_approvals SET status='fulfilled',job_id=? WHERE id=? AND status='approved'").run(jobId,id);
  if(result.changes!==1)throw new AccessError("Aprobarea a fost deja folosită.",409);
  audit(db,userId,"approval.fulfilled",id);
}


const bucharestMonth=(date:string)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Bucharest",year:"numeric",month:"2-digit"}).format(new Date(date)).slice(0,7);
function propertyMonthTotal(db:Database,propertyId:string,month:string){
 const held=(db.prepare("SELECT COALESCE(SUM(price_bani),0) total FROM workspace_approvals WHERE property_id=? AND status='approved' AND substr(date,1,7)=?").get(propertyId,month) as {total:number}).total;
 const jobs=db.prepare("SELECT j.scheduled_at,j.price_gross FROM workspace_property_jobs pj JOIN jobs j ON j.id=pj.job_id WHERE pj.property_id=? AND j.status NOT IN ('cancelled','no_show')").all(propertyId) as {scheduled_at:string;price_gross:number}[];
 return held+jobs.filter(j=>j.scheduled_at&&bucharestMonth(j.scheduled_at)===month).reduce((sum,j)=>sum+Math.round(j.price_gross*100),0);
}
/** Check only the new booking month; historical budget overruns do not block other months. */
export function enforcePropertyBudget(db:Database,propertyId:string,jobId:string){
 const p=db.prepare("SELECT budget_bani,budget_enforced FROM workspace_properties WHERE id=?").get(propertyId) as {budget_bani:number;budget_enforced:number}|undefined;
 if(!p?.budget_enforced)return;
 const j=db.prepare("SELECT scheduled_at FROM jobs WHERE id=?").get(jobId) as {scheduled_at:string};
 if(propertyMonthTotal(db,propertyId,bucharestMonth(j.scheduled_at))>p.budget_bani)throw new AccessError("Bugetul lunar este depășit. Actualizează bugetul locației înainte de rezervare.",409);
}
