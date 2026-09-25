'use client';
import {useCallback,useEffect,useState} from 'react';
import {AdminIncidentTriage} from './AdminIncidentTriage';
import {inputClass} from './ui';
type Review={outcome:string;note:string;created_at:string};
type Case={id:string;job_id:string;category:string;description:string;photo_id:string|null;status:string;updated_at:string;reviews:Review[];events:{action:string;note:string;created_at:string}[]};
const outcomes:Record<string,string>={needs_information:'Solicită informații suplimentare',confirmed:'Problemă confirmată',not_confirmed:'Problemă neconfirmată'};
const categories:Record<string,string>={access:'Acces imposibil',absent:'Client absent',scope:'Scop diferit',damage:'Daună observată',quality:'Calitatea curățeniei',task:'Sarcină nerealizabilă'};
const statuses:Record<string,string>={open:'Deschis',proposed:'Revenire propusă',scheduled:'Revenire programată',resolved:'Soluționat',closed:'Închis'};
export function AdminIncidentReviews(){
 const [cases,setCases]=useState<Case[]>([]),[selected,setSelected]=useState(''),[offset,setOffset]=useState(0),[more,setMore]=useState(false),[note,setNote]=useState(''),[outcome,setOutcome]=useState('needs_information'),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=useCallback(async()=>{try{const r=await fetch(`/api/admin/incident-reviews?offset=${offset}`);const d=await r.json();if(!r.ok)throw Error(d.error);setCases(d.cases);setMore(d.hasMore);}finally{setLoading(false);}},[offset]);
 useEffect(()=>{void load().catch(e=>setError(e.message));},[load]);
 const current=cases.find(c=>c.id===selected);
 async function save(){if(!current||busy||loading)return;setBusy(true);setError('');try{const r=await fetch('/api/admin/incident-reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({caseId:current.id,revision:current.updated_at,outcome,note})});const d=await r.json();if(!r.ok)throw Error(d.error);setNote('');await load();setError('Concluzia a fost înregistrată în istoricul dosarului.');}catch(e){setError(e instanceof Error?e.message:'Salvarea nu a fost confirmată.');}finally{setBusy(false);}}
 return <section id="incidente" className="design-panel my-5 space-y-4">
  <h2 className="font-bold text-xl">Incidente: verificare și concluzii</h2>
  <p>Compară sesizarea, fotografia și răspunsurile din dosar înainte să înregistrezi concluzia. O remediere soluționată nu înseamnă automat că reclamația a fost confirmată. Dacă lipsesc dovezi, precizează ce informații sunt necesare.</p>
  <p className="text-sm">Verificarea este separată de execuție, plată și scorul firmei. Nu acordă automat rambursări, penalizări sau suspendări. Motivul este vizibil clientului și firmei implicate; nu introduce informații interne sau date despre alte persoane.</p>
  {error&&<p role="status">{error}</p>}
  <div className="flex flex-wrap gap-3"><button className="v2-btn v2-btn-secondary" disabled={busy||loading} onClick={()=>{setLoading(true);void load().catch(e=>setError(e.message));}}>Actualizează dosarele</button><button className="v2-btn v2-btn-secondary" disabled={busy||loading||offset===0} onClick={()=>{setLoading(true);setSelected('');setOffset(offset-50);}}>Pagina anterioară</button><button className="v2-btn v2-btn-secondary" disabled={busy||loading||!more} onClick={()=>{setLoading(true);setSelected('');setOffset(offset+50);}}>Pagina următoare</button></div>
  {loading?<p>Se încarcă dosarele…</p>:<label className="block">Alege dosarul · pagina {offset/50+1}<select className={inputClass} disabled={busy} value={selected} onChange={e=>{setSelected(e.target.value);setNote('');setOutcome('needs_information');setError('');}}><option value="">Selectează un dosar ({cases.length})</option>{cases.map(c=><option value={c.id} key={c.id}>{categories[c.category]??c.category} · {statuses[c.status]??c.status} · {c.job_id} · {c.reviews.length?outcomes[c.reviews[0].outcome]:'Neverificat'}</option>)}</select></label>}
  <AdminIncidentTriage caseId={current?.id} caseRevision={current?.updated_at} onSaved={load}/>
  {current&&!loading&&<article className="space-y-3">
   <h3 className="font-bold">{categories[current.category]??current.category} · {statuses[current.status]??current.status}</h3><p className="whitespace-pre-wrap break-words">{current.description}</p>
   {current.photo_id?<a className="underline" href={`/api/uploads/${encodeURIComponent(current.photo_id)}`} target="_blank" rel="noreferrer">Deschide fotografia atașată sesizării</a>:<p>Sesizarea nu are fotografie atașată. Absența fotografiei nu dovedește că sesizarea este nefondată.</p>}
   <details><summary>Răspunsuri și remedieri înregistrate</summary>{current.events.map((e,i)=><p key={i} className="whitespace-pre-wrap break-words my-2">{new Date(e.created_at).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest'})} · {e.note}</p>)}</details>
   <details><summary>Istoricul verificărilor ({current.reviews.length})</summary>{current.reviews.map((r,i)=><p className="whitespace-pre-wrap break-words my-2" key={i}>{new Date(r.created_at).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest'})} · {outcomes[r.outcome]}: {r.note}</p>)}</details>
   <form className="space-y-3" onSubmit={e=>{e.preventDefault();void save();}}><label className="block">Concluzia verificării<select className={inputClass} disabled={busy} value={outcome} onChange={e=>setOutcome(e.target.value)}>{Object.entries(outcomes).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label><label className="block">Motiv și dovezi analizate · vizibile părților<textarea className={inputClass} disabled={busy} required maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label><p className="text-sm">O corecție adaugă o nouă concluzie; istoricul anterior rămâne păstrat. Solicitarea de informații apare în dosar, fără email automat.</p><button className="v2-btn v2-btn-primary" disabled={busy||!note.trim()}>Înregistrează verificarea</button></form>
  </article>}
 </section>;
}
