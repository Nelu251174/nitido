'use client';
import Link from 'next/link';
import {useState} from 'react';
import {DesignIcon} from './DesignIcon';
type Property={id:string;name:string;notes:string};
type Stay={id:string;property_id:string;starts_at:string;ends_at:string;status:string;imported_at:string};
const date=(value:string)=>new Date(value).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
export function HostTurnover({properties,events}:{properties:Property[];events:Stay[]}){
 const [selected,setSelected]=useState('');
 const [now]=useState(()=>Date.now());
 const property=properties.find(p=>p.id===selected)??properties[0];
 if(!property)return null;
 const stays=events.filter(e=>e.property_id===property.id&&e.status!=='cancelled').sort((a,b)=>a.ends_at.localeCompare(b.ends_at));
 const current=stays.find(e=>new Date(e.ends_at).getTime()>=now);
 const next=current?stays.find(e=>e.id!==current.id&&e.starts_at>=current.ends_at):undefined;
 const latest=events.filter(e=>e.property_id===property.id).map(e=>e.imported_at).sort().at(-1);
 const overlap=current&&stays.some(e=>e.id!==current.id&&e.starts_at<current.ends_at&&e.ends_at>current.starts_at);
 return <section className="design-panel host-turnover"><div className="board-card-heading"><h2><DesignIcon name="calendar"/>Între două sejururi</h2><select aria-label="Proprietate pentru pregătirea sejurului" value={property.id} onChange={e=>setSelected(e.target.value)}>{properties.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></div>
  {overlap&&<p role="status" className="workspace-error">Există sejururi suprapuse. Verifică rezervările înainte să programezi curățenia.</p>}
  <div className="host-turnover-grid"><article><DesignIcon name="user"/><small>Eliberarea proprietății</small><h3>{current?date(current.ends_at):'Niciun sejur viitor importat'}</h3><p>Conform calendarului importat.</p></article><article><DesignIcon name="broom"/><small>Curățenie</small><h3>Programează intervalul</h3><p>Verifică rezervarea și raportul lucrării în cont.</p><Link className="board-soft-button" href={`/client?propertyId=${encodeURIComponent(property.id)}#sec-form`}>Rezervă curățenia <DesignIcon name="arrow" size={18}/></Link></article><article><DesignIcon name="home"/><small>Următorii oaspeți</small><h3>{next?date(next.starts_at):'Sosire neconfirmată în calendar'}</h3><p>Starea de pregătire nu se deduce automat dintr-un import.</p></article></div>
  <div className="host-turnover-footer"><p><b>Preferințe pentru această proprietate</b><br/>{property.notes||'Nu ai adăugat încă instrucțiuni de pregătire.'}</p><p><b>Ultimul import manual</b><br/>{latest?date(latest):'Niciun import'}</p></div>
 </section>;
}
