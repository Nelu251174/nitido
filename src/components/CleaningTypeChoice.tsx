'use client';
import {UiText} from './UiText';
import {CLEANING_TYPES,CLEANING_DESCRIPTION,CLEANING_SCOPE,CLEANING_EXCLUSIONS,type CleaningType} from '@/lib/cleaningTypes';
export function CleaningTypeChoice({value,onChange,automaticOnly=false}:{value:CleaningType;onChange:(value:CleaningType)=>void;automaticOnly?:boolean}){
 return <fieldset className="cleaning-type-choice"><legend><UiText text="Tipul curățeniei"/></legend><div className="booking-choice-grid">{CLEANING_TYPES.filter(([key])=>!automaticOnly||key!=='renovation').map(([key,label])=><label className={`booking-choice ${value===key?'selected':''}`} key={key}><input type="radio" name="cleaning-type" value={key} checked={value===key} onChange={()=>onChange(key)}/><b><UiText text={label}/></b><span><UiText text={CLEANING_DESCRIPTION[key]}/></span></label>)}</div>{value!=='renovation'&&<details className="booking-muted"><summary><UiText text="Ce include curățenia"/></summary><ul>{CLEANING_SCOPE[value].map(item=><li key={item.key}><UiText text={item.label}/></li>)}</ul><p><UiText text={CLEANING_EXCLUSIONS[value]}/></p><p><UiText text="Geamurile și băile suplimentare se adaugă separat."/></p></details>}</fieldset>;
}
export function CleaningTypeLabel({value}:{value:unknown}){const label=CLEANING_TYPES.find(([key])=>key===value)?.[1];return label?<span className="cleaning-type-label"><UiText text={label}/></span>:null;}
