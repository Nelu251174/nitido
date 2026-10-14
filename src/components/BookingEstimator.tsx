"use client";
import {UiText,UiElement} from '@/components/UiText';
import {RomanianDateInput} from './RomanianDateInput';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {DesignIcon} from './DesignIcon';
import {CITIES} from '@/lib/cities';
import type {EstimatorOption} from '@/lib/estimatorConfig';
export function BookingEstimator({options}:{options:EstimatorOption[]}){
 const router=useRouter();
 const [city,setCity]=useState(''),[sqm,setSqm]=useState('80'),[date,setDate]=useState('');
 const [type,setType]=useState(options[0]?.key??'apartament');
 return <UiElement as="form" className="design-search" aria-label="Configurare rapidă" onSubmit={e=>{e.preventDefault();router.push(`/rezervare?${new URLSearchParams({city,sqm,date,spaceType:type})}`)}}>
  <label className="design-search-field"><DesignIcon name="pin" variant="booking"/><span><span className="design-field-label"><UiText text={"Localitate"}/></span><UiElement as="input" aria-label="Localitate" list="nitido-cities" value={city} onChange={e=>setCity(e.target.value)} placeholder="Automat prin GPS" maxLength={100}/><datalist id="nitido-cities">{CITIES.map(c=><option key={c.slug} value={c.name}/>)}</datalist></span></label>
  <label className="design-search-field"><DesignIcon name="broom" variant="booking"/><span><span className="design-field-label"><UiText text={"Serviciu"}/></span><UiElement as="select" aria-label="Serviciu" value={type} onChange={e=>setType(e.target.value as typeof type)}>{options.map(o=><option key={o.key} value={o.key}><UiText text={"Curățenie · "}/>{o.label}</option>)}</UiElement></span></label>
  <label className="design-search-field"><DesignIcon name="home" variant="booking"/><span><span className="design-field-label"><UiText text={"Suprafață, m²"}/></span><UiElement as="input" aria-label="Suprafață, m²" type="number" min={10} max={1000} step={1} required value={sqm} onChange={e=>setSqm(e.target.value)}/></span></label>
  <div className="design-search-field design-search-date"><DesignIcon name="calendar" variant="booking"/><RomanianDateInput value={date} onChange={setDate} label="Alege data" allowEmpty/></div>
  <div className="design-search-submit"><button className="design-button" type="submit" disabled={!options.length}><DesignIcon name="search" size={19}/><span className="desktop-label"><UiText text={"Caută firme"}/></span><span className="mobile-label"><UiText text={"Vezi opțiunile"}/></span></button><small><UiText text={"Simplu. Rapid. În siguranță."}/></small></div>
 </UiElement>;
}
