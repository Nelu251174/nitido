'use client';
import {useLocale} from 'next-intl';
import {UiText,UiElement} from '@/components/UiText';
import {useCallback,useEffect,useRef,useState} from 'react';
type Connection={id:string;name:string;hostname:string;enabled:number;connected:number;full_export:number;version:number;last_attempt:string|null;last_success:string|null;next_run:string;error:string;warning:string;event_count:number};

export function HostCalendarSync({propertyId,onChanged}:{propertyId:string;onChanged:()=>Promise<void>}){
 const locale=useLocale();
 const time=(value:string|null)=>value?new Date(value).toLocaleString(locale,{timeZone:'Europe/Bucharest',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Încă nesincronizat';

 const [connection,setConnection]=useState<Connection|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[editing,setEditing]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [moduleEnabled,setModuleEnabled]=useState(true);
 const [sources,setSources]=useState<{source:string}[]>([]),[importSource,setImportSource]=useState('');
 const [name,setName]=useState('Calendar proprietate'),[url,setUrl]=useState(''),[authorized,setAuthorized]=useState(false),[full,setFull]=useState(false);
 const lastSuccess=useRef<string|null|undefined>(undefined),onChangedRef=useRef(onChanged);
 useEffect(()=>{onChangedRef.current=onChanged;},[onChanged]);
 const load=useCallback(async(signal?:AbortSignal)=>{
  try{const r=await fetch(`/api/host-calendar?propertyId=${encodeURIComponent(propertyId)}`,{signal});const d=await r.json();if(!r.ok)throw new Error(d.error);if(signal?.aborted)return;
   setConnection(d.connection);setSources(d.sources??[]);setModuleEnabled(d.moduleEnabled!==false);setLoading(false);
   const success=d.connection?.last_success??null;if(success!==lastSuccess.current){const previous=lastSuccess.current;lastSuccess.current=success;if(previous!==undefined&&success)await onChangedRef.current();}
  }catch(e){if(!signal?.aborted){setError(e instanceof Error?e.message:'Calendar indisponibil.');setLoading(false);}}
 },[propertyId]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- subscribe to the selected property’s asynchronous server status
 useEffect(()=>{const controller=new AbortController();void load(controller.signal);const timer=setInterval(()=>{if(document.visibilityState==='visible')void load(controller.signal);},30000);return()=>{controller.abort();clearInterval(timer);};},[load]);
 async function mutate(action:string){
  setBusy(true);setError('');setNotice('');
  try{const r=await fetch('/api/host-calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,propertyId,version:connection?.version,...(action==='connect'?{name,url,authorized,fullExport:full,importSource}:{})})});const d=await r.json();if(!r.ok)throw new Error(d.error);setConnection(d.connection);setEditing(false);setUrl('');setAuthorized(false);await onChangedRef.current();setNotice(action==='connect'?'Calendar conectat. Prima sincronizare pornește automat în aproximativ un minut.':action==='sync'?'Calendar actualizat.':'Setările calendarului au fost salvate.');}catch(e){setError(e instanceof Error?e.message:'Modificarea nu a reușit.');await load();}finally{setBusy(false);}
 }
 if(!moduleEnabled)return <section className="host-hours"><h3 className="font-bold text-lg"><UiText text={"Sincronizare iCal dezactivată"}/></h3><p><UiText text={"Modulul nu este activ în organizația acestei proprietăți. Titularul îl poate activa din Organizații, apoi poate relua conexiunea calendarului."}/></p><a className="v2-btn v2-btn-secondary mt-3" href="/client/organizatii"><UiText text={"Modulele organizației"}/></a></section>;
 return <UiElement as="section" className="host-hours" id="calendar-automat" aria-label="Sincronizare automată iCal">
  <h3 className="font-bold text-lg"><UiText text={"Calendar conectat · sincronizare automată"}/></h3>
  <p className="booking-muted"><UiText text={"Conectează linkul de export iCal al acestei proprietăți. Verificăm modificările la fiecare 15 minute, inclusiv când pagina este închisă. Perioadele ocupate se actualizează; tu confirmi separat curățenia."}/></p>
  {error&&<p role="alert" className="workspace-error">{<UiText text={error}/>}</p>}{notice&&<p role="status" className="workspace-notice">{<UiText text={notice}/>}</p>}
  {loading?<p role="status"><UiText text={"Se încarcă legătura calendarului…"}/></p>:connection&&<div className="host-proposal">
   <b>{connection.name}</b><p>{connection.hostname} · {!connection.connected?<UiText text={'Deconectat'}/>:connection.enabled?<UiText text={'Sincronizare activă'}/>:<UiText text={'În pauză'}/>}</p>
   <p><UiText text={"Ultima reușită: "}/>{time(connection.last_success)} · {connection.event_count}<UiText text={" evenimente în ultimul export."}/></p>
   {connection.enabled&&<p><UiText text={"Următoarea încercare: "}/>{time(connection.next_run)}<UiText text={" (ora României)."}/></p>}
   {connection.error&&<p role="alert" className="workspace-error">{connection.error}<UiText text={" Datele ultimei sincronizări reușite sunt păstrate."}/></p>}
   {connection.warning&&<p role="status" className="workspace-notice">{connection.warning}</p>}
   <div className="workspace-toolbar">{connection.enabled&&<button className="v2-btn v2-btn-primary" disabled={busy} onClick={()=>void mutate('sync')}><UiText text={"Sincronizează acum"}/></button>}{!!connection.connected&&<><button className="v2-btn v2-btn-secondary" disabled={busy} onClick={()=>void mutate(connection.enabled?'pause':'resume')}>{connection.enabled?<UiText text={'Pune în pauză'}/>:<UiText text={'Reia sincronizarea'}/>}</button><button className="v2-btn v2-btn-secondary" disabled={busy} onClick={()=>{if(window.confirm('Deconectezi calendarul? Perioadele importate și lucrările de curățenie sunt păstrate.'))void mutate('disconnect');}}><UiText text={"Deconectează"}/></button></>}
   <button className="v2-btn v2-btn-secondary" disabled={busy} onClick={()=>{setName(connection.name);setFull(!!connection.full_export);setEditing(true);}}>{connection.connected?<UiText text={'Înlocuiește linkul'}/>:<UiText text={'Reconectează calendarul'}/>}</button></div>
  </div>}
  {!loading&&(!connection||editing)&&<form className="host-stay-editor" onSubmit={e=>{e.preventDefault();void mutate('connect');}}>
   <div className="form-grid"><label><UiText text={"Nume calendar"}/><input required maxLength={60} value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></label><label><UiText text={"Link privat de export iCal"}/><UiElement as="input" type="password" autoComplete="off" required maxLength={4096} placeholder="https://…/calendar.ics" value={url} onChange={e=>setUrl(e.target.value)} disabled={busy}/></label></div>
   {!connection&&sources.length>0&&<label><UiText text={"Ai importat deja acest calendar?"}/><select value={importSource} onChange={e=>setImportSource(e.target.value)} disabled={busy}><option value=""><UiText text={"Calendar nou, diferit de importurile existente"}/></option>{sources.map(s=><option key={s.source} value={s.source}>{s.source}</option>)}</select><span className="booking-muted"><UiText text={"Selectează importul aceluiași calendar pentru a păstra perioadele și lucrările asociate, fără dubluri."}/></span></label>}
   {connection&&<p className="booking-muted"><UiText text={"Înlocuiește linkul numai cu exportul aceluiași calendar și al aceleiași proprietăți. Perioadele deja importate își păstrează legăturile cu lucrările."}/></p>}
   <p className="booking-muted"><UiText text={"În aplicația unde gestionezi perioadele ocupate, caută Export calendar sau iCal și copiază linkul aici. Acceptăm evenimente individuale, cu date întregi sau ore UTC."}/></p>
   <label className="ical-choice"><input type="checkbox" checked={authorized} required onChange={e=>setAuthorized(e.target.checked)} disabled={busy}/><UiText text={"Am dreptul să conectez acest calendar pentru proprietatea selectată."}/></label>
   <label className="ical-choice"><input type="checkbox" checked={full} onChange={e=>setFull(e.target.checked)} disabled={busy}/><UiText text={"Linkul oferă un export complet. Permite detectarea perioadelor eliminate."}/></label>
   <p className="booking-muted"><UiText text={"Pentru export complet, o perioadă viitoare lipsă din intervalul acoperit este anulată după două sincronizări reușite consecutive. Un export gol sau o eroare nu șterge perioadele. Anulările explicite din sursă sunt preluate. Lucrările de curățenie se gestionează separat."}/></p>
   <div className="workspace-toolbar"><button className="v2-btn v2-btn-primary" disabled={busy||!authorized}>{busy?<UiText text={'Se salvează…'}/>:<UiText text={'Conectează calendarul'}/>}</button>{connection&&<button type="button" className="v2-btn v2-btn-secondary" disabled={busy} onClick={()=>{setEditing(false);setUrl('');setAuthorized(false);}}><UiText text={"Renunță"}/></button>}</div>
  </form>}
 </UiElement>;
}
