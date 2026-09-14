import {bookingDateKey,bucharestScheduledAt} from './scheduling';
export const HOST_DEFAULTS={arrival_hour:15,departure_hour:11,after_minutes:0,before_minutes:30};
export type HostSettings=typeof HOST_DEFAULTS;
export function hostLocalInstant(day:string,hour:number){
 if(bookingDateKey(day)!==day||!Number.isInteger(hour)||hour<0||hour>23)throw new Error('Data sau ora nu este validă.');
 const instant=bucharestScheduledAt(day,hour);
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(instant);
 const get=(k:string)=>parts.find(p=>p.type===k)?.value;
 if(`${get('year')}-${get('month')}-${get('day')}`!==day||Number(get('hour'))!==hour)throw new Error('Ora aleasă nu există în ziua schimbării orei. Alege altă oră.');
 return instant.toISOString();
}
