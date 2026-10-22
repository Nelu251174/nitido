'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {NewBadge} from './NewBadge';
type Firm={id:string;name:string;coverage_city:string;verified:number;suspended_until:string|null;saved:number};
const available=(f:Firm)=>f.verified===1&&(!f.suspended_until||Number.isFinite(Date.parse(f.suspended_until))&&Date.parse(f.suspended_until)<=Date.now());
export function FavoriteFirms(){
  const [firms,setFirms]=useState<Firm[]>([]),[message,setMessage]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);const lock=useRef(false);
  async function load(){const r=await fetch('/api/client/favorites'),b=await r.json();if(!r.ok)throw Error(b.error);setFirms(b.firms);}
  useEffect(()=>{let live=true;fetch('/api/client/favorites').then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error);if(live)setFirms(b.firms)}).catch(e=>{if(live)setMessage(e.message)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[]);
  async function save(f:Firm){if(lock.current)return;lock.current=true;setBusy(true);setMessage('');try{const r=await fetch('/api/client/favorites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({firmId:f.id,save:!f.saved})}),b=await r.json();if(!r.ok)throw Error(b.error);await load();setMessage(f.saved?'Preferință eliminată. Rezervările existente rămân intacte.':'Firma a fost salvată. Nu s-a trimis o invitație.')}catch(e){setMessage(e instanceof Error?e.message:'Salvarea nu a reușit.')}finally{lock.current=false;setBusy(false)}}
  return <><p className="my-5 leading-7">Păstrează firmele verificate cu care ai finalizat o lucrare. Solicitarea unei firme este o invitație la candidatură, nu o rezervare garantată. Poți alege explicit o alternativă.</p><p role="status" className="my-4">{loading?'Se încarcă firmele…':message}</p>{!loading&&!message&&!firms.length&&<p>După prima lucrare finalizată, firma parteneră poate fi salvată aici.</p>}<ul className="grid gap-4">{firms.map(f=><li key={f.id} id={f.id} className="v2-card p-5"><h2 className="font-bold text-lg">{f.name}</h2><p>{f.coverage_city}</p>{!available(f)&&<p>Firma nu este momentan eligibilă pentru o cerere nouă.</p>}<div className="flex flex-wrap gap-3 mt-4"><button type="button" disabled={busy||!f.saved&&!available(f)} className="v2-btn v2-btn-secondary" onClick={()=>void save(f)}>{f.saved?'Elimină de la preferate':'Salvează firma la preferate'} <NewBadge/></button>{!!f.saved&&available(f)&&<a className="v2-btn v2-btn-primary" href={'/client?preferredFirmId='+encodeURIComponent(f.id)+'#sec-form'}>Solicită din nou această firmă</a>}</div></li>)}</ul><Link href="/client#sec-lucrari" className="underline block my-6">Rezervările mele</Link></>;
}

export function SaveFavoriteButton({firmId}:{firmId:string}){
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);const lock=useRef(false);
  async function save(){if(lock.current)return;lock.current=true;setBusy(true);try{const r=await fetch('/api/client/favorites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({firmId,save:true})}),b=await r.json();if(!r.ok)throw Error(b.error);setMessage('Firma este salvată la preferate. Nu s-a trimis o invitație.')}catch(e){setMessage(e instanceof Error?e.message:'Salvarea nu a reușit.')}finally{lock.current=false;setBusy(false)}}
  return <div><button type="button" className="v2-btn v2-btn-secondary" disabled={busy} onClick={()=>void save()}>Salvează firma la preferate <NewBadge/></button><p role="status" className="text-sm mt-2">{message}</p></div>;
}

export function PreferredFirmChoice({value,onChange}:{value:string|null;onChange:(id:string|null)=>void}){
  const [firms,setFirms]=useState<Firm[]>([]),[error,setError]=useState('');
  useEffect(()=>{let live=true;fetch('/api/client/favorites').then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error);if(live)setFirms(b.firms.filter((f:Firm)=>f.saved&&available(f)))}).catch(()=>{if(live)setError('Preferințele nu au putut fi încărcate. Poți continua fără preferință.')});return()=>{live=false}},[]);
  return <div className="rounded border p-4 my-4"><label className="block">Firma mea preferată <NewBadge/><select className="w-full border rounded p-3 mt-2" value={value??''} onChange={e=>onChange(e.target.value||null)}><option value="">Aleg dintre candidaturile primite</option>{firms.map(f=><option value={f.id} key={f.id}>{f.name}</option>)}{value&&!firms.some(f=>f.id===value)&&<option value={value}>Preferința necesită verificare la publicare</option>}</select></label><p className="text-sm mt-2">Se aplică numai unei cereri Standard obișnuite. Firma verifică programul și trimite candidatura; alegerea și confirmarea plății rămân la tine.</p>{error&&<p role="status">{error}</p>}<Link href="/client/firme-preferate" className="underline block mt-2">Gestionează firmele preferate</Link></div>;
}
