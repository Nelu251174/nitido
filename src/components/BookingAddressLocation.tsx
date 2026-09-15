'use client';
import {useEffect,useRef,useState} from 'react';
import {BookingLocation} from './BookingLocation';
import type {BookingAddress} from '@/lib/bookingAddress';
import {validAddressPosition} from '@/lib/bookingAddress';
export function BookingAddressLocation({address,onDetected,enabled=true}:{address:BookingAddress;onDetected:(address:BookingAddress)=>void;enabled?:boolean}){
 const [configured,setConfigured]=useState<boolean|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [candidate,setCandidate]=useState<{address:BookingAddress;original:string}|null>(null);
 const request=useRef<AbortController|null>(null);
 useEffect(()=>{const c=new AbortController();void fetch('/api/booking-address',{signal:c.signal,cache:'no-store'}).then(r=>r.ok?r.json():{configured:false}).then(d=>{if(!c.signal.aborted)setConfigured(d.configured===true)}).catch(()=>{if(!c.signal.aborted)setConfigured(false)});return()=>c.abort()},[]);
 useEffect(()=>()=>{request.current?.abort()},[enabled]);
 async function locate(){
  if(!enabled||request.current)return;
  const controller=new AbortController();request.current=controller;setBusy(true);setNotice('Detectăm adresa…');setCandidate(null);
  const original=JSON.stringify(address);
  try{
   const {Capacitor}=await import('@capacitor/core');
   if(Capacitor.isNativePlatform()&&!Capacitor.isPluginAvailable('Geolocation'))throw new Error('Actualizează NITIDO pentru localizare sau completează adresa manual.');
   const {Geolocation}=await import('@capacitor/geolocation');
   const p=await Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:12000,maximumAge:0});
   if(controller.signal.aborted)return;
   const coords={latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy};
   if(!validAddressPosition(coords))throw new Error('Localizarea nu este suficient de precisă. Încearcă lângă o fereastră sau completează manual.');
   const r=await fetch('/api/booking-address',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(coords),signal:controller.signal,cache:'no-store'});
   const d=await r.json();if(!r.ok)throw new Error(d.error||'Adresa nu a putut fi identificată.');
   if(!controller.signal.aborted){setCandidate({address:d.address,original});setNotice('Verifică adresa propusă înainte să o folosești. Numărul și codul poștal pot lipsi.');}
  }catch(e){if(!controller.signal.aborted)setNotice(e instanceof Error?e.message:'Localizarea nu este disponibilă. Verifică permisiunea telefonului sau completează manual.')}
  finally{if(request.current===controller){request.current=null;setBusy(false)}}
 }
 useEffect(()=>{if(configured&&enabled&&!address.street.trim()){const timer=setTimeout(()=>void locate(),0);return()=>clearTimeout(timer)}
 // Start only when the address service becomes available or the form is enabled.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[configured,enabled]);
 if(!enabled)return null;
 if(configured===null)return null;
 if(!configured)return <BookingLocation city={address.city} onDetected={city=>onDetected({...address,city})} enabled={enabled}/>;
 const unchanged=candidate?.original===JSON.stringify(address);
 return <section className="my-3 text-sm"><p>Completează adresa folosind poziția telefonului. Cu acordul tău, coordonatele sunt transmise prin NITIDO către Google Maps, fără a fi salvate.</p><button type="button" disabled={busy} className="mt-2 font-bold text-[var(--nitido-brand-dark)] underline" onClick={()=>void locate()}>{busy?'Se detectează adresa…':'Completează adresa prin GPS'}</button>{notice&&<p role="status" className="mt-2">{notice}</p>}{candidate&&<div className="design-panel mt-2 p-3"><p>{candidate.address.street} · {candidate.address.city} · {candidate.address.postalCode||'Cod poștal de completat'}</p><p className="mt-2">Verifică numărul. Blocul, scara, etajul și apartamentul se completează manual.</p><p className="mt-2 text-xs">Google Maps</p>{unchanged?<button type="button" className="design-button mt-2" onClick={()=>{onDetected(candidate.address);setCandidate(null);setNotice('Adresa a fost completată. O poți corecta în formular înainte de publicare.')}}>Folosește această adresă</button>:<p role="status">Ai modificat adresa între timp. Datele introduse au fost păstrate; apasă din nou localizarea dacă dorești altă sugestie.</p>}</div>}</section>;
}
