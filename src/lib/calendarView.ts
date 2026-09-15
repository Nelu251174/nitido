export type CalendarView='day'|'week'|'month';
export const serviceDate=(value:Date|string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const noon=(day:string)=>new Date(`${day}T12:00:00Z`);
const key=(d:Date)=>d.toISOString().slice(0,10);
export function shiftCalendarDate(day:string,amount:number,view:CalendarView){
 const d=noon(day);
 if(view==='month'){const original=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+amount);const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(original,end))}else d.setUTCDate(d.getUTCDate()+amount*(view==='week'?7:1));
 return key(d);
}
export function calendarDays(anchor:string,view:CalendarView){
 const start=noon(anchor);
 if(view==='month')start.setUTCDate(1);
 if(view!=='day')start.setUTCDate(start.getUTCDate()-(start.getUTCDay()+6)%7);
 return Array.from({length:view==='month'?42:view==='week'?7:1},(_,i)=>{const d=new Date(start);d.setUTCDate(d.getUTCDate()+i);return key(d)});
}
export function intersectsServiceDay(start:string,end:string,day:string){
 const first=Date.parse(start),last=Date.parse(end);
 return Number.isFinite(first)&&Number.isFinite(last)&&last>first&&serviceDate(new Date(first))<=day&&serviceDate(new Date(last-1))>=day;
}
