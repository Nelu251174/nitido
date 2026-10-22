import type {Database} from 'better-sqlite3';
import {randomUUID,createHash} from 'node:crypto';
import {hostPlan} from './hostTurnover';
import {WorkspaceError,ownProperty} from './workspace';
import {OrganizationError} from './organizations';
import {bucharestDateKey} from './scheduling';
import {calcServicePrice,validBathroomCount,validWindowsSqm,type SpaceType} from './pricing';

export function listHomeMaintenance(db:Database,clientId:string){
 const rows=db.prepare(`SELECT m.id,m.property_id,m.year,m.month,m.windows_sqm,p.name,p.city,p.sqm,p.space_type,p.bathroom_count,p.archived
 FROM home_maintenance_plans m JOIN workspace_properties p ON p.id=m.property_id AND p.owner_id=m.client_id WHERE m.client_id=? AND m.active=1 ORDER BY m.year,m.month,m.id LIMIT 100`).all(clientId) as {id:string;property_id:string;year:number;month:number;windows_sqm:number;name:string;city:string;sqm:number;space_type:SpaceType;bathroom_count:number;archived:number}[];
 return rows.map(r=>{const valid=!r.archived&&Number.isInteger(r.sqm)&&r.sqm>=10&&r.sqm<=1000&&validBathroomCount(r.bathroom_count)&&validWindowsSqm(r.windows_sqm);return {...r,estimate:valid?calcServicePrice(r.space_type,r.sqm,r.windows_sqm,r.bathroom_count):null,bookingHref:valid?'/rezervare?'+new URLSearchParams({propertyId:r.property_id,city:r.city,sqm:String(r.sqm),spaceType:r.space_type,bathroomCount:String(r.bathroom_count),windowsSqm:String(r.windows_sqm)}):null};});
}
export function saveHomeMaintenance(db:Database,clientId:string,b:Record<string,unknown>){
 if(b.action==='archive'){if(typeof b.id!=='string'||!db.prepare('SELECT 1 FROM home_maintenance_plans WHERE id=? AND client_id=?').get(b.id,clientId))throw new WorkspaceError('Plan inexistent.',404);db.prepare('UPDATE home_maintenance_plans SET active=0 WHERE id=? AND client_id=?').run(b.id,clientId);return {ok:true};}
 if(b.action!=='create'||typeof b.propertyId!=='string'||typeof b.requestKey!=='string'||!b.requestKey||b.requestKey.length>100||!Number.isInteger(b.month)||Number(b.month)<1||Number(b.month)>12||!Number.isInteger(b.year)||!validWindowsSqm(b.windowsSqm))throw new WorkspaceError('Confirmă proprietatea, luna, anul și geamurile opționale.',400);
 const today=bucharestDateKey(new Date()),currentYear=Number(today.slice(0,4)),currentMonth=Number(today.slice(5,7));
 if(Number(b.year)<currentYear||Number(b.year)>currentYear+2||Number(b.year)===currentYear&&Number(b.month)<currentMonth)throw new WorkspaceError('Alege o lună viitoare în următorii doi ani.',400);
 const hash=createHash('sha256').update(JSON.stringify([b.propertyId,b.year,b.month,b.windowsSqm])).digest('hex');
 return db.transaction(()=>{ownProperty(db,clientId,b.propertyId as string);const prior=db.prepare('SELECT id,payload_hash FROM home_maintenance_plans WHERE client_id=? AND request_key=?').get(clientId,b.requestKey) as {id:string;payload_hash:string}|undefined;
 if(prior){if(prior.payload_hash!==hash)throw new WorkspaceError('Cererea a fost folosită cu alte date.',409);return {ok:true,id:prior.id};}
 const same=db.prepare('SELECT id,windows_sqm FROM home_maintenance_plans WHERE client_id=? AND property_id=? AND year=? AND month=? AND active=1').get(clientId,b.propertyId,b.year,b.month) as {id:string;windows_sqm:number}|undefined;if(same){if(same.windows_sqm!==b.windowsSqm)throw new WorkspaceError('Există deja un plan pentru această lună. Scoate-l din plan înainte de a schimba geamurile.',409);return {ok:true,id:same.id};}
 if((db.prepare('SELECT COUNT(*) n FROM home_maintenance_plans WHERE client_id=? AND active=1').get(clientId) as {n:number}).n>=100)throw new WorkspaceError('Ai deja 100 de planuri active. Arhivează un plan înainte de a adăuga altul.',409);
 const id=randomUUID();db.prepare('INSERT INTO home_maintenance_plans VALUES(?,?,?,?,?,?,1,?,?,?)').run(id,clientId,b.propertyId,b.year,b.month,b.windowsSqm,b.requestKey,hash,new Date().toISOString());return {ok:true,id};}).immediate();
}
export function hostReadiness(db:Database,clientId:string,after=''){
 if(after.length>100)throw new WorkspaceError('Pagină invalidă.',400);
 const properties=db.prepare("SELECT id,name,city FROM workspace_properties WHERE owner_id=? AND kind='host' AND archived=0 AND id>? ORDER BY id LIMIT 31").all(clientId,after) as {id:string;name:string;city:string}[];
 return {next:properties.length>30?properties[29].id:null,properties:properties.slice(0,30).map(p=>{try{const plan=hostPlan(db,clientId,p.id);return {...p,error:null,windows:plan.windows.map(w=>({...w,state:w.problem?'needs_attention':w.jobStatus==='completed'?'completed':w.jobStatus==='arrived'?'in_progress':w.jobStatus==='accepted'?'accepted':w.jobId?'waiting':'needs_booking',reportHref:w.jobId?'/client?jobId='+encodeURIComponent(w.jobId):null}))};}catch(e){if(!(e instanceof WorkspaceError||e instanceof OrganizationError))throw e;return {...p,error:e.message,windows:[]};}})};
}
export function caseOverview(db:Database,user:{id:string;role:string}){
 if(!['client','firma'].includes(user.role))throw new WorkspaceError('Acces interzis.',403);
 const owner=user.role==='client'?'j.client_id=?':'f.user_id=?';
 return db.prepare(`SELECT c.id,c.job_id,c.category,c.status,c.description,c.created_at,c.updated_at,j.city,
 (SELECT action FROM visit_case_events e WHERE e.case_id=c.id ORDER BY e.created_at DESC,e.id DESC LIMIT 1) last_action
 FROM visit_cases c JOIN jobs j ON j.id=c.job_id LEFT JOIN firms f ON f.id=j.accepted_firm_id WHERE ${owner}
 ORDER BY CASE WHEN c.status IN ('resolved','closed') THEN 1 ELSE 0 END,c.updated_at DESC,c.id LIMIT 100`).all(user.id) as {id:string;job_id:string;category:string;status:string;description:string;created_at:string;updated_at:string;city:string;last_action:string|null}[];
}
