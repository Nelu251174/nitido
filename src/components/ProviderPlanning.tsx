'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useCurrentUser} from '@/lib/useCurrentUser';
import {bucharestDateKey} from '@/lib/scheduling';
import type {ProviderPlanning as Planning} from '@/lib/providerPlanning';
import {UiText} from './UiText';
import {NewBadge} from './NewBadge';
const shift=(date:string,n:number)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const time=(date:string)=>new Intl.DateTimeFormat('ro-RO',{timeZone:'Europe/Bucharest',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(date));
export function ProviderPlanning(){
 const {user,loading,error:authError,retry}=useCurrentUser();
 const [today]=useState(()=>bucharestDateKey(new Date()));
 const [from,setFrom]=useState(today),[data,setData]=useState<(Planning&{ownerId:string})|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 const sequence=useRef(0);
 useEffect(()=>{
  if(!user||user.role!=='firma')return;
  const abort=new AbortController(),request=++sequence.current;
  // Loading follows an explicit period selection or the signed-in firm's initial visit.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setBusy(true);setError('');setData(null);
  fetch('/api/availability/planning?'+new URLSearchParams({from}),{signal:abort.signal}).then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error??'Planificarea nu poate fi încărcată.');if(!Array.isArray(b.days)||b.days.length!==7)throw Error('Răspuns incomplet. Reîncearcă.');if(request===sequence.current)setData({...b,ownerId:user.id});}).catch(e=>{if(!abort.signal.aborted&&request===sequence.current)setError(e instanceof Error?e.message:'Planificarea nu poate fi încărcată.');}).finally(()=>{if(!abort.signal.aborted&&request===sequence.current)setBusy(false)});
  return()=>abort.abort();
 },[user,from,refresh]);
 if(loading)return <p role="status"><UiText text="Se încarcă…"/></p>;
 if(authError)return <div role="alert"><p>{authError}</p><button type="button" className="v2-btn" onClick={retry}><UiText text="Reîncearcă"/></button></div>;
 if(!user)return <Link className="v2-btn v2-btn-primary" href="/login?role=firma&next=%2Ffirma%2Fplanificare"><UiText text="Intră în contul firmei"/></Link>;
 if(user.role!=='firma')return <p role="alert"><UiText text="Această pagină este disponibilă în contul firmei."/></p>;
 return <section className="provider-planning" aria-label="Planificarea firmei"><p className="leading-7"><UiText text="Vezi lucrările confirmate, intervalele declarate și indisponibilitățile. Durata include deplasarea conform regulilor existente. Organizarea oamenilor și echipelor îți aparține."/></p><p className="leading-7"><UiText text="Un interval declarat nu garantează rezervări sau profit. Verificarea și acceptarea fiecărei lucrări rămân obligatorii."/></p>
  <div className="planning-controls"><label><UiText text="Prima zi"/><input type="date" required value={from} min={today} max={shift(today,365)} onChange={e=>{if(e.target.value)setFrom(e.target.value)}}/></label><button type="button" disabled={busy||from<=today} onClick={()=>setFrom(shift(from,-7)<today?today:shift(from,-7))}><UiText text="7 zile înapoi"/></button><button type="button" disabled={busy||shift(from,7)>shift(today,365)} onClick={()=>setFrom(shift(from,7))}><UiText text="7 zile înainte"/></button><button type="button" disabled={busy} onClick={()=>setRefresh(n=>n+1)}><UiText text="Actualizează"/></button></div>
  <Link className="v2-btn my-4" href="/firma/programari"><UiText text="Programări și confirmarea sosirii"/> <NewBadge/></Link>
  <nav className="planning-links" aria-label="Acțiuni de planificare"><Link href="/firma/intervale-libere#publica-interval"><UiText text="Publică un interval"/> <NewBadge/></Link><Link href="/firma/calendar"><UiText text="Deschide calendarul"/></Link><Link href="/firma/echipe"><UiText text="Gestionează echipele"/></Link></nav>
  {busy&&<p role="status"><UiText text="Se verifică planificarea…"/></p>}{error&&<div role="alert"><p>{error}</p><button className="v2-btn" type="button" onClick={()=>setRefresh(n=>n+1)}><UiText text="Reîncearcă"/></button></div>}
  {data&&data.ownerId===user.id&&<><p className="text-sm my-4"><UiText text="Verificat la "/>{time(data.checkedAt)} · Europe/Bucharest</p>{(data.incomplete||data.unplanned>0)&&<p role="alert" className="workspace-error"><UiText text="Planificarea necesită verificare: există lucrări fără program valid sau mai multe înregistrări decât poate afișa acest sumar. Deschide calendarul înainte de acceptare."/></p>}<div className="planning-days">{data.days.map(day=><article key={day.date} className="v2-card p-4"><h2 className="font-bold">{new Intl.DateTimeFormat('ro-RO',{timeZone:'Europe/Bucharest',weekday:'long',day:'numeric',month:'long'}).format(new Date(day.date+'T12:00:00Z'))}</h2><p className="my-3">{day.jobs.length}<UiText text=" lucrări confirmate · "/>{day.openings.length}<UiText text=" intervale declarate · "/>{day.blockedTeams}<UiText text=" echipe cu indisponibilități"/></p>{!day.jobs.length&&!day.openings.length&&!day.blockedTeams&&<p><UiText text="Nicio înregistrare pentru această zi. Nu înseamnă disponibilitate confirmată."/></p>}<ul>{day.jobs.map(j=><li key={j.id}><b>{j.city}</b> · {time(j.startsAt)} — {time(j.endsAt)} · <UiText text={j.status==='arrived'?'În desfășurare':'Acceptată'}/></li>)}{day.openings.map(s=><li key={s.id}><b>{s.city}</b> · {s.team_name}<br/>{time(s.starts_at)} — {time(s.ends_at)}<br/><UiText text={s.approved_at?'Verificat administrativ':'În verificare'}/>{s.needsReview&&<strong className="block"><UiText text="Verifică suprapunerile și indisponibilitățile înainte de a oferi acest interval."/></strong>}</li>)}</ul></article>)}</div></>}
 </section>;
}
