import type {Database} from 'better-sqlite3';
import {saveProperty,WorkspaceError} from './workspace';
export const PROPERTY_CSV_HEADER='name,city,street,sqm,space_type,kind,cost_center,budget_ron,notes';
const columns=PROPERTY_CSV_HEADER.split(',');
type Item={name:string;city:string;street:string;sqm:number;space_type:string;kind:string;cost_center:string;budget_bani:number;notes:string};
export type PropertyImportRow={row:number;name:string;city:string;street:string;status:'new'|'duplicate'|'invalid';errors:string[];values:Record<string,string>};
function parse(text:string):string[][]{
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++}else{quoted=false;closed=true}}else field+=c;continue}
 if(c==='"'){if(field||closed)throw new WorkspaceError('Ghilimele CSV invalide.');quoted=true;continue}
 if(c===','||c==='\n'||c==='\r'){row.push(field);field='';closed=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;rows.push(row);row=[];if(rows.length>201)throw new WorkspaceError('Maximum 200 de locații per import.')}continue}
 if(closed)throw new WorkspaceError('Separator CSV invalid după un câmp.');field+=c;
 }
 if(quoted)throw new WorkspaceError('Câmp CSV neînchis.');if(field||row.length||closed){row.push(field);rows.push(row)}return rows;
}
const normalized=(s:string)=>s.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('ro');
const key=(p:{name:string;city:string;street:string})=>JSON.stringify([p.name,p.city,p.street].map(normalized));
function plan(db:Database,owner:string,csv:unknown){
 if(!db.prepare("SELECT id FROM users WHERE id=? AND role='client'").get(owner))throw new WorkspaceError('Acces interzis',403);
 if(typeof csv!=='string'||Buffer.byteLength(csv)>500000)throw new WorkspaceError('Fișier invalid sau mai mare de 500 KB.');
 const lines=parse(csv.replace(/^\uFEFF/,''));if(lines[0]?.map(s=>s.trim()).join(',')!==PROPERTY_CSV_HEADER)throw new WorkspaceError('Coloanele nu corespund modelului CSV.');
 if(lines.length<2||lines.length>201)throw new WorkspaceError('Importul trebuie să conțină între 1 și 200 de locații.');
 const existing=db.prepare('SELECT name,city,street FROM workspace_properties WHERE owner_id=?').all(owner) as Item[];
 const seen=new Set(existing.map(key));const items:Item[]=[];const rows:PropertyImportRow[]=[];
 lines.slice(1).forEach((cells,index)=>{
  const errors:string[]=[];if(cells.length!==columns.length)errors.push('Număr incorect de coloane.');
  const values=Object.fromEntries(columns.map((c,i)=>[c,(cells[i]??'').trim()]));
  for(const [c,max] of [['name',100],['city',100],['street',250]] as const)if(!values[c]||values[c].length>max)errors.push(`${c}: obligatoriu, maximum ${max} caractere.`);
  if(!/^\d+$/.test(values.sqm)||Number(values.sqm)<1||Number(values.sqm)>1000)errors.push('Suprafață: număr întreg între 1 și 1000.');
  if(!['apartament','casa','birou','altul'].includes(values.space_type))errors.push('Tip spațiu invalid.');
  if(!['home','business','host'].includes(values.kind))errors.push('Utilizare invalidă.');
  const amount=values.budget_ron||'0';if(!/^\d+(\.\d{1,2})?$/.test(amount)||Number(amount)>1000000)errors.push('Buget: 0–1.000.000 RON, maximum două zecimale, separator punct.');
  if(values.cost_center.length>100||values.notes.length>2000)errors.push('Centru de cost sau note prea lungi.');
  const item:Item={name:values.name,city:values.city,street:values.street,sqm:Number(values.sqm),space_type:values.space_type,kind:values.kind,cost_center:values.cost_center,budget_bani:Math.round(Number(amount)*100),notes:values.notes};
  const duplicate=seen.has(key(item));const status=errors.length?'invalid':duplicate?'duplicate':'new';
  rows.push({row:index+2,name:item.name,city:item.city,street:item.street,status,errors,values});
  if(status==='new'){seen.add(key(item));items.push(item)}
 });return {rows,items};
}
export function previewPropertyImport(db:Database,owner:string,csv:unknown){return {rows:plan(db,owner,csv).rows}}
export function commitPropertyImport(db:Database,owner:string,csv:unknown){return db.transaction(()=>{
 const result=plan(db,owner,csv);if(result.rows.some(r=>r.status==='invalid'))throw new WorkspaceError('Corectează rândurile invalide înainte de import.');
 for(const item of result.items)saveProperty(db,owner,item);
 return {created:result.items.length,skipped:result.rows.filter(r=>r.status==='duplicate').length};
})()}
