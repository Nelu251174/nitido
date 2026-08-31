"use client";

import {useState} from "react";
import {calcGrossPrice} from "@/lib/pricing";

export const ESTIMATOR_MIN_SQM=10;
export const ESTIMATOR_MAX_SQM=1000;
export const ESTIMATOR_STEP_SQM=5;
export const ESTIMATOR_DEFAULT_SQM=120;

export function LivePriceEstimator(){
  const [sqm,setSqm]=useState(ESTIMATOR_DEFAULT_SQM);
  const price=calcGrossPrice("apartament",sqm);
  const progress=((sqm-ESTIMATOR_MIN_SQM)/(ESTIMATOR_MAX_SQM-ESTIMATOR_MIN_SQM))*100;
  return <div className="absolute bottom-[-20px] right-[-18px] w-[300px] rounded-2xl bg-[#101711] p-5 text-white shadow-2xl max-sm:right-3 max-sm:w-[calc(100%-24px)]">
    <div className="text-xs font-bold text-[#8fd8ae]">ESTIMATOR LIVE</div>
    <div className="mt-3 flex items-end justify-between gap-4"><span className="text-sm text-[#a8b2ac]">Apartament · <output htmlFor="hero-sqm" className="font-semibold text-white">{sqm} m²</output></span><b className="shrink-0 text-3xl tabular-nums" aria-live="polite">{price} lei</b></div>
    <input id="hero-sqm" type="range" min={ESTIMATOR_MIN_SQM} max={ESTIMATOR_MAX_SQM} step={ESTIMATOR_STEP_SQM} value={sqm} onChange={event=>setSqm(Number(event.target.value))} aria-label="Suprafața estimată în metri pătrați" aria-valuetext={`${sqm} metri pătrați, estimare ${price} lei`} className="nitido-price-range mt-3 w-full touch-none" style={{background:`linear-gradient(to right,#39c97c 0%,#39c97c ${progress}%,#2a332c ${progress}%,#2a332c 100%)`}}/>
    <div className="flex justify-between text-[11px] text-[#8b958f]"><span>{ESTIMATOR_MIN_SQM} m²</span><span>{ESTIMATOR_MAX_SQM} m²</span></div>
    <p className="mt-3 text-[10px] leading-4 text-[#8b958f]">Estimare orientativă. Prețul final este calculat la postarea lucrării.</p>
  </div>;
}
