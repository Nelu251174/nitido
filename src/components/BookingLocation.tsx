'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {currentBookingCity} from '@/lib/bookingLocation';
export function BookingLocation({city,onDetected,enabled=true}:{city:string;onDetected:(city:string)=>void;enabled?:boolean}){
 const latest=useRef({city,onDetected,enabled});
 useLayoutEffect(()=>{latest.current={city,onDetected,enabled}},[city,onDetected,enabled]);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const request=useRef<AbortController|null>(null);
 async function locate(){
  if(!latest.current.enabled||request.current)return;
  if(latest.current.city.trim()){setNotice('Localitatea este deja completată. O poți modifica în câmpul de adresă.');return;}
  const controller=new AbortController();request.current=controller;setBusy(true);setNotice('Detectăm localitatea prin GPS…');
  try{const detected=await currentBookingCity(controller.signal);if(!controller.signal.aborted&&latest.current.enabled&&!latest.current.city.trim()){latest.current.onDetected(detected);setNotice(`Localitate detectată: ${detected}. Verifică adresa lucrării.`);}}
  catch(e){if(!controller.signal.aborted)setNotice(e instanceof Error&&e.message?e.message:'Localizarea nu este permisă sau GPS-ul nu răspunde. Poți introduce localitatea manual.');}
  finally{if(request.current===controller){request.current=null;setBusy(false);}}
 }
 useEffect(()=>{
  if(enabled&&!latest.current.city.trim())void locate();
  return ()=>{request.current?.abort();request.current=null;};
 // Start once when a booking address form opens, not while the user types.
 },[enabled]);
 return <div className="my-3 text-sm"><p>Localitatea se completează prin GPS, cu permisiunea ta. Coordonatele sunt transmise către BigDataCloud pentru identificarea localității. Poți introduce adresa manual.</p><button className="mt-2 font-bold text-[var(--nitido-brand-dark)] underline" type="button" disabled={busy||!enabled} onClick={()=>void locate()}>{busy?'Se detectează locația…':'Folosește locația mea'}</button>{notice&&<p className="mt-2" role="status">{notice}</p>}</div>;
}
