'use client';
import {UiDate} from '@/components/UiDate';

import {UiText,UiElement} from '@/components/UiText';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import type {DeletionRequest} from '@/lib/accountDeletion';
export function AccountDeletionRequest(){
 const [request,setRequest]=useState<DeletionRequest|null>(null),[authenticated,setAuthenticated]=useState<boolean|null>(null),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();fetch('/api/account/deletion',{cache:'no-store',signal:controller.signal}).then(async r=>{if(r.status===401){setAuthenticated(false);return;}const d=await r.json();if(!r.ok)throw Error(d.error);setAuthenticated(true);setRequest(d.request);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[]);
 async function submit(){if(!confirmed||busy)return;setBusy(true);setError('');try{const r=await fetch('/api/account/deletion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation:'DELETE_ACCOUNT'})}),d=await r.json();if(!r.ok){if(r.status===401)setAuthenticated(false);throw Error(d.error);}setRequest(d.request);setConfirmed(false);}catch(e){setError(e instanceof Error?e.message:'Cererea nu a fost confirmată.');}finally{setBusy(false);}}
 return <UiElement as="section" className="v2-card p-5 space-y-4 min-w-0 max-w-full" aria-label="Solicită ștergerea contului">
  <h2 className="text-xl font-bold"><UiText text={"Inițierea ștergerii contului NITIDO"}/></h2>
  <p><UiText text={"Poți solicita ștergerea contului de client sau prestator și a datelor personale asociate. Autentificarea identifică titularul; solicitarea ajunge în registrul echipei NITIDO pentru procesare."}/></p>
  <p><UiText text={"Ștergerea efectivă necesită verificarea datelor asociate și a obligațiilor de păstrare aplicabile. Această cerere nu anulează lucrări, organizații, plăți sau obligații existente. Nu trimite parole, date de card sau documente aici."}/></p>
  <p><UiText text={"Consultă "}/><Link href="/confidentialitate" className="underline"><UiText text={"politica de confidențialitate"}/></Link><UiText text={" pentru drepturile și prelucrările descrise."}/></p>
  {error&&<p role="alert">{<UiText text={error}/>}</p>}
  {authenticated===null&&!error&&<p role="status"><UiText text={"Se verifică sesiunea…"}/></p>}
  {authenticated===false&&<div className="space-y-3"><p><UiText text={"Autentifică-te în contul pe care dorești să îl ștergi, apoi revino la acest formular."}/></p><Link href="/login?next=%2Fstergere-cont" className="v2-btn v2-btn-primary"><UiText text={"Autentifică-te pentru a continua"}/></Link></div>}
  {authenticated&&request?<div className="space-y-2" role="status"><p><strong>{request.status==='under_review'?<UiText text={'Cererea a fost preluată pentru verificare.'}/>:<UiText text={'Cererea a fost înregistrată.'}/>}</strong><UiText text={" Contul și datele nu sunt încă șterse."}/></p><p className="break-all text-sm"><UiText text={"Referință: "}/>{request.id}</p><p className="text-sm"><UiText text={"Înregistrată: "}/>{<UiDate value={new Date(request.createdAt)} kind="dateTime" options={{timeZone:'Europe/Bucharest'}}/>}</p><p><UiText text={"Confirmarea ștergerii și eventualele date păstrate vor fi comunicate după procesare."}/></p></div>:authenticated&&<form className="space-y-4" onSubmit={e=>{e.preventDefault();void submit();}}><label className="flex gap-3 items-start"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={busy} className="mt-1 shrink-0"/><span><UiText text={"Confirm că solicit ștergerea contului meu și a datelor personale asociate. Înțeleg că trimiterea cererii nu înseamnă că ștergerea a fost deja efectuată."}/></span></label><button className="v2-btn v2-btn-primary max-w-full whitespace-normal" disabled={!confirmed||busy}>{busy?<UiText text={'Se înregistrează…'}/>:<UiText text={'Trimite cererea de ștergere a contului'}/>}</button></form>}
 </UiElement>;
}
