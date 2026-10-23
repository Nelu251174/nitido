"use client";
import {UiText} from '@/components/UiText';
import {useRef,useState} from 'react';
import {StarRating,inputClass} from './ui';

export function ReviewForm({onSubmit}:{onSubmit:(stars:number,comment:string)=>Promise<void>}){
 const [stars,setStars]=useState(0),[comment,setComment]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const inFlight=useRef(false);
 return <form className="space-y-3" onSubmit={async e=>{e.preventDefault();if(inFlight.current)return;if(!stars){setError('Alege între 1 și 5 stele.');return;}inFlight.current=true;setBusy(true);setError('');try{await onSubmit(stars,comment);}catch(e){setError(e instanceof Error?e.message:'Evaluarea nu a fost salvată. Reîncearcă.');}finally{inFlight.current=false;setBusy(false);}}}>
  <fieldset disabled={busy}><legend className="font-bold"><UiText text={"Cum a fost lucrarea?"}/></legend><StarRating value={stars} onChange={setStars}/><p aria-live="polite" className="text-center text-sm">{stars?`${stars} din 5 stele selectate`:<UiText text={'Nicio valoare selectată'}/>}</p><label className="mt-3 block"><UiText text={"Comentariu opțional"}/><textarea className={`${inputClass} mt-2 min-h-24`} maxLength={2000} value={comment} onChange={e=>setComment(e.target.value)}/></label><p className="text-xs text-muted"><UiText text={"Nu include adrese, date de contact sau coduri de acces."}/></p></fieldset>
  {error&&<p role="alert" className="text-red-700">{<UiText text={error}/>}</p>}<button type="submit" disabled={busy||!stars} className="v2-btn min-h-11 w-full bg-ink text-white disabled:opacity-50">{busy?<UiText text={'Se trimite…'}/>:<UiText text={'Trimite evaluarea'}/>}</button>
 </form>;
}
