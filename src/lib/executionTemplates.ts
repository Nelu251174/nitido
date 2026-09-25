import type {Database} from 'better-sqlite3';
import {CHECKLIST} from './workspaceShared';
import {EXECUTION_SCOPES,type ExecutionItem,type ExecutionTemplate} from './executionTemplatesShared';
export class ExecutionTemplateError extends Error{constructor(message:string,public status=400){super(message)}}
function validScope(scope:unknown):string{if(typeof scope!=='string'||!EXECUTION_SCOPES.some(s=>s[0]===scope))throw new ExecutionTemplateError('Serviciu invalid.');return scope;}
export function executionTemplate(db:Database,scope:string):ExecutionTemplate{
 validScope(scope);
 const row=db.prepare('SELECT revision,items_json,reason,actor_id,created_at FROM execution_templates WHERE scope=? ORDER BY revision DESC LIMIT 1').get(scope) as {revision:number;items_json:string;reason:string;actor_id:string;created_at:string}|undefined;
 return row?{scope,revision:row.revision,items:JSON.parse(row.items_json),reason:row.reason,actor:row.actor_id,createdAt:row.created_at}:{scope,revision:0,items:CHECKLIST.map(i=>({...i})),reason:null,actor:null,createdAt:null};
}
export function executionTemplates(db:Database){return EXECUTION_SCOPES.map(([scope])=>executionTemplate(db,scope));}
export function saveExecutionTemplate(db:Database,b:Record<string,unknown>,actor:string){
 if(!db.inTransaction||!actor)throw new ExecutionTemplateError('Tranzacție administrativă obligatorie.',500);
 const scope=validScope(b.scope),current=executionTemplate(db,scope);
 if(b.revision!==current.revision)throw new ExecutionTemplateError('Lista a fost modificată. Reîncarcă.',409);
 if(typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>2000)throw new ExecutionTemplateError('Motiv obligatoriu, maximum 2.000 de caractere.');
 if(!Array.isArray(b.items)||b.items.length<1||b.items.length>40)throw new ExecutionTemplateError('Lista trebuie să aibă între 1 și 40 de sarcini.');
 const keys=new Set<string>();
 const items:ExecutionItem[]=b.items.map(item=>{
  if(!item||typeof item!=='object'||typeof item.key!=='string'||!/^[-a-z0-9_]{1,40}$/.test(item.key)||keys.has(item.key)||typeof item.label!=='string'||!item.label.trim()||item.label.length>300)throw new ExecutionTemplateError('Fiecare sarcină are nevoie de un cod unic și o descriere de maximum 300 de caractere.');
  keys.add(item.key);return {key:item.key,label:item.label.trim()};
 });
 const revision=current.revision+1;
 db.prepare('INSERT INTO execution_templates VALUES(?,?,?,?,?,?)').run(scope,revision,JSON.stringify(items),b.reason.trim(),actor,new Date().toISOString());
 return {scope,revision};
}
// Missing snapshots are historical jobs: never resolve them against today's template.
export function jobExecutionRules(db:Database,jobId:string):{scope:string;revision:number;items:ExecutionItem[]}{
 const row=db.prepare('SELECT scope,revision,items_json FROM job_execution_rules WHERE job_id=?').get(jobId) as {scope:string;revision:number;items_json:string}|undefined;
 return row?{scope:row.scope,revision:row.revision,items:JSON.parse(row.items_json)}:{scope:'legacy',revision:0,items:CHECKLIST.map(i=>({...i}))};
}
// Must run during creation, after mode/service is resolved, within the creation transaction.
export function freezeExecutionRules(db:Database,jobId:string,scope:string,parentJobId?:string){
 if(!db.inTransaction)throw new ExecutionTemplateError('Tranzacție obligatorie.',500);
 if(db.prepare('SELECT 1 FROM job_execution_rules WHERE job_id=?').get(jobId))return;
 const rules=parentJobId?jobExecutionRules(db,parentJobId):executionTemplate(db,scope);
 db.prepare('INSERT INTO job_execution_rules VALUES(?,?,?,?,?)').run(jobId,rules.scope,rules.revision,JSON.stringify(rules.items),new Date().toISOString());
}
