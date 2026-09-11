"use client";
import { useState } from "react";
import Link from "next/link";
import { calcGrossPrice, type SpaceType } from "@/lib/pricing";
import type { EstimatorOption } from "@/lib/estimatorConfig";
export function BookingEstimator({options}:{options:EstimatorOption[]}) {
 const [type,setType]=useState<SpaceType>(options[0]?.key??"apartament");
 const [sqm,setSqm]=useState("75");
 const valid=Number(sqm)>=10&&Number(sqm)<=1000;
 const price=valid?calcGrossPrice(type,Number(sqm)):null;
 return <section className="booking-estimator" aria-label="Estimare curățenie"><div><span className="v2-eyebrow">Începe de aici</span><h2 className="font-bold text-xl mt-1">Un spațiu curat.<br/>Un preț clar.</h2></div><label><span>Tipul spațiului</span><select value={type} onChange={e=>setType(e.target.value as SpaceType)}>{options.map(o=><option key={o.key} value={o.key}>{o.label}</option>)}</select></label><label><span>Suprafață, m²</span><input type="number" min="10" max="1000" value={sqm} onChange={e=>setSqm(e.target.value)}/></label><div><span className="text-muted text-xs">Estimare orientativă</span><output className="block font-bold text-2xl text-aqua" aria-live="polite">{price===null?"10–1.000 m²":`${price} lei`}</output></div><Link aria-disabled={!valid} href={valid?`/client?spaceType=${type}&sqm=${sqm}#sec-form`:"#"} onClick={e=>{if(!valid)e.preventDefault()}} className="v2-btn v2-btn-primary">Continuă ↗</Link></section>;
}
