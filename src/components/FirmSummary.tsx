'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {DesignIcon} from './DesignIcon';
import type {JobRow} from '@/lib/types';
export function FirmSummary({jobs}:{jobs:JobRow[]}){
 const [teams,setTeams]=useState<{id:string;name:string}[]>([]),[assignments,setAssignments]=useState<{team_id:string;job_id:string}[]>([]),[error,setError]=useState(false);
 useEffect(()=>{let live=true;fetch('/api/workspace').then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{if(live){setTeams(d.teams??[]);setAssignments(d.assignments??[])}}).catch(()=>{if(live)setError(true)});return()=>{live=false}},[]);
 const complete=jobs.filter(j=>j.status==='completed');
 const counts=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return {label:d.toLocaleDateString('ro-RO',{weekday:'short'}),count:complete.filter(j=>j.completed_at&&new Date(j.completed_at).toLocaleDateString()===d.toLocaleDateString()).length}});
 const max=Math.max(1,...counts.map(c=>c.count));
 return <aside className="firm-summary"><section className="design-panel"><h2><DesignIcon name="users"/>Echipele tale</h2><p className="booking-muted">Lucrări active atribuite fiecărei echipe.</p>{teams.map(t=><div className="firm-team-row" key={t.id}><DesignIcon name="users"/><div><b>{t.name}</b><p>{assignments.filter(a=>a.team_id===t.id&&jobs.some(j=>j.id===a.job_id&&['accepted','arrived'].includes(j.status))).length} lucrări active</p></div><Link href="/firma/calendar">Program</Link></div>)}{!teams.length&&<p className="booking-muted">{error?'Echipele nu au putut fi încărcate.':'Nu ai adăugat încă o echipă.'}</p>}<Link className="board-soft-button" href="/firma/echipe"><DesignIcon name="plus" size={18}/>Gestionează echipele</Link></section><section className="design-panel"><h2><DesignIcon name="chart"/>Ultimele 7 zile</h2><strong className="board-big-number">{counts.reduce((n,c)=>n+c.count,0)}</strong><p className="booking-muted">Lucrări finalizate</p><div className="firm-chart">{counts.map((c,i)=><div key={i}><span style={{height:`${Math.max(3,c.count/max*85)}px`}}/><small>{c.label}</small><b>{c.count}</b></div>)}</div></section><section className="design-panel"><h2><DesignIcon name="card"/>Situația încasărilor</h2><p className="booking-muted">Verifică separat starea încasării și a transferului pentru fiecare lucrare.</p><Link href="/firma#castiguri" className="board-soft-button">Vezi câștigurile<DesignIcon name="arrow" size={18}/></Link></section></aside>;
}
