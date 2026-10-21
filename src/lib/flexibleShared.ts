import {bookingDateKey,bucharestScheduledAt,hasSchedulingLeadTime} from './scheduling';
import {SLOT_HOURS} from './pricing';
export type FlexibleWindow={date:string;from:number;to:number};
export function validateFlexibleWindows(value:unknown,now=new Date()):FlexibleWindow[]{
 if(!Array.isArray(value)||value.length<1||value.length>2)throw new Error('Alege una sau două zile posibile.');
 const dates=new Set<string>();
 return value.map(w=>{if(!w||bookingDateKey(w.date)!==w.date||dates.has(w.date)||!SLOT_HOURS.includes(w.from)||!SLOT_HOURS.includes(w.to)||w.to<w.from||!hasSchedulingLeadTime(bucharestScheduledAt(w.date,w.from),now))throw new Error('Alege zile diferite și intervale viitoare valide pentru începere.');dates.add(w.date);return {date:w.date,from:w.from,to:w.to};}).sort((a,b)=>a.date.localeCompare(b.date));
}
export function withinFlexibleWindows(windows:FlexibleWindow[],start:string){return windows.some(w=>{const a=bucharestScheduledAt(w.date,w.from).getTime(),b=bucharestScheduledAt(w.date,w.to).getTime(),t=Date.parse(start);return Number.isFinite(t)&&t>=a&&t<=b;});}

/** Bounded draft parsing preserves unfinished dates for correction after reload. */
export function readFlexibleDraft(value:string|undefined):FlexibleWindow[]|null{
 if(!value)return null;try{const rows=JSON.parse(value);if(!Array.isArray(rows)||rows.length<1||rows.length>2||rows.some(w=>!w||typeof w.date!=='string'||w.date.length>10||!Number.isInteger(w.from)||!Number.isInteger(w.to)))return null;return rows.map(w=>({date:w.date,from:w.from,to:w.to}));}catch{return null;}
}
