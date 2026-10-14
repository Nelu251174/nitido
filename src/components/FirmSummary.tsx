'use client';
import {UiDate} from '@/components/UiDate';

import {UiText} from '@/components/UiText';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {DesignIcon} from './DesignIcon';
import {firmEarnings} from '@/lib/firmEarnings';
import {money} from '@/lib/workspaceShared';
import type {JobRow} from '@/lib/types';
export function FirmSummary({jobs}:{jobs:JobRow[]}){
 const [teams,setTeams]=useState<{id:string;name:string}[]>([]),[assignments,setAssignments]=useState<{team_id:string;job_id:string}[]>([]),[error,setError]=useState(false);
 useEffect(()=>{let live=true;fetch('/api/workspace').then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{if(live){setTeams(d.teams??[]);setAssignments(d.assignments??[])}}).catch(()=>{if(live)setError(true)});return()=>{live=false}},[]);
 const {days,total,latest}=firmEarnings(jobs);
 const max=Math.max(1,...days.map(d=>d.amount));
 return <aside className="firm-summary"><section className="design-panel"><h2><DesignIcon name="users"/><UiText text={"Echipele tale"}/></h2><p className="booking-muted"><UiText text={"Lucrări active atribuite fiecărei echipe."}/></p>{teams.map(t=><div className="firm-team-row" key={t.id}><DesignIcon name="users"/><div><b>{t.name}</b><p>{assignments.filter(a=>a.team_id===t.id&&jobs.some(j=>j.id===a.job_id&&['accepted','arrived'].includes(j.status))).length}<UiText text={" lucrări active"}/></p></div><Link href="/firma/calendar"><UiText text={"Program"}/></Link></div>)}{!teams.length&&<p className="booking-muted">{error?<UiText text={'Echipele nu au putut fi încărcate.'}/>:<UiText text={'Nu ai adăugat încă o echipă.'}/>}</p>}<Link className="board-soft-button" href="/firma/echipe"><DesignIcon name="plus" size={18}/><UiText text={"Gestionează echipele"}/></Link></section><section className="design-panel"><h2><DesignIcon name="chart"/><UiText text={"Câștiguri · ultimele 7 zile"}/></h2><strong className="board-big-number">{money(total)}</strong><p className="booking-muted"><UiText text={"Valoare netă a lucrărilor finalizate cu plata încasată, pe ziua finalizării. Transferul bancar se verifică separat. Rambursările și disputele sunt excluse."}/></p><div className="firm-chart">{days.map(d=><div key={d.key}><span style={{height:`${d.amount/max*85}px`}}/><small>{d.label}</small><b>{money(d.amount)}</b></div>)}</div></section><section className="design-panel"><h2><DesignIcon name="card"/><UiText text={"Situația încasărilor"}/></h2>{latest?<><strong className="board-big-number">{money(latest.financial!.firmPayout!)}</strong><p className="booking-muted"><UiText text={"Cea mai recentă lucrare finalizată cu încasare confirmată · "}/>{<UiDate value={new Date(latest.completed_at!)} kind="date" options={{timeZone:'Europe/Bucharest'}}/>}</p><p>{latest.financial?.payoutStatus==='paid'?<UiText text={'Virament bancar confirmat'}/>:<UiText text={'Virament bancar neconfirmat'}/>}</p></>:<p className="booking-muted"><UiText text={"Nicio lucrare cu încasare confirmată. Sumele autorizate nu sunt încă încasate."}/></p>}<Link href="/firma#castiguri" className="board-soft-button"><UiText text={"Vezi câștigurile"}/><DesignIcon name="arrow" size={18}/></Link></section></aside>;
}
