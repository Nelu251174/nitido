import type {JobRow} from './types';
// Captured job values grouped by completion day, not bank deposit dates.
export function firmEarnings(jobs:JobRow[],now=new Date()){
 const day=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
 const today=day(now);
 const eligible=jobs.filter(j=>j.status==='completed'&&j.completed_at&&Number.isFinite(Date.parse(j.completed_at))&&j.financial?.paymentStatus==='captured'&&(!j.financial.refundStatus||j.financial.refundStatus==='none')&&(!j.financial.disputeStatus||j.financial.disputeStatus==='none')&&typeof j.financial.firmPayout==='number'&&Number.isFinite(j.financial.firmPayout)&&j.financial.firmPayout>=0);
 const days=Array.from({length:7},(_,i)=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-6+i);const key=day(d);return {key,label:d.toLocaleDateString('ro-RO',{timeZone:'Europe/Bucharest',weekday:'short'}),amount:Math.round(eligible.filter(j=>day(new Date(j.completed_at!))===key).reduce((n,j)=>n+j.financial!.firmPayout!,0)*100)/100}});
 return {days,total:Math.round(days.reduce((n,d)=>n+d.amount,0)*100)/100,latest:[...eligible].sort((a,b)=>b.completed_at!.localeCompare(a.completed_at!))[0]};
}
