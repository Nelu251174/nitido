"use client";
import {UiText} from '@/components/UiText';
import {BATHROOM_MAX_COUNT,BATHROOM_PRICING_NOTICE,validBathroomCount,calcBathroomPrice} from '@/lib/pricing';
export function BathroomExtra({value,onChange}:{value:number;onChange:(value:number)=>void}){
 return <fieldset className="design-panel my-4"><legend className="font-bold"><UiText text="Băi și bucătărie"/></legend><label className="block"><UiText text="Număr total de băi"/><input className="block w-full rounded-lg border p-3 mt-2" type="number" min={0} max={BATHROOM_MAX_COUNT} step={1} inputMode="numeric" value={Number.isNaN(value)?'':value} onChange={e=>onChange(e.target.value===''?Number.NaN:Number(e.target.value))}/></label><p className="text-sm mt-2"><UiText text={BATHROOM_PRICING_NOTICE}/></p>{validBathroomCount(value)?<p className="text-sm mt-2" aria-live="polite"><UiText text="Supliment băi: "/>{calcBathroomPrice(value)}<UiText text=" lei"/></p>:<p role="alert"><UiText text="Introdu numărul de băi, întreg între 0 și 20. Pentru alte situații solicită evaluare."/></p>}</fieldset>;
}
