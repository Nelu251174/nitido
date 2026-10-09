import {ORGANIZATION_MODULES,type OrganizationModule,type OrganizationModules} from './organizationModulesShared';
import type {Database} from 'better-sqlite3';
import {createHash,randomBytes,randomUUID} from 'node:crypto';

export class OrganizationError extends Error {
 constructor(message:string,public status=400){super(message)}
}
export const ORGANIZATION_SCHEMA=`
CREATE TABLE IF NOT EXISTS workspace_organizations (
 id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,
 approval_threshold_bani INTEGER NOT NULL DEFAULT 0 CHECK(approval_threshold_bani>=0),
 separate_approver INTEGER NOT NULL DEFAULT 1 CHECK(separate_approver IN (0,1)),
 revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS workspace_organizations_owner ON workspace_organizations(owner_id);
CREATE TABLE IF NOT EXISTS workspace_organization_modules (
 organization_id TEXT PRIMARY KEY REFERENCES workspace_organizations(id),
 business INTEGER NOT NULL DEFAULT 1 CHECK(business IN (0,1)),
 host INTEGER NOT NULL DEFAULT 0 CHECK(host IN (0,1)),
 ical INTEGER NOT NULL DEFAULT 0 CHECK(ical IN (0,1)),
 revision INTEGER NOT NULL DEFAULT 1,
 CHECK(ical=0 OR host=1)
);
CREATE TABLE IF NOT EXISTS workspace_organization_properties (
 property_id TEXT PRIMARY KEY REFERENCES workspace_properties(id),
 organization_id TEXT NOT NULL REFERENCES workspace_organizations(id)
);
CREATE INDEX IF NOT EXISTS workspace_org_properties_org ON workspace_organization_properties(organization_id);
CREATE TABLE IF NOT EXISTS workspace_organization_members (
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES workspace_organizations(id),
 user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL CHECK(role IN ('manager','approver','viewer')),
 active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,UNIQUE(organization_id,user_id)
);
CREATE TABLE IF NOT EXISTS workspace_organization_invites (
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES workspace_organizations(id),
 token_hash TEXT NOT NULL UNIQUE,email TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('manager','approver','viewer')),
 accepted_by TEXT REFERENCES users(id),revoked INTEGER NOT NULL DEFAULT 0,expires_at TEXT NOT NULL,created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workspace_organization_audit (
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES workspace_organizations(id),actor_id TEXT NOT NULL REFERENCES users(id),
 action TEXT NOT NULL,resource_id TEXT NOT NULL,details TEXT NOT NULL,created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workspace_organization_job_policy (
 job_id TEXT PRIMARY KEY REFERENCES jobs(id),organization_id TEXT NOT NULL REFERENCES workspace_organizations(id),
 property_id TEXT NOT NULL REFERENCES workspace_properties(id),revision INTEGER NOT NULL,
 price_bani INTEGER NOT NULL,approval_id TEXT REFERENCES workspace_approvals(id),created_at TEXT NOT NULL
);`;
export interface Organization {id:string;owner_id:string;name:string;approval_threshold_bani:number;separate_approver:number;revision:number}
export type OrganizationRole='owner'|'manager'|'approver'|'viewer';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function organizationRole(db:Database,userId:string,id:string):OrganizationRole|null{
 const org=db.prepare('SELECT owner_id FROM workspace_organizations WHERE id=?').get(id) as {owner_id:string}|undefined;
 if(!org)return null;if(org.owner_id===userId)return 'owner';
 return (db.prepare('SELECT role FROM workspace_organization_members WHERE organization_id=? AND user_id=? AND active=1').get(id,userId) as {role:OrganizationRole}|undefined)?.role??null;
}
export function propertyOrganization(db:Database,propertyId:string){
 return db.prepare(`SELECT o.* FROM workspace_organizations o JOIN workspace_organization_properties op ON op.organization_id=o.id
 JOIN workspace_properties p ON p.id=op.property_id AND p.owner_id=o.owner_id WHERE op.property_id=?`).get(propertyId) as Organization|undefined;
}
export function organizationModules(db:Database,id:string):OrganizationModules{
 const row=db.prepare('SELECT business,host,ical,revision FROM workspace_organization_modules WHERE organization_id=?').get(id) as {business:number;host:number;ical:number;revision:number}|undefined;
 return row?{business:!!row.business,host:!!row.host,ical:!!row.ical,revision:row.revision}:{business:true,host:false,ical:false,revision:0};
}
export function propertyModuleEnabled(db:Database,propertyId:string,module:OrganizationModule){
 const org=propertyOrganization(db,propertyId);if(!org)return true;
 const modules=organizationModules(db,org.id);return modules[module]&&(module!=='ical'||modules.host);
}
export function requirePropertyModule(db:Database,propertyId:string,module?:OrganizationModule){
 const kind=(db.prepare('SELECT kind FROM workspace_properties WHERE id=?').get(propertyId) as {kind:string}|undefined)?.kind;
 const target=module??(kind==='host'?'host':kind==='business'?'business':null);
 if(target&&!propertyModuleEnabled(db,propertyId,target))throw new OrganizationError(`Modulul ${ORGANIZATION_MODULES.find(m=>m.key===target)!.label} este dezactivat pentru această organizație. Titularul îl poate activa din Organizații.`,409);
}
export function saveOrganizationModules(db:Database,userId:string,id:string,b:Record<string,unknown>){
 return db.transaction(()=>{
  owner(db,userId,id);const before=organizationModules(db,id);
  if(b.revision!==before.revision)throw new OrganizationError('Modulele s-au modificat. Reîncarcă organizația.',409);
  for(const m of ORGANIZATION_MODULES)if(typeof b[m.key]!=='boolean')throw new OrganizationError('Alege starea fiecărui modul.');
  if(b.ical&&!b.host)throw new OrganizationError('Activează Curățenie între rezervări înainte de sincronizarea iCal.');
  if(ORGANIZATION_MODULES.every(m=>before[m.key]===b[m.key]))return;
  db.prepare(`INSERT INTO workspace_organization_modules VALUES(?,?,?,?,?) ON CONFLICT(organization_id) DO UPDATE SET business=excluded.business,host=excluded.host,ical=excluded.ical,revision=excluded.revision`).run(id,b.business?1:0,b.host?1:0,b.ical?1:0,before.revision+1);
  // Invalidate in-flight downloads. Re-enabling a module never silently resumes private feeds.
  if(!b.ical||!b.host){
   db.prepare(`UPDATE workspace_ical_connections SET enabled=0,version=version+1,lease_token=NULL,lease_until=NULL,warning='Sincronizare oprită din modulele organizației. Reia explicit după reactivare.' WHERE property_id IN (SELECT property_id FROM workspace_organization_properties WHERE organization_id=?)`).run(id);
   db.prepare('DELETE FROM workspace_ical_missing WHERE connection_id IN (SELECT c.id FROM workspace_ical_connections c JOIN workspace_organization_properties op ON op.property_id=c.property_id WHERE op.organization_id=?)').run(id);
  }
  organizationAudit(db,userId,id,'modules.save',id,{before,after:{business:b.business,host:b.host,ical:b.ical,revision:before.revision+1}});
 }).immediate();
}
function owner(db:Database,userId:string,id:string){
 if(organizationRole(db,userId,id)!=='owner')throw new OrganizationError('Numai titularul organizației poate modifica aceste setări.',403);
}
export function organizationAudit(db:Database,userId:string,id:string,action:string,resource:string,details:unknown){
 db.prepare('INSERT INTO workspace_organization_audit VALUES(?,?,?,?,?,?,?)').run(randomUUID(),id,userId,action,resource,JSON.stringify(details),new Date().toISOString());
}
function label(value:unknown){if(typeof value!=='string'||!value.trim()||value.trim().length>100)throw new OrganizationError('Denumirea trebuie să aibă între 1 și 100 de caractere.');return value.trim()}
export function saveOrganization(db:Database,userId:string,b:Record<string,unknown>){
 const name=label(b.name),threshold=b.thresholdBani;
 if(!Number.isSafeInteger(threshold)||Number(threshold)<0||Number(threshold)>100000000||typeof b.separateApprover!=='boolean')throw new OrganizationError('Pragul sau regula de aprobare este invalidă.');
 return db.transaction(()=>{
  const id=typeof b.id==='string'?b.id:randomUUID();
  if(b.id){
   owner(db,userId,id);const previous=db.prepare('SELECT * FROM workspace_organizations WHERE id=?').get(id) as Organization;
   if(b.revision!==previous.revision)throw new OrganizationError('Setările s-au modificat. Reîncarcă organizația.',409);
   db.prepare('UPDATE workspace_organizations SET name=?,approval_threshold_bani=?,separate_approver=?,revision=revision+1 WHERE id=?').run(name,threshold,b.separateApprover?1:0,id);
   // Unused decisions are re-evaluated explicitly under the new policy, never silently grandfathered.
   db.prepare(`UPDATE workspace_approvals SET status='rejected',decided_by=?,decided_at=?,decision_note='Politica organizației s-a schimbat. Creează o solicitare nouă.' WHERE organization_id=? AND status IN ('pending','approved')`).run(userId,new Date().toISOString(),id);
  }else db.prepare('INSERT INTO workspace_organizations(id,owner_id,name,approval_threshold_bani,separate_approver,created_at) VALUES(?,?,?,?,?,?)').run(id,userId,name,threshold,b.separateApprover?1:0,new Date().toISOString());
  organizationAudit(db,userId,id,'policy.save',id,{name,thresholdBani:threshold,separateApprover:b.separateApprover});return id;
 }).immediate();
}
export function assignOrganizationProperty(db:Database,userId:string,id:string,propertyId:string,attach:boolean){
 return db.transaction(()=>{
  owner(db,userId,id);
  const p=db.prepare("SELECT owner_id,kind FROM workspace_properties WHERE id=? AND archived=0").get(propertyId) as {owner_id:string;kind:string}|undefined;
  if(!p||p.owner_id!==userId||!['business','host'].includes(p.kind))throw new OrganizationError('Alege o proprietate proprie de tip Business sau Curățenie între rezervări.',403);
  if(attach&&!organizationModules(db,id)[p.kind as 'business'|'host'])throw new OrganizationError('Activează mai întâi modulul corespunzător proprietății.',409);
  const current=propertyOrganization(db,propertyId);
  if(attach&&current?.id===id||!attach&&!current)return;
  if(current&&current.id!==id)throw new OrganizationError('Locația aparține altei organizații.',409);
  if(db.prepare("SELECT 1 FROM workspace_approvals WHERE property_id=? AND status IN ('pending','approved')").get(propertyId))throw new OrganizationError('Decide sau retrage solicitările neutilizate înainte de mutarea locației.',409);
  if(!attach&&(db.prepare("SELECT 1 FROM workspace_property_jobs pj JOIN jobs j ON j.id=pj.job_id WHERE pj.property_id=? AND j.status NOT IN ('completed','cancelled','no_show')").get(propertyId)||db.prepare("SELECT 1 FROM recurring_plans WHERE property_id=? AND status!='cancelled'").get(propertyId)))throw new OrganizationError('Locația are lucrări sau serii în curs. Închide-le înainte de eliminarea din organizație.',409);
  if(attach){db.prepare('INSERT INTO workspace_organization_properties VALUES(?,?)').run(propertyId,id);
   if(!organizationModules(db,id).ical)db.prepare("UPDATE workspace_ical_connections SET enabled=0,version=version+1,lease_token=NULL,lease_until=NULL,warning='Sincronizare oprită: modulul iCal nu este activ în organizație.' WHERE property_id=?").run(propertyId);
  }
  else db.prepare('DELETE FROM workspace_organization_properties WHERE property_id=? AND organization_id=?').run(propertyId,id);
  db.prepare('DELETE FROM workspace_ical_missing WHERE connection_id IN (SELECT id FROM workspace_ical_connections WHERE property_id=?)').run(propertyId);
  organizationAudit(db,userId,id,attach?'property.attach':'property.detach',propertyId,{});
 }).immediate();
}
export function inviteOrganization(db:Database,userId:string,id:string,email:unknown,role:unknown){
 return db.transaction(()=>{
  owner(db,userId,id);
  if(typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email.trim())||!['manager','approver','viewer'].includes(String(role)))throw new OrganizationError('Email sau rol invalid.');
  const address=email.trim().toLowerCase();
  const target=db.prepare('SELECT id,role FROM users WHERE lower(email)=?').get(address) as {id:string;role:string}|undefined;
  if(target&&(target.id===userId||target.role!=='client'))throw new OrganizationError('Invită un alt cont client.');
  db.prepare('UPDATE workspace_organization_invites SET revoked=1 WHERE organization_id=? AND email=? AND accepted_by IS NULL').run(id,address);
  const token=randomBytes(32).toString('base64url'),inviteId=randomUUID(),now=new Date();
  db.prepare('INSERT INTO workspace_organization_invites(id,organization_id,token_hash,email,role,expires_at,created_at) VALUES(?,?,?,?,?,?,?)').run(inviteId,id,hash(token),address,role,new Date(now.getTime()+7*86400000).toISOString(),now.toISOString());
  organizationAudit(db,userId,id,'member.invite',inviteId,{email:address,role});return {id:inviteId,token};
 }).immediate();
}
export function acceptOrganizationInvite(db:Database,userId:string,token:string){
 return db.transaction(()=>{
  const invite=db.prepare('SELECT * FROM workspace_organization_invites WHERE token_hash=?').get(hash(token)) as {id:string;organization_id:string;email:string;role:string;revoked:number;expires_at:string;accepted_by:string|null}|undefined;
  if(!invite)return null;
  const user=db.prepare('SELECT email,role FROM users WHERE id=?').get(userId) as {email:string;role:string};
  if(invite.revoked||invite.expires_at<=new Date().toISOString())throw new OrganizationError('Invitația a expirat sau a fost revocată.',409);
  if(user.role!=='client'||user.email.trim().toLowerCase()!==invite.email)throw new OrganizationError('Folosește contul client cu adresa din invitație.',403);
  if(invite.accepted_by){if(invite.accepted_by!==userId)throw new OrganizationError('Invitație deja folosită.',409);return {kind:'organization'}}
  const previous=db.prepare('SELECT role FROM workspace_organization_members WHERE organization_id=? AND user_id=?').get(invite.organization_id,userId) as {role:string}|undefined;
  if(previous&&previous.role!==invite.role)db.prepare("UPDATE workspace_approvals SET status='rejected',decided_at=?,decision_note='Rolul colegului s-a schimbat. Creează o solicitare nouă.' WHERE organization_id=? AND status IN ('pending','approved') AND (requested_by=? OR decided_by=?)").run(new Date().toISOString(),invite.organization_id,userId,userId);
  db.prepare(`INSERT INTO workspace_organization_members VALUES(?,?,?,?,1,?) ON CONFLICT(organization_id,user_id) DO UPDATE SET role=excluded.role,active=1`).run(randomUUID(),invite.organization_id,userId,invite.role,new Date().toISOString());
  db.prepare('UPDATE workspace_organization_invites SET accepted_by=? WHERE id=?').run(userId,invite.id);
  organizationAudit(db,userId,invite.organization_id,'member.accept',invite.id,{role:invite.role});return {kind:'organization'};
 }).immediate();
}
export function revokeOrganizationAccess(db:Database,userId:string,organizationId:string,id:string,kind:'member'|'invite'){
 return db.transaction(()=>{
  owner(db,userId,organizationId);
  if(kind==='member'){
   const member=db.prepare('SELECT user_id FROM workspace_organization_members WHERE id=? AND organization_id=?').get(id,organizationId) as {user_id:string}|undefined;
   if(!member)throw new OrganizationError('Membru inexistent.',404);
   db.prepare('UPDATE workspace_organization_members SET active=0 WHERE id=?').run(id);
   db.prepare('UPDATE workspace_organization_invites SET revoked=1 WHERE organization_id=? AND accepted_by=?').run(organizationId,member.user_id);
   db.prepare(`UPDATE workspace_approvals SET status='rejected',decided_at=?,decision_note='Acces revocat. Solicită o decizie nouă.' WHERE organization_id=? AND status IN ('pending','approved') AND (requested_by=? OR decided_by=?)`).run(new Date().toISOString(),organizationId,member.user_id,member.user_id);
  }else if(!db.prepare('UPDATE workspace_organization_invites SET revoked=1 WHERE id=? AND organization_id=? AND accepted_by IS NULL').run(id,organizationId).changes)throw new OrganizationError('Invitație indisponibilă.',404);
  organizationAudit(db,userId,organizationId,`${kind}.revoke`,id,{});
 }).immediate();
}
export function organizationSnapshot(db:Database,userId:string){
 const organizations=db.prepare(`SELECT o.*,CASE WHEN o.owner_id=? THEN 'owner' ELSE m.role END role FROM workspace_organizations o LEFT JOIN workspace_organization_members m ON m.organization_id=o.id AND m.user_id=? AND m.active=1 WHERE o.owner_id=? OR m.id IS NOT NULL ORDER BY o.name`).all(userId,userId,userId) as (Organization&{role:OrganizationRole})[];
 return organizations.map(o=>({...o,modules:organizationModules(db,o.id),
  properties:db.prepare('SELECT p.id,p.name,p.city,p.cost_center,p.kind FROM workspace_properties p JOIN workspace_organization_properties op ON op.property_id=p.id WHERE op.organization_id=? AND p.archived=0 AND p.owner_id=? ORDER BY p.name').all(o.id,o.owner_id),
  members:o.role==='owner'?db.prepare('SELECT m.id,m.role,u.name,u.email FROM workspace_organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=? AND m.active=1').all(o.id):[],
  invites:o.role==='owner'?db.prepare('SELECT id,email,role,expires_at FROM workspace_organization_invites WHERE organization_id=? AND accepted_by IS NULL AND revoked=0 AND expires_at>?').all(o.id,new Date().toISOString()):[],
  history:o.role==='owner'?db.prepare('SELECT a.action,a.resource_id,a.details,a.created_at,u.name actor FROM workspace_organization_audit a JOIN users u ON u.id=a.actor_id WHERE organization_id=? ORDER BY a.created_at DESC,a.id DESC LIMIT 30').all(o.id):[],
 }));
}
/** Inside the booking transaction, after consuming any approval. No payment is performed here. */
export function enforceOrganizationBooking(db:Database,propertyId:string,jobId:string){
 const org=propertyOrganization(db,propertyId);if(!org)return;
 requirePropertyModule(db,propertyId);
 const job=db.prepare('SELECT client_id,price_gross FROM jobs WHERE id=?').get(jobId) as {client_id:string;price_gross:number};
 if(job.client_id!==org.owner_id)throw new OrganizationError('Titularul organizației finalizează rezervarea.',403);
 const amount=Math.round(job.price_gross*100);
 const approval=db.prepare("SELECT id,organization_id,policy_revision,approval_mode,requested_by,decided_by FROM workspace_approvals WHERE job_id=? AND property_id=? AND status='fulfilled'").get(jobId,propertyId) as {id:string;organization_id:string|null;policy_revision:number|null;approval_mode:string;requested_by:string;decided_by:string|null}|undefined;
 if(approval&&(approval.organization_id!==org.id||approval.policy_revision!==org.revision))throw new OrganizationError('Politica organizației s-a schimbat. Solicită o aprobare nouă.',409);
 if(approval&&!['owner','manager'].includes(organizationRole(db,approval.requested_by,org.id)??''))throw new OrganizationError('Solicitantul nu mai are dreptul de a cere lucrări. Creează o solicitare nouă.',409);
 if(amount>=org.approval_threshold_bani){
  if(!approval||approval.approval_mode!=='manual')throw new OrganizationError('Valoarea atinge pragul organizației. Solicită aprobare manuală din Aprobări și membri.',409);
  if(!approval.decided_by||!['owner','approver'].includes(organizationRole(db,approval.decided_by,org.id)??''))throw new OrganizationError('Aprobatorul nu mai are acces. Solicită o aprobare nouă.',409);
  if(org.separate_approver&&approval.requested_by===approval.decided_by)throw new OrganizationError('Solicitantul nu poate aproba propria cerere.',403);
 }
 db.prepare('INSERT INTO workspace_organization_job_policy VALUES(?,?,?,?,?,?,?) ON CONFLICT(job_id) DO NOTHING').run(jobId,org.id,propertyId,org.revision,amount,approval?.id??null,new Date().toISOString());
}
