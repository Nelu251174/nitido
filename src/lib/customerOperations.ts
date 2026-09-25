import type {Database} from 'better-sqlite3';
import {WorkspaceError,requireText} from './workspace';
import {randomUUID} from 'node:crypto';
export {CUSTOMER_OPERATIONS_SCHEMA} from './operationsSchema';
function client(db:Database,id:unknown){const key=requireText(id,'Client',100);const row=db.prepare("SELECT id,name,email,phone,credit_balance,created_at FROM users WHERE id=? AND role='client'").get(key) as {id:string;name:string;email:string|null;phone:string|null;credit_balance:number;created_at:string}|undefined;if(!row)throw new WorkspaceError('Client inexistent.',404);return row;}
function page(offset:number){if(!Number.isSafeInteger(offset)||offset<0)throw new WorkspaceError('Pagină invalidă.');return offset;}
export function customerDirectory(db:Database,query:string,offset=0){if(query.length>150)throw new WorkspaceError('Căutare prea lungă.');page(offset);const needle='%'+query.replace(/[\\%_]/g,'\\$&')+'%';const rows=db.prepare("SELECT id,name,email FROM users WHERE role='client' AND (id=? OR name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\') ORDER BY name,id LIMIT 51 OFFSET ?").all(query,needle,needle,offset);return {clients:rows.slice(0,50),hasMore:rows.length>50};}
export function customerRecord(db:Database,id:unknown,offset=0){page(offset);return db.transaction(()=>{
 const user=client(db,id),key=user.id;
 const classification=db.prepare('SELECT revision,tags_json,reason,actor_id,created_at FROM customer_classifications WHERE client_id=? ORDER BY revision DESC LIMIT 1').get(key) as {revision:number;tags_json:string;reason:string;actor_id:string;created_at:string}|undefined;
 const slice=(rows:unknown[])=>({rows:rows.slice(0,50),hasMore:rows.length>50});
 const jobs=slice(db.prepare('SELECT id,city,status,mode,price_gross,created_at FROM jobs WHERE client_id=? ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET ?').all(key,offset));
 const assessments=slice(db.prepare('SELECT id,status,created_at FROM service_assessments WHERE client_id=? ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET ?').all(key,offset));
 const payments=slice(db.prepare('SELECT p.id,p.job_id,p.amount_gross,p.status,p.stripe_payment_intent_id,p.refund_status,p.created_at FROM payments p JOIN jobs j ON j.id=p.job_id WHERE j.client_id=? ORDER BY p.created_at DESC,p.id DESC LIMIT 51 OFFSET ?').all(key,offset));
 const cases=slice(db.prepare('SELECT c.id,c.job_id,c.category,c.status,c.created_at FROM visit_cases c JOIN jobs j ON j.id=c.job_id WHERE j.client_id=? ORDER BY c.created_at DESC,c.id DESC LIMIT 51 OFFSET ?').all(key,offset));
 const ratings=slice(db.prepare('SELECT id,job_id,stars,status,moderation_status,created_at FROM ratings WHERE client_id=? ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET ?').all(key,offset));
 const notes=slice(db.prepare('SELECT id,body,actor_id,created_at FROM customer_internal_notes WHERE client_id=? ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET ?').all(key,offset));
 const properties=(db.prepare('SELECT COUNT(*) total FROM workspace_properties WHERE owner_id=? AND archived=0').get(key) as {total:number}).total;
 return {user,classification:classification?{revision:classification.revision,tags:JSON.parse(classification.tags_json) as string[],reason:classification.reason,actor:classification.actor_id,createdAt:classification.created_at}:{revision:0,tags:[] as string[],reason:null,actor:null,createdAt:null},properties,jobs,assessments,payments,cases,ratings,notes,offset};
 })();}
export function changeCustomerOperations(db:Database,input:Record<string,unknown>,actor:string){
 if(!db.inTransaction||!actor)throw new WorkspaceError('Tranzacție administrativă obligatorie.',500);
 const user=client(db,input.clientId),now=new Date().toISOString();
 if(input.action==='note'){const body=requireText(input.note,'Notă',4000),id=randomUUID();db.prepare('INSERT INTO customer_internal_notes VALUES(?,?,?,?,?)').run(id,user.id,body,actor,now);return {clientId:user.id,id};}
 if(input.action!=='classify')throw new WorkspaceError('Acțiune invalidă.');
 const current=db.prepare('SELECT MAX(revision) revision FROM customer_classifications WHERE client_id=?').get(user.id) as {revision:number|null};
 if(input.revision!==(current.revision??0))throw new WorkspaceError('Fișa a fost modificată. Reîncarcă.',409);
 if(!Array.isArray(input.tags)||input.tags.length>12)throw new WorkspaceError('Maximum 12 etichete.');
 const tags=[...new Set(input.tags.map(t=>requireText(t,'Etichetă',60)))];
 const reason=requireText(input.reason,'Motiv',2000),revision=(current.revision??0)+1;
 db.prepare('INSERT INTO customer_classifications VALUES(?,?,?,?,?,?)').run(user.id,revision,JSON.stringify(tags),reason,actor,now);
 return {clientId:user.id,revision};
}
export type CustomerRecord=ReturnType<typeof customerRecord>;
