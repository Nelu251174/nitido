'use client';
import {useEffect,useRef,useState} from 'react';
import {UiText} from './UiText';
import {currentInternationalLocation} from '@/lib/currentInternationalLocation';
import type {InternationalLocation} from '@/lib/internationalBookingLocation';

export function InternationalBookingLocation({location,onDetected,onLocate,contextKey='',enabled=true}:{location:InternationalLocation;onDetected:(address:InternationalLocation)=>void;onLocate?:()=>void;contextKey?:string;enabled?:boolean}){
 const [configured,setConfigured]=useState<boolean|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [candidate,setCandidate]=useState<{address:InternationalLocation;original:string}|null>(null);
 const request=useRef<AbortController|null>(null),snapshot=JSON.stringify([location,contextKey]);
 useEffect(()=>{const c=new AbortController();void fetch('/api/international/location',{signal:c.signal,cache:'no-store'}).then(r=>r.ok?r.json():{configured:false}).then(d=>{if(!c.signal.aborted)setConfigured(d.configured===true);}).catch(()=>{if(!c.signal.aborted)setConfigured(false);});return()=>c.abort();},[]);
 useEffect(()=>()=>{request.current?.abort();},[enabled]);
 async function locate(){
  if(!enabled||busy||configured===null)return;
  onLocate?.();
  const controller=new AbortController();request.current=controller;setBusy(true);setNotice('Detectăm adresa…');setCandidate(null);
  try{
   const address=await currentInternationalLocation(configured,controller.signal);
   if(!controller.signal.aborted){setCandidate({address,original:snapshot});setNotice('Verifică adresa propusă înainte să o folosești. Numărul și codul poștal pot lipsi.');}
  }catch(e){if(!controller.signal.aborted)setNotice(e instanceof Error?e.message:'Localizarea nu este disponibilă. Verifică permisiunea telefonului sau completează manual.');}
  finally{if(request.current===controller){request.current=null;setBusy(false);}}
 }
 if(!enabled||configured===null)return null;
 const unchanged=candidate?.original===snapshot;
 return <section className="my-3 text-sm"><p><UiText text={configured?'Completează adresa folosind poziția telefonului. Cu acordul tău, coordonatele sunt transmise prin NITIDO către Google Maps, fără a fi salvate.':'GPS opțional: doar la apăsare, coordonatele sunt trimise către BigDataCloud pentru identificarea localității. Poți introduce localitatea manual.'}/></p><button type="button" disabled={busy} className="mt-2 font-bold text-[var(--nitido-brand-dark)] underline" onClick={()=>void locate()}><UiText text={busy?'Se detectează locația…':configured?'Completează adresa prin GPS':'Folosește locația mea'}/></button>{notice&&<p role="status" className="mt-2"><UiText text={notice}/></p>}{candidate&&(unchanged?<div className="design-panel mt-2 p-3"><p>{candidate.address.countryCode} · {candidate.address.city}{candidate.address.street&&<> · {candidate.address.street}</>}{candidate.address.postalCode&&<> · {candidate.address.postalCode}</>}</p><p className="mt-2"><UiText text="Verifică numărul. Blocul, scara, etajul și apartamentul se completează manual."/></p><p className="mt-2 text-xs"><UiText text={configured?'Google Maps':'BigDataCloud'}/></p><button type="button" className="design-button mt-2" onClick={()=>{onDetected(candidate.address);setCandidate(null);setNotice('');}}><UiText text="Folosește această locație"/></button></div>:<p role="status"><UiText text="Ai modificat adresa între timp. Datele introduse au fost păstrate; apasă din nou localizarea dacă dorești altă sugestie."/></p>)}</section>;
}
