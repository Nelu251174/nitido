import type Database from 'better-sqlite3';
import {calculateInternationalCost,InternationalCostError,validateInternationalCostInput,type InternationalCostInput} from './adminInternationalCosts';
export const INTERNATIONAL_DRAFT_SCHEMA=`CREATE TABLE IF NOT EXISTS international_cost_drafts(
 id TEXT PRIMARY KEY,country_code TEXT NOT NULL CHECK(country_code<>'RO'),currency TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0),status TEXT NOT NULL DEFAULT 'draft' CHECK(status='draft'),
 input_json TEXT NOT NULL,updated_by TEXT NOT NULL,updated_at TEXT NOT NULL
);`;
export type InternationalDraft={id:string;revision:number;input:InternationalCostInput;updatedAt:string;calculation:ReturnType<typeof calculateInternationalCost>};
type Row={id:string;revision:number;input_json:string;updated_at:string};
const read=(r:Row):InternationalDraft=>{const input=validateInternationalCostInput(JSON.parse(r.input_json));return {id:r.id,revision:r.revision,input,updatedAt:r.updated_at,calculation:calculateInternationalCost(input)};};
function exists(db:Database.Database){return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='international_cost_drafts'").get();}
/** Reads do not create schema, pricing versions or activation settings. */
export function listInternationalDrafts(db:Database.Database):InternationalDraft[]{
 if(!exists(db))return [];
 return (db.prepare('SELECT id,revision,input_json,updated_at FROM international_cost_drafts ORDER BY updated_at DESC,id LIMIT 100').all() as Row[]).map(read);
}
export function saveInternationalDraft(db:Database.Database,id:unknown,revision:unknown,value:unknown,actor:string){
 if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||typeof revision!=='number'||!Number.isSafeInteger(revision)||revision<0)throw new InternationalCostError('Identificatorul sau revizia este invalidă.');
 const input=validateInternationalCostInput(value),json=JSON.stringify(input);
 // Calculate before writing; malformed/overflowing cost profiles cannot be saved.
 calculateInternationalCost(input);
 db.exec(INTERNATIONAL_DRAFT_SCHEMA);
 const current=db.prepare('SELECT id,revision,input_json,updated_at FROM international_cost_drafts WHERE id=?').get(id) as Row|undefined;
 if(current){
  // A retry of the same create/update is idempotent, including its local audit.
  if(current.input_json===json&&(revision===current.revision||revision===current.revision-1))return {draft:read(current),changed:false};
  if(revision!==current.revision)throw new InternationalCostError('Calculul a fost modificat între timp. Reîncarcă versiunea înainte de salvare.',409);
  db.prepare('UPDATE international_cost_drafts SET country_code=?,currency=?,revision=revision+1,input_json=?,updated_by=?,updated_at=? WHERE id=? AND revision=?').run(input.countryCode,input.currency,json,actor,new Date().toISOString(),id,revision);
 }else{
  if(revision!==0)throw new InternationalCostError('Calculul nu mai este disponibil.',409);
  db.prepare('INSERT INTO international_cost_drafts(id,country_code,currency,revision,input_json,updated_by,updated_at) VALUES (?,?,?,1,?,?,?)').run(id,input.countryCode,input.currency,json,actor,new Date().toISOString());
 }
 return {draft:read(db.prepare('SELECT id,revision,input_json,updated_at FROM international_cost_drafts WHERE id=?').get(id) as Row),changed:true};
}
