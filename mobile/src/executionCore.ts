export interface ExecutionItem {key:string;label:string}
export const LEGACY_EXECUTION_ITEMS:ExecutionItem[]=[{key:'surfaces',label:'Suprafețe și mobilier'},{key:'kitchen',label:'Bucătărie'},{key:'bathroom',label:'Băi și obiecte sanitare'},{key:'floors',label:'Aspirare și pardoseli'},{key:'waste',label:'Coșuri și deșeuri'},{key:'inspection',label:'Verificare finală'}];
export function executionItems(items:ExecutionItem[]|undefined){
 if(items===undefined)return LEGACY_EXECUTION_ITEMS;
 if(!Array.isArray(items)||items.length<1||items.length>40||new Set(items.map(item=>item?.key)).size!==items.length||items.some(item=>!item||! /^[-a-z0-9_]{1,40}$/.test(item.key)||typeof item.label!=='string'||!item.label.trim()||item.label.length>300))throw new Error('Lista verificărilor nu a fost confirmată de server. Reîncarcă lucrarea.');
 return items;
}
export function checklistProgress(items:ExecutionItem[],entries:{item_key:string;done:number}[]){
 const count=items.filter(item=>entries.some(entry=>entry.item_key===item.key&&entry.done===1)).length;
 return {count,total:items.length,complete:items.length>0&&count===items.length};
}
