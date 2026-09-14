import type {WebAlert} from './webAlerts';
export function freshAlerts(events:WebAlert[],seen:string[]|null){
 // First connection establishes a baseline rather than announcing historical jobs.
 return {fresh:seen===null?[]:events.filter(e=>!seen.includes(e.id)),seen:[...new Set([...events.map(e=>e.id),...(seen??[])])].slice(0,500)};
}
export function alertHref(role:'client'|'firma',event:WebAlert){return event.kind==='message'?`/${role}/mesaje?job=${encodeURIComponent(event.jobId)}`:`/client?job=${encodeURIComponent(event.jobId)}`;}
