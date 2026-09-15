import type {AssessmentInput, Assessment, AssessmentStatus} from '../../src/lib/assessmentShared';
export type {Assessment, AssessmentInput};
export const ASSESSMENT_CATEGORIES = [['maintenance','Întreținere'],['general','Curățenie generală'],['renovation','După renovare'],['moving','Mutare'],['office','Birouri'],['host','Pregătire proprietăți turistice']] as const;
export const STATUS_LABELS: Record<AssessmentStatus,string> = {submitted:'Trimisă spre evaluare',needs_details:'Sunt necesare completări',reviewed:'Evaluare primită',declined:'Cerere nepreluată',cancelled:'Anulată'};
export const QUANTITIES = [['sqm','Suprafață, m²',1,1000000],['rooms','Camere',0,10000],['bathrooms','Băi',0,10000],['appliances','Aparate de curățat',0,1000000],['windowsSqm','Geamuri, m²',0,1000000],['linenSets','Seturi de lenjerie',0,1000000],['extraHours','Ore suplimentare',0,10000]] as const;
type Quantity = typeof QUANTITIES[number][0];
export type AssessmentDraft = Omit<AssessmentInput,Quantity> & Record<Quantity,string>;
export function emptyAssessment(city = '', sqm = '100'): AssessmentDraft {
 return {category:'general',city,sqm,rooms:'0',bathrooms:'0',difficulty:'normal',notes:'',appliances:'0',windowsSqm:'0',linenSets:'0',extraHours:'0'};
}
export function assessmentInput(draft: AssessmentDraft): AssessmentInput {
 if (!ASSESSMENT_CATEGORIES.some(([key])=>key===draft.category)) throw new Error('Alege un serviciu.');
 if (!['light','normal','heavy'].includes(draft.difficulty)) throw new Error('Alege dificultatea.');
 if (!draft.city.trim() || draft.city.length>100) throw new Error('Completează localitatea, maximum 100 de caractere.');
 if (!draft.notes.trim() || draft.notes.length>4000) throw new Error('Descrie lucrarea, maximum 4000 de caractere.');
 const values = {} as Record<Quantity,number>;
 for(const [key,label,min,max] of QUANTITIES){const value=draft[key].trim();const n=Number(value);if(!/^\d+$/.test(value)||!Number.isSafeInteger(n)||n<min||n>max)throw new Error(`${label}: introdu un număr întreg între ${min} și ${max}.`);values[key]=n;}
 return {category:draft.category,city:draft.city.trim(),difficulty:draft.difficulty,notes:draft.notes.trim(),...values};
}
export function assessmentIsOpen(request: Pick<Assessment,'status'>){return request.status==='submitted'||request.status==='needs_details';}
type Requester = <T>(path:string,init?:RequestInit)=>Promise<T>;
// The key survives uncertain network results for the same payload. It carries no authorization.
export function assessmentSubmitter(request:Requester,makeKey:()=>string){
 let previous: {payload:string;key:string}|null=null;
 return async (input:AssessmentInput)=>{
  const payload=JSON.stringify(input);
  if(previous?.payload!==payload)previous={payload,key:makeKey()};
  const result=await request<{id:string}>('/api/assessments',{method:'POST',body:JSON.stringify({action:'create',input,requestKey:previous.key})});
  if(typeof result.id!=='string'||!result.id)throw new Error('Confirmarea nu a fost primită. Reîncearcă aceeași cerere.');
  return result.id;
 };
}
export async function actOnAssessment(request:Requester,item:Assessment,action:'reply'|'cancel',body=''){
 if(!assessmentIsOpen(item))throw new Error('Cererea este închisă.');
 if(action==='reply'&&(!body.trim()||body.length>4000))throw new Error('Completează mesajul, maximum 4000 de caractere.');
 const result=await request<{ok:boolean}>('/api/assessments',{method:'POST',body:JSON.stringify({id:item.id,version:item.version,action,body:body.trim()})});
 if(result.ok!==true)throw new Error('Confirmarea actualizării nu a fost primită. Reîncarcă cererea.');
}
