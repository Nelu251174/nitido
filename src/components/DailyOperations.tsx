'use client';
import Link from 'next/link';
import {serviceDate} from '@/lib/calendarView';
import type {JobRow} from '@/lib/types';
export type DailyAction={id:string;city:string;scheduled_at:string|null;issue:number;reschedule:number};
export function DailyOperations({jobs,assignments,actions}:{jobs:JobRow[];assignments:{job_id:string;team_id:string}[];actions:DailyAction[]}){
 const today=serviceDate(new Date());
 const daily=jobs.filter(j=>j.scheduled_at&&serviceDate(j.scheduled_at)===today);
 const confirmed=daily.filter(j=>['accepted','arrived'].includes(j.status));
 const waiting=daily.filter(j=>j.status==='waiting');
 const urgent=confirmed.filter(j=>!assignments.some(a=>a.job_id===j.id)||(j.status==='accepted'&&Date.parse(j.scheduled_at!)<Date.now()));
 const clock=(j:JobRow)=>new Date(j.scheduled_at!).toLocaleTimeString('ro-RO',{timeZone:'Europe/Bucharest',hour:'2-digit',minute:'2-digit'});
 return <section className="design-panel my-5"><h2>Azi · {new Date(`${today}T12:00:00Z`).toLocaleDateString('ro-RO')}</h2><div className="grid gap-5 md:grid-cols-3 my-4"><div><h3 className="font-bold">Confirmate · {confirmed.length}</h3>{confirmed.map(j=><p key={j.id} className="my-2 text-sm"><Link className="underline" href={`/firma?job=${encodeURIComponent(j.id)}`}>{clock(j)} · {j.city} · {j.status==='arrived'?'în lucru':'programată'}</Link></p>)}</div><div><h3 className="font-bold">În așteptare · {waiting.length}</h3><p className="text-xs text-muted">Oportunități de azi, fără alocare confirmată.</p>{waiting.map(j=><p key={j.id} className="my-2 text-sm"><Link className="underline" href={`/firma?job=${encodeURIComponent(j.id)}`}>{clock(j)} · {j.city}</Link></p>)}</div><div><h3 className="font-bold">Acțiuni necesare</h3>{urgent.map(j=><p className="my-2 text-sm" key={j.id}><Link className="underline" href={`/firma?job=${encodeURIComponent(j.id)}`}>{clock(j)} · {j.city}: {!assignments.some(a=>a.job_id===j.id)?'alocă echipa':'sosire neconfirmată'}</Link></p>)}{actions.map(a=><p className="my-2 text-sm" key={a.id}><Link className="underline" href={a.issue?`/remedieri?jobId=${encodeURIComponent(a.id)}`:`/firma?job=${encodeURIComponent(a.id)}`}>{a.city} · {a.issue?'dosar deschis':''}{a.issue&&a.reschedule?' și ':''}{a.reschedule?'reprogramare de soluționat':''}</Link></p>)}{!urgent.length&&!actions.length&&<p className="text-sm my-2">Nicio acțiune restantă.</p>}</div></div></section>;
}
