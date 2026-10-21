"use client";
import {useEffect,useState} from 'react';
import {trackBookingFunnel} from '@/lib/bookingFunnel';
import {normalizeCity} from '@/lib/text';
import type {FlexibleWindow} from '@/lib/flexibleShared';
import {FlexibleWindowFields} from './FlexibleWindowFields';
export function FlexibleChoice({city,value,onChange}:{city:string;value:FlexibleWindow[]|null;onChange:(value:FlexibleWindow[]|null)=>void}){
 const [zone,setZone]=useState<string|null>(null);
 useEffect(()=>{const controller=new AbortController();void fetch('/api/flexible-scheduling',{signal:controller.signal}).then(r=>r.ok?r.json():null).then(b=>{if(!controller.signal.aborted)setZone(b?.pilotCity??null);}).catch(()=>{});return()=>controller.abort();},[]);
 if(!zone||normalizeCity(zone)!==normalizeCity(city))return value?<p role="alert">Programarea flexibilă nu este disponibilă aici. <button type="button" className="min-h-11 underline" onClick={()=>onChange(null)}>Revino la programarea obișnuită</button></p>:null;
 return <div><label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={!!value} onChange={e=>{if(e.target.checked)trackBookingFunnel('flex_start');onChange(e.target.checked?[{date:'',from:10,to:12}]:null);}}/>Sunt flexibil cu programarea</label>{value&&<><p className="text-sm">Pilot {zone} · Standard: tu alegi firma și confirmi ora exactă. Alegerea intervalelor nu inițiază o plată.</p><FlexibleWindowFields value={value} onChange={onChange}/><button type="button" className="min-h-11 underline" onClick={()=>onChange(null)}>Revino la programarea obișnuită</button></>}</div>;
}
