'use client';
import {UiText} from '@/components/UiText';
import {useEffect,useRef,useState} from 'react';
import {currentBookingCity} from '@/lib/bookingLocation';
export function BookingLocation({city,onDetected,enabled=true}:{city:string;onDetected:(city:string)=>void;enabled?:boolean}){
 const latest=useRef({city,onDetected,enabled});
 useEffect(()=>{latest.current={city,onDetected,enabled};},[city,onDetected,enabled]);
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
 useEffect(()=>()=>{request.current?.abort();request.current=null;},[]);
 return <div className="my-3 text-sm"><p><UiText text={"GPS opțional: doar la apăsare, coordonatele sunt trimise către BigDataCloud pentru identificarea localității. Poți introduce localitatea manual."}/></p><button className="mt-2 font-bold text-[var(--nitido-brand-dark)] underline" type="button" disabled={busy||!enabled} onClick={()=>void locate()}>{busy?<UiText text={'Se detectează locația…'}/>:<UiText text={'Folosește locația mea'}/>}</button>{notice&&<p className="mt-2" role="status">{<UiText text={notice}/>}</p>}</div>;
}
