'use client';
import {UiSpaceType,UiText} from '@/components/UiText';
import {useLocale} from 'next-intl';

import {useEffect,useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {DesignIcon} from './DesignIcon';
import {JOB_STATUS} from '@/lib/workspaceShared';
import type {JobRow} from '@/lib/types';
type Property={id:string;name:string;city:string;sqm:number;street:string};
export function ClientOverview({jobs,onSelect,onBook}:{jobs:JobRow[];onSelect:(job:JobRow)=>void;onBook:()=>void}){
 const locale=useLocale();

 const [properties,setProperties]=useState<Property[]>([]),[failed,setFailed]=useState(false);
 useEffect(()=>{let alive=true;fetch('/api/workspace').then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{if(alive)setProperties(d.properties??[])}).catch(()=>{if(alive)setFailed(true)});return()=>{alive=false}},[]);
 const next=[...jobs].filter(j=>['accepted','arrived','waiting'].includes(j.status)).sort((a,b)=>(a.scheduled_at??'9999').localeCompare(b.scheduled_at??'9999'))[0];
 const property=properties[0];
 return <div className="client-overview"><section className="design-panel"><div className="board-card-heading"><h2><DesignIcon name="calendar"/><UiText text={"Următoarea ta rezervare"}/></h2><a href="#sec-lucrari"><UiText text={"Vezi rezervările "}/><DesignIcon name="arrow" size={18}/></a></div><div className="next-booking"><div className="next-booking-image"><Image src="/design-v2/approved-living-room.webp" alt="" fill sizes="220px"/></div><div className="next-booking-details">{next?<><span className="eyebrow-pill"><UiText text={"Curățenie "}/><UiSpaceType value={next.space_type}/></span><h3><UiSpaceType value={next.space_type}/> · {next.city}</h3><p><DesignIcon name="pin" size={19}/>{next.city} · {next.sqm}<UiText text={" m²"}/></p><p><DesignIcon name="calendar" size={19}/>{next.scheduled_at?new Date(next.scheduled_at).toLocaleString(locale,{timeZone:'Europe/Bucharest',dateStyle:'medium',timeStyle:'short'}):<UiText text={'Program în curs de stabilire'}/>}</p><span className="board-status"><DesignIcon name="check" size={16}/>{<UiText text={JOB_STATUS[next.status]}/>}</span><button className="design-button" onClick={()=>onSelect(next)}><UiText text={"Vezi rezervarea"}/><DesignIcon name="arrow" size={18}/></button></>:<><h3>{jobs.length?<UiText text={"Pregătește următoarea rezervare."}/>:<UiText text={"Prima ta rezervare începe aici."}/>}</h3><p><UiText text={"Alege spațiul și programul, apoi verifică prețul."}/></p><button className="design-button" onClick={onBook}><UiText text={"Configurează curățenia"}/><DesignIcon name="arrow" size={18}/></button></>}</div></div></section>
 <section className="design-panel overview-property"><div className="board-card-heading"><h2><DesignIcon name="home"/><UiText text={"Proprietatea ta"}/></h2><Link href="/client/proprietati"><UiText text={"Vezi toate"}/><DesignIcon name="arrow" size={17}/></Link></div><div className="overview-property-photo"><Image src="/design-v2/approved-living-room.webp" alt="" fill sizes="450px"/></div>{property?<><h3>{property.name}</h3><p className="booking-muted">{property.city} · {property.sqm}<UiText text={" m²"}/></p><div className="overview-property-actions"><Link href="/client/proprietati" className="v2-btn v2-btn-secondary"><UiText text={"Editează detaliile"}/></Link><a href={`/client?propertyId=${encodeURIComponent(property.id)}#sec-form`} className="design-button"><UiText text={"Rezervă din nou"}/></a></div></>:<><h3>{failed?<UiText text={'Proprietățile nu au putut fi încărcate'}/>:<UiText text={'Adaugă prima proprietate'}/>}</h3><p className="booking-muted"><UiText text={"Păstrează adresa și preferințele pentru vizitele viitoare."}/></p><Link href="/client/proprietati" className="design-button"><DesignIcon name="plus" size={18}/><UiText text={"Gestionează proprietățile"}/></Link></>}</section></div>;
}
