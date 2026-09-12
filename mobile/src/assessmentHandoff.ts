import {emptyAssessment,type AssessmentDraft} from './assessmentCore';
import type {PostJobDraft} from './postJobCore';
export function assessmentFromBooking(draft:PostJobDraft):AssessmentDraft {
 const notes=[draft.details.trim(),draft.street.trim()?`Adresă: ${draft.street.trim()}`:'',draft.floor.trim()?`Etaj / acces: ${draft.floor.trim()}`:'',draft.postalCode.trim()?`Cod poștal: ${draft.postalCode.trim()}`:'',draft.scheduledDate?`Data dorită: ${draft.scheduledDate}${draft.scheduledHour===null?'':` · ora ${String(draft.scheduledHour).padStart(2,'0')}:00`}`:''].filter(Boolean).join('\n');
 return {...emptyAssessment(draft.city,draft.sqm),category:draft.spaceType==='birou'?'office':'general',notes};
}
// One short-lived handoff per owner, in memory only. No address or instructions in route URLs.
export function createAssessmentHandoff(now=()=>Date.now()) {
 let pending:{owner:string;id:string;expires:number;draft:AssessmentDraft}|null=null;
 let sequence=0;
 return {
  put(owner:string,draft:AssessmentDraft){if(!owner)throw new Error('Autentificare necesară.');const id=`assessment-${now()}-${++sequence}`;pending={owner,id,expires:now()+10*60*1000,draft:{...draft}};return id;},
  take(owner:string,id:string){if(!pending)return null;if(pending.expires<=now()){pending=null;return null;}if(pending.owner!==owner||pending.id!==id)return null;const result={...pending.draft};pending=null;return result;},
  clear(){pending=null;},
 };
}
export const assessmentHandoff=createAssessmentHandoff();
