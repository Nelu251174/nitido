"use client";
import {UiText} from '@/components/UiText';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {trackBookingFunnel} from "@/lib/bookingFunnel";
import type {OwnedHome} from '@/lib/homeBooking';
export function OwnedHomePicker({value,onSelect}:{value:string;onSelect:(home:OwnedHome|null)=>void}){
 const [homes,setHomes]=useState<OwnedHome[]>([]),[authenticated,setAuthenticated]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();void fetch('/api/workspace?view=homes',{signal:controller.signal,cache:'no-store'}).then(async r=>{if(!r.ok){if(r.status!==401)throw new Error();return;}const body=await r.json();if(!controller.signal.aborted){setHomes(body.properties??[]);setAuthenticated(true);}}).catch(()=>{if(!controller.signal.aborted)setError('Locuințele nu au putut fi încărcate. Poți introduce adresa manual.');});return()=>controller.abort();},[]);
 if(!authenticated&&!error)return null;
 return <div className="my-4 rounded-xl border p-4"><label className="block font-bold"><UiText text={"Locuințele mele"}/><select className="mt-2 min-h-11 w-full rounded border bg-white p-2" value={value} onChange={e=>{const home=homes.find(h=>h.id===e.target.value)??null;if(home)trackBookingFunnel("home_used");onSelect(home);}}><option value=""><UiText text={"Introdu altă adresă"}/></option>{homes.map(h=><option value={h.id} key={h.id}>{h.name} · {h.city} · {h.sqm}<UiText text={" m²"}/></option>)}</select></label>{value&&<p className="mt-2 text-sm"><UiText text={"Modificările de aici privesc numai rezervarea nouă. Fișa salvată rămâne neschimbată."}/></p>}{error&&<p role="status">{<UiText text={error}/>}</p>}<Link className="mt-2 inline-flex min-h-11 items-center underline" href="/client/proprietati"><UiText text={"Adaugă o locuință"}/></Link></div>;
}
