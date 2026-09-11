import { MIN_LEAD_HOURS, SLOT_HOURS } from "./pricing";
export function bucharestScheduledAt(date:string,hour:number):Date {
  const [year,month,day]=date.split("-").map(Number);
  const target=Date.UTC(year,month-1,day,hour);let instant=target;
  for(let i=0;i<3;i++){
    const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Bucharest",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(instant));
    const get=(key:string)=>Number(parts.find(p=>p.type===key)?.value);
    const displayed=Date.UTC(get("year"),get("month")-1,get("day"),get("hour"),get("minute"),get("second"));
    instant+=target-displayed;
  }
  return new Date(instant);
}

export function bucharestDateKey(date:Date):string {
 return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Bucharest",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
}
/** Civil dates from current apps; legacy timestamps with offsets retain their Romanian calendar day. */
export function bookingDateKey(value:unknown):string|null {
 if(typeof value!=="string")return null;
 const civilPrefix=value.slice(0,10),civil=new Date(`${civilPrefix}T12:00:00Z`);
 if(!Number.isFinite(civil.getTime())||civil.toISOString().slice(0,10)!==civilPrefix)return null;
 let key:string;
 if(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)?$/.test(value))key=value.slice(0,10);
 else if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)){
  const instant=new Date(value);if(!Number.isFinite(instant.getTime()))return null;key=bucharestDateKey(instant);
 }else return null;
 const parsed=new Date(`${key}T12:00:00Z`);
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===key?key:null;
}
export function hasSchedulingLeadTime(instant:Date,now=new Date()):boolean {
 return Number.isFinite(instant.getTime())&&instant.getTime()-now.getTime()>=MIN_LEAD_HOURS*3600000;
}
export function nextBucharestSlot(now=new Date()):Date|null {
 const today=new Date(`${bucharestDateKey(now)}T12:00:00Z`);
 for(let i=0;i<3;i++){
  const day=new Date(today);day.setUTCDate(day.getUTCDate()+i);
  for(const hour of SLOT_HOURS){const instant=bucharestScheduledAt(day.toISOString().slice(0,10),hour);if(hasSchedulingLeadTime(instant,now))return instant;}
 }
 return null;
}
