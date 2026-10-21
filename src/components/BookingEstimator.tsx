"use client";
import {UiText,UiElement} from '@/components/UiText';
import {useRouter} from 'next/navigation';
import {DesignIcon} from './DesignIcon';
import {BookingLocation} from './BookingLocation';
import {useBookingDraft} from './useBookingDraft';
import {CITIES} from '@/lib/cities';
import type {EstimatorOption} from '@/lib/estimatorConfig';
export function BookingEstimator({options}:{options:EstimatorOption[]}){
 const router=useRouter();
 const {draft,update,ready}=useBookingDraft({}, {city:'',sqm:'80',spaceType:options[0]?.key??'apartament'});
 return <div><UiElement as="form" className="design-search" aria-label="Configurare rapidă" onSubmit={e=>{e.preventDefault();router.push(`/rezervare?${new URLSearchParams({city:draft.city,sqm:draft.sqm,spaceType:draft.spaceType})}`)}}>
  <label className="design-search-field"><DesignIcon name="pin" variant="booking"/><span><span className="design-field-label"><UiText text="Localitate"/></span><UiElement as="input" aria-label="Localitate" list="nitido-cities" value={draft.city} onChange={e=>update({city:e.target.value})} placeholder="Introdu localitatea" maxLength={100}/><datalist id="nitido-cities">{CITIES.map(c=><option key={c.slug} value={c.name}/>)}</datalist></span></label>
  <label className="design-search-field"><DesignIcon name="broom" variant="booking"/><span><span className="design-field-label"><UiText text="Serviciu"/></span><UiElement as="select" aria-label="Serviciu" value={draft.spaceType} onChange={e=>update({spaceType:e.target.value})}>{options.map(o=><option key={o.key} value={o.key}><UiText text="Curățenie · "/><UiText text={o.label}/></option>)}</UiElement></span></label>
  <label className="design-search-field"><DesignIcon name="home" variant="booking"/><span><span className="design-field-label"><UiText text="Suprafață, m²"/></span><UiElement as="input" aria-label="Suprafață, m²" type="number" min={10} max={1000} step={1} required value={draft.sqm} onChange={e=>update({sqm:e.target.value})}/></span></label>
  <div className="design-search-submit"><button className="design-button" type="submit" disabled={!options.length||!ready}><DesignIcon name="search" size={19}/><UiText text="Calculează prețul"/></button><small><UiText text="Data se alege la pasul următor."/></small></div>
 </UiElement><div className="home-location-option"><BookingLocation city={draft.city} onDetected={city=>update({city})}/></div></div>;
}
