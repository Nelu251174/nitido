'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
type Connection={id:string;name:string;hostname:string;enabled:number;connected:number;full_export:number;version:number;last_attempt:string|null;last_success:string|null;next_run:string;error:string;warning:string;event_count:number};
const time=(value:string|null)=>value?new Date(value).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Încă nesincronizat';
export function HostCalendarSync({propertyId,onChanged}:{propertyId:string;onChanged:()=>Promise<void>}){
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
 if(!moduleEnabled)return <section className="host-hours"><h3 className="font-bold text-lg">Sincronizare iCal dezactivată</h3><p>Modulul nu este activ în organizația acestei proprietăți. Titularul îl poate activa din Organizații, apoi poate relua conexiunea calendarului.</p><a className="v2-btn v2-btn-secondary mt-3" href="/client/organizatii">Modulele organizației</a></section>;
 return <section className="host-hours" id="calendar-automat" aria-label="Sincronizare automată iCal">
  <h3 className="font-bold text-lg">Calendar conectat · sincronizare automată</h3>
  <p className="booking-muted">Conectează linkul de export iCal al acestei proprietăți. Verificăm modificările la fiecare 15 minute, inclusiv când pagina este închisă. Perioadele ocupate se actualizează; tu confirmi separat curățenia.</p>
  {error&&<p role="alert" className="workspace-error">{error}</p>}{notice&&<p role="status" className="workspace-notice">{notice}</p>}
  {loading?<p role="status">Se încarcă legătura calendarului…</p>:connection&&<div className="host-proposal">
   <b>{connection.name}</b><p>{connection.hostname} · {!connection.connected?'Deconectat':connection.enabled?'Sincronizare activă':'În pauză'}</p>
   <p>Ultima reușită: {time(connection.last_success)} · {connection.event_count} evenimente în ultimul export.</p>
   {connection.enabled&&<p>Următoarea încercare: {time(connection.next_run)} (ora României).</p>}
   {connection.error&&<p role="alert" className="workspace-error">{connection.error} Datele ultimei sincronizări reușite sunt păstrate.</p>}
   {connection.warning&&<p role="status" className="workspace-notice">{connection.warning}</p>}
   <div className="workspace-toolbar">{connection.enabled&&<button className="v2-btn v2-btn-primary" disabled={busy} onClick={()=>void mutate('sync')}>Sincronizează acum</button>}{!!connection.connected&&<><button className="v2-btn v2-btn-secondary" disabled={busy} onClick={()=>void mutate(connection.enabled?'pause':'resume')}>{connection.enabled?'Pune în pauză':'Reia sincronizarea'}</button><button className="v2-btn v2-btn-secondary" disabled={busy} onClick={()=>{if(window.confirm('Deconectezi calendarul? Perioadele importate și lucrările de curățenie sunt păstrate.'))void mutate('disconnect');}}>Deconectează</button></>}
   <button className="v2-btn v2-btn-secondary" disabled={busy} onClick={()=>{setName(connection.name);setFull(!!connection.full_export);setEditing(true);}}>{connection.connected?'Înlocuiește linkul':'Reconectează calendarul'}</button></div>
  </div>}
  {!loading&&(!connection||editing)&&<form className="host-stay-editor" onSubmit={e=>{e.preventDefault();void mutate('connect');}}>
   <div className="form-grid"><label>Nume calendar<input required maxLength={60} value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></label><label>Link privat de export iCal<input type="password" autoComplete="off" required maxLength={4096} placeholder="https://…/calendar.ics" value={url} onChange={e=>setUrl(e.target.value)} disabled={busy}/></label></div>
   {!connection&&sources.length>0&&<label>Ai importat deja acest calendar?<select value={importSource} onChange={e=>setImportSource(e.target.value)} disabled={busy}><option value="">Calendar nou, diferit de importurile existente</option>{sources.map(s=><option key={s.source} value={s.source}>{s.source}</option>)}</select><span className="booking-muted">Selectează importul aceluiași calendar pentru a păstra perioadele și lucrările asociate, fără dubluri.</span></label>}
   {connection&&<p className="booking-muted">Înlocuiește linkul numai cu exportul aceluiași calendar și al aceleiași proprietăți. Perioadele deja importate își păstrează legăturile cu lucrările.</p>}
   <p className="booking-muted">În aplicația unde gestionezi perioadele ocupate, caută Export calendar sau iCal și copiază linkul aici. Acceptăm evenimente individuale, cu date întregi sau ore UTC.</p>
   <label className="ical-choice"><input type="checkbox" checked={authorized} required onChange={e=>setAuthorized(e.target.checked)} disabled={busy}/>Am dreptul să conectez acest calendar pentru proprietatea selectată.</label>
   <label className="ical-choice"><input type="checkbox" checked={full} onChange={e=>setFull(e.target.checked)} disabled={busy}/>Linkul oferă un export complet. Permite detectarea perioadelor eliminate.</label>
   <p className="booking-muted">Pentru export complet, o perioadă viitoare lipsă din intervalul acoperit este anulată după două sincronizări reușite consecutive. Un export gol sau o eroare nu șterge perioadele. Anulările explicite din sursă sunt preluate. Lucrările de curățenie se gestionează separat.</p>
   <div className="workspace-toolbar"><button className="v2-btn v2-btn-primary" disabled={busy||!authorized}>{busy?'Se salvează…':'Conectează calendarul'}</button>{connection&&<button type="button" className="v2-btn v2-btn-secondary" disabled={busy} onClick={()=>{setEditing(false);setUrl('');setAuthorized(false);}}>Renunță</button>}</div>
  </form>}
 </section>;
}
