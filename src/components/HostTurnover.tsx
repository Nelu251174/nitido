'use client';
import Link from 'next/link';
import {useState} from 'react';
import {DesignIcon} from './DesignIcon';
import {HOST_CHECKLIST} from '@/lib/workspaceShared';
import type {JobRow} from '@/lib/types';
type Property={id:string;name:string;notes:string};
type Stay={id:string;property_id:string;starts_at:string;ends_at:string;status:string;imported_at:string};
export type HostCheck={event_id:string;turnover_at:string;item_key:string;done:number;updated_at:string};
const date=(value:string)=>new Date(value).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
export function HostTurnover({properties,events,checks,jobs,links,selected,onSelect,onCheck,busy}:{properties:Property[];events:Stay[];checks:HostCheck[];jobs:JobRow[];links:{property_id:string;job_id:string}[];selected:string;onSelect:(id:string)=>void;onCheck:(payload:Record<string,unknown>,success:string)=>Promise<boolean>;busy:boolean}){
 const [eventId,setEventId]=useState('');
 const [now]=useState(()=>Date.now());
 const property=properties.find(p=>p.id===selected)??properties[0];
 if(!property)return null;
 const stays=events.filter(e=>e.property_id===property.id&&e.status!=='cancelled').sort((a,b)=>a.ends_at.localeCompare(b.ends_at));
 const preceding=stays.filter(e=>Date.parse(e.ends_at)<=now).at(-1);
 const current=stays.find(e=>e.id===eventId)??preceding??stays[0];
 const next=current?stays.filter(e=>e.id!==current.id&&e.starts_at>=current.ends_at).sort((a,b)=>a.starts_at.localeCompare(b.starts_at))[0]:undefined;
 const latest=events.filter(e=>e.property_id===property.id).map(e=>e.imported_at).sort().at(-1);
 const overlap=current&&stays.some(e=>e.id!==current.id&&e.starts_at<current.ends_at&&e.ends_at>current.starts_at);
 const cleaning=current?jobs.filter(j=>links.some(l=>l.property_id===property.id&&l.job_id===j.id)&&j.scheduled_at&&j.scheduled_at>=current.ends_at&&(!next||j.scheduled_at<next.starts_at)&&!['cancelled','no_show'].includes(j.status)).sort((a,b)=>(a.scheduled_at??'').localeCompare(b.scheduled_at??''))[0]:undefined;
 const end=cleaning?.scheduled_at?new Date(Date.parse(cleaning.scheduled_at)+cleaning.duration_minutes*60000).toISOString():null;
 const tooLong=Boolean(end&&next&&end>next.starts_at);
 const done=current?checks.filter(c=>c.event_id===current.id&&c.turnover_at===current.ends_at&&c.done):[];
 const future=Boolean(current&&Date.parse(current.ends_at)>now);
 const ready=done.length===HOST_CHECKLIST.length&&!overlap&&!tooLong;
 return <section className="design-panel host-turnover" id="pregatire"><div className="board-card-heading"><h2><DesignIcon name="calendar"/>Programul proprietății</h2><select aria-label="Proprietate pentru pregătirea sejurului" value={property.id} onChange={e=>{onSelect(e.target.value);setEventId('')}}>{properties.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></div>
  {current&&<label className="host-stay-picker">Pregătire după sejur<select value={current.id} onChange={e=>setEventId(e.target.value)}>{stays.map(s=><option value={s.id} key={s.id}>{date(s.starts_at)} – {date(s.ends_at)}</option>)}</select></label>}
  {(overlap||tooLong)&&<p role="status" className="workspace-error">{overlap?'Există sejururi suprapuse. Verifică rezervările înainte să programezi curățenia.':'Curățenia programată depășește ora sosirii următorilor oaspeți.'}</p>}
  <div className="host-preparation-layout"><div><h3>{property.name}</h3><div className="host-turnover-grid"><article><DesignIcon name="user"/><small>Plecare oaspeți</small><h3>{current?date(current.ends_at):'Importă un sejur'}</h3><p>Eliberare din calendar</p></article><article><DesignIcon name="broom"/><small>Curățenie</small><h3>{cleaning?.scheduled_at?date(cleaning.scheduled_at):'Neprogramată'}</h3><p>{end?`Până la ${date(end)}`:'Alege un interval între sejururi.'}</p><Link className="board-soft-button" href={cleaning?'/client#sec-lucrari':`/client?propertyId=${encodeURIComponent(property.id)}#sec-form`}>{cleaning?'Vezi rezervările':'Rezervă curățenia'} <DesignIcon name="arrow" size={18}/></Link></article><article><DesignIcon name="home"/><small>Sosire oaspeți</small><h3>{next?date(next.starts_at):'Neconfirmată'}</h3><p>Conform calendarului importat</p></article></div>{current&&next&&<p className="host-window">Fereastră între sejururi: {Math.round((Date.parse(next.starts_at)-Date.parse(current.ends_at))/60000)} minute{cleaning?` · Curățenie estimată: ${cleaning.duration_minutes} minute`:''}</p>}</div>
  <section className="host-check-panel" aria-label="Lista de pregătire"><div className="board-card-heading"><h3>Listă de verificare</h3><b>{done.length} / {HOST_CHECKLIST.length}</b></div><p className={ready?'workspace-notice':'booking-muted'}>{ready?'Pregătire confirmată de gazdă':current?'În verificare':'Importă calendarul pentru a verifica fiecare sejur.'}</p>{HOST_CHECKLIST.map(item=><label className="host-check-row" key={item.key}><input type="checkbox" checked={done.some(c=>c.item_key===item.key)} disabled={busy||!current||future} onChange={e=>{if(current)void onCheck({action:'host.check',eventId:current.id,turnoverAt:current.ends_at,key:item.key,done:e.target.checked},'Verificare salvată pentru acest sejur.')}}/>{item.label}</label>)}{future&&<p className="booking-muted">Verificările se confirmă după eliberarea proprietății.</p>}<p className="booking-muted">Lista este separată pentru fiecare sejur și se reia dacă se modifică data eliberării.</p></section></div>
  <div className="host-turnover-footer" id="integrari"><p><b>Preferințe pentru această proprietate</b><br/>{property.notes||'Nu ai adăugat încă instrucțiuni de pregătire.'}</p><p><b>Calendar iCal · import manual</b><br/>{latest?`Ultima actualizare: ${date(latest)}`:'Niciun import'}<br/><a href="#calendar-import" className="underline">Actualizează calendarul</a></p></div>
 </section>;
}
