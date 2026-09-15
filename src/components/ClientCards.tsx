"use client";
import {useState} from "react";
import {Button} from "./ui";

export type ClientCardView={id:string;brand:string|null;last4:string|null;expMonth:number|null;expYear:number|null;isDefault:boolean};
type Props={cards:ClientCardView[];selected:string|null;loading:boolean;busy:boolean;booking?:boolean;
 onSelect:(id:string)=>void;onDefault:(id:string)=>void;onRemove:(id:string)=>void;onAdd:()=>void};

export function ClientCards({cards,selected,loading,busy,booking=false,onSelect,onDefault,onRemove,onAdd}:Props) {
  const [removing,setRemoving]=useState<string|null>(null);
  return <section id="sec-plata" className="rounded-2xl border border-line bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-bold text-ink">{booking?"Alege cardul pentru această lucrare":"Cardurile tale"}</h2>
      <span className="text-xs text-muted">{cards.length} din 3 carduri</span>
    </div>
    <p className="mt-2 text-sm text-muted">{booking?"Suma se rezervă pe cardul ales când lucrarea este preluată.":"Păstrează până la 3 carduri și alege cu care plătești fiecare lucrare."}</p>
    {loading?<p role="status" className="mt-3 text-sm">Se încarcă cardurile…</p>:<div className="mt-4 grid gap-3">
      {cards.map(card=><div key={card.id} className={`rounded-xl border p-3 ${booking&&selected===card.id?"border-aqua bg-mist":"border-line"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <label className="flex min-w-0 items-center gap-3 text-sm font-semibold">
            {booking&&<input type="radio" name="booking-card" value={card.id} checked={selected===card.id} disabled={busy} onChange={()=>onSelect(card.id)} className="h-4 w-4 accent-[var(--nitido-brand)]"/>}
            <span><span className="uppercase">{card.brand??"Card"}</span> ···· {card.last4??"—"}
              {card.expMonth&&card.expYear&&<span className="mt-1 block text-xs font-normal text-muted">Expiră {String(card.expMonth).padStart(2,"0")}/{card.expYear}</span>}
            </span>
          </label>
          {card.isDefault&&<span className="rounded-full bg-mist px-2 py-1 text-xs font-semibold text-aqua-deep">Implicit</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          {!card.isDefault&&<button type="button" disabled={busy} onClick={()=>onDefault(card.id)} className="font-semibold text-aqua-deep disabled:opacity-50">Setează implicit</button>}
          <button type="button" disabled={busy} onClick={()=>setRemoving(card.id)} className="text-muted underline disabled:opacity-50">Elimină</button>
        </div>
        {removing===card.id&&<div className="mt-3 border-t border-line pt-3 text-xs">
          <p>Elimini acest card din lista ta? Plățile existente rămân păstrate.</p>
          <div className="mt-2 flex flex-wrap gap-4">
            <button type="button" disabled={busy} className="font-semibold text-coral" onClick={()=>{onRemove(card.id);setRemoving(null);}}>Confirmă eliminarea</button>
            <button type="button" disabled={busy} onClick={()=>setRemoving(null)}>Renunță</button>
          </div>
        </div>}
      </div>)}
    </div>}
    <Button variant="outline" className="mt-4 !px-4 !py-2.5" disabled={busy||loading||cards.length>=3} onClick={onAdd}>
      {busy?"Se procesează…":"Adaugă card nou"}
    </Button>
    {cards.length>=3&&<p className="mt-2 text-xs text-muted">Ai atins limita de 3 carduri. Elimină un card pentru a adăuga altul.</p>}
    <p className="mt-3 text-xs text-muted">Datele cardului sunt procesate securizat de Stripe. Cardul implicit se propune la rezervările noi.</p>
  </section>;
}
