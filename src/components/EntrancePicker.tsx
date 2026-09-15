'use client';
import {useEffect,useRef,useState} from 'react';
import type {Map as LeafletMap,Marker} from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {entranceAddressKey,validEntrance,type Entrance,type EntranceAddress} from '@/lib/entrance';
export function EntrancePicker({address,value,onChange}:{address:EntranceAddress;value:Entrance|null;onChange:(value:Entrance|null)=>void}){
 const [open,setOpen]=useState(false);
 const [point,setPoint]=useState<{lat:number;lng:number}|null>(null);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const node=useRef<HTMLDivElement>(null),map=useRef<LeafletMap|null>(null),marker=useRef<Marker|null>(null);
 const place=useRef<((lat:number,lng:number)=>void)|null>(null);
 const addressKey=entranceAddressKey(address);
 const confirmed=value&&validEntrance(value,address)?value:null;
 useEffect(()=>{
  if(!open||!node.current)return;
  let disposed=false;let instance:LeafletMap|undefined;let observer:ResizeObserver|undefined;
  import('leaflet').then(L=>{
   if(disposed||!node.current)return;
   instance=L.map(node.current).setView([45.94,24.96],6);map.current=instance;
   L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(instance);
   const icon=L.divIcon({className:'',html:'<span style="display:block;width:28px;height:28px;background:#00804a;border:3px solid white;border-radius:50%;box-shadow:0 1px 5px #333"></span>',iconSize:[28,28],iconAnchor:[14,14]});
   place.current=(lat,lng)=>{
    if(!instance)return;
    const normalizedLng=((lng+180)%360+360)%360-180;
    if(Math.abs(lat)>90)return;
    if(!marker.current){marker.current=L.marker([lat,normalizedLng],{draggable:true,icon,title:'Intrarea pentru echipa de curățenie',alt:'Intrarea pentru echipa de curățenie'}).addTo(instance);marker.current.on('dragend',()=>{const p=marker.current!.getLatLng();place.current?.(p.lat,p.lng);});}
    else marker.current.setLatLng([lat,normalizedLng]);
    setPoint({lat,lng:normalizedLng});
   };
   instance.on('click',e=>place.current?.(e.latlng.lat,e.latlng.lng));
   observer=new ResizeObserver(()=>instance?.invalidateSize());observer.observe(node.current);
  }).catch(()=>setMessage('Harta nu s-a încărcat. Poți continua cu adresa scrisă.'));
  return()=>{disposed=true;observer?.disconnect();instance?.remove();map.current=null;marker.current=null;place.current=null;};
 },[open,addressKey]);
 async function locate(){
  setBusy(true);setMessage('');
  try{
   const {Capacitor}=await import('@capacitor/core');
   let lat:number,lng:number,accuracy:number;
   if(Capacitor.isNativePlatform()){
    const {Geolocation}=await import('@capacitor/geolocation');
    await Geolocation.requestPermissions();
    const p=await Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:15000});
    lat=p.coords.latitude;lng=p.coords.longitude;accuracy=p.coords.accuracy;
   }else{
    const p=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
    lat=p.coords.latitude;lng=p.coords.longitude;accuracy=p.coords.accuracy;
   }
   if(!place.current){setMessage('Așteaptă încărcarea hărții și încearcă din nou.');return;}
   place.current(lat,lng);map.current?.setView([lat,lng],18);
   setMessage(`Precizie estimată GPS: ${Math.round(accuracy)} m. Mută marcajul la intrarea corectă și confirmă.`);
  }catch{setMessage('Locația nu este disponibilă. Poți muta harta și apăsa pe intrarea dorită.');}finally{setBusy(false);}
 }
 return <fieldset className="rounded-xl border border-slate-200 p-4 space-y-3"><legend className="font-semibold">Intrarea pentru echipa de curățenie (opțional)</legend><p className="text-sm">{address.street}, {address.city}. Marchează intrarea acestei adrese, chiar dacă te afli în altă parte.</p>{confirmed?<p className="text-sm text-green-800">✓ Intrare confirmată. Va fi disponibilă firmei alocate.</p>:<p className="text-sm">Fără marcaj, navigarea folosește adresa scrisă.</p>}
 {!open?<button type="button" className="board-soft-button" onClick={()=>{setPoint(null);setOpen(true);}}>Marchează intrarea pe hartă</button>:<><button type="button" className="board-soft-button" disabled={busy} onClick={()=>void locate()}>{busy?'Se caută locația…':'Folosește poziția mea actuală'}</button><p className="text-sm">Apasă pe hartă sau deplasează marcajul la intrare. Poziția GPS din interior poate fi aproximativă.</p><div ref={node} style={{height:300,position:'relative',zIndex:0}} aria-label="Harta intrării"/><button type="button" className="board-soft-button" onClick={()=>{const p=map.current?.getCenter();if(p)place.current?.(p.lat,p.lng);}}>Marchează centrul hărții</button><p role="status" className="text-sm">{message}</p><button type="button" className="design-button" disabled={!point||!address.street.trim()||!address.city.trim()} onClick={()=>{if(point){onChange({...point,confirmed:true,addressKey});setOpen(false);}}}>Confirmă intrarea</button><button type="button" className="board-soft-button" onClick={()=>setOpen(false)}>Închide harta</button></>}
 {value&&<button type="button" className="board-soft-button" onClick={()=>onChange(null)}>Elimină marcajul</button>}</fieldset>;
}
