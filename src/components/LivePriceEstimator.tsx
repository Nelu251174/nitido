"use client";

import {useState} from "react";
import {calcGrossPrice,type SpaceType} from "@/lib/pricing";
import {activeEstimatorOptions,type EstimatorOption} from "@/lib/estimatorConfig";

export const ESTIMATOR_MIN_SQM=10;
export const ESTIMATOR_MAX_SQM=1000;
export const ESTIMATOR_STEP_SQM=5;
export const ESTIMATOR_DEFAULT_SQM=120;

// Tipurile afișate vin din admin (prop `options`, gestionată în panoul de
// administrare). Dacă nu se transmit, folosim valorile implicite din config.
export function LivePriceEstimator({options}:{options?:EstimatorOption[]}={}){
  const opts=options&&options.length?options:activeEstimatorOptions();
  const [spaceType,setSpaceType]=useState<SpaceType>(opts[0]?.key??"apartament");
  const [sqm,setSqm]=useState(ESTIMATOR_DEFAULT_SQM);
  const price=calcGrossPrice(spaceType,sqm);
  const activeLabel=opts.find(o=>o.key===spaceType)?.label??"Apartament";
  const progress=((sqm-ESTIMATOR_MIN_SQM)/(ESTIMATOR_MAX_SQM-ESTIMATOR_MIN_SQM))*100;
  return <div className="absolute bottom-[-20px] right-[-18px] w-[330px] rounded-2xl bg-[#111827] p-5 text-white shadow-2xl max-sm:right-3 max-sm:w-[calc(100%-24px)]">
    <div className="text-xs font-bold text-[#8fd8ae]">ESTIMATOR LIVE</div>
    <div className="mt-2 flex flex-nowrap gap-1" role="group" aria-label="Tip spațiu">
      {opts.map(option=><button key={option.key} type="button" onClick={()=>setSpaceType(option.key)} aria-pressed={spaceType===option.key} className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold transition ${spaceType===option.key?"bg-[#39c97c] text-[#111827]":"bg-[#2a332c] text-[#a8b2ac] hover:text-white"}`}>{option.label}</button>)}
    </div>
    <div className="mt-3 flex items-end justify-between gap-4"><span className="text-sm text-[#a8b2ac]">{activeLabel} · <output htmlFor="hero-sqm" className="font-semibold text-white">{sqm} m²</output></span><b className="shrink-0 text-3xl tabular-nums" aria-live="polite">{price} lei</b></div>
    <input id="hero-sqm" type="range" min={ESTIMATOR_MIN_SQM} max={ESTIMATOR_MAX_SQM} step={ESTIMATOR_STEP_SQM} value={sqm} onChange={event=>setSqm(Number(event.target.value))} aria-label="Suprafața estimată în metri pătrați" aria-valuetext={`${sqm} metri pătrați, estimare ${price} lei`} className="nitido-price-range mt-3 w-full touch-none" style={{background:`linear-gradient(to right,#39c97c 0%,#39c97c ${progress}%,#2a332c ${progress}%,#2a332c 100%)`}}/>
    <div className="flex justify-between text-[11px] text-[#8b958f]"><span>{ESTIMATOR_MIN_SQM} m²</span><span>{ESTIMATOR_MAX_SQM} m²</span></div>
    <p className="mt-3 text-[10px] leading-4 text-[#8b958f]">Estimare orientativă. Prețul final este calculat la postarea lucrării.</p>
  </div>;
}
