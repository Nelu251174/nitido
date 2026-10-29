"use client";
import {UiMoney} from '@/components/UiMoney';

import {UiText} from '@/components/UiText';
import { useMemo, useState } from "react";
import Link from "next/link";
import { calcGrossPrice, SpaceType } from "@/lib/pricing";

const SPACE_LABELS: Record<SpaceType, string> = {
  apartament: "Apartament",
  casa: "Casă",
  birou: "Birou",
  altul: "Altul",
};

export function PriceCalculator() {
  const [spaceType, setSpaceType] = useState<SpaceType>("apartament");
  const [sqm, setSqm] = useState(75);

  const price = useMemo(() => {
    try {
      return calcGrossPrice(spaceType, sqm);
    } catch {
      return 0;
    }
  }, [spaceType, sqm]);

  return (
    <div className="bg-white border border-line rounded-2xl p-8 shadow-sm">
      <div className="text-xs font-display font-bold text-aqua-deep uppercase tracking-wide mb-1"><UiText text={"Calculează prețul"}/></div>
      <p className="text-sm text-muted mb-6"><UiText text={"Fără cont, fără angajament — estimare pentru curățenie, fără spălare de geamuri. Geamurile se adaugă separat."}/></p>

      <div className="flex gap-2 flex-wrap mb-5">
        {(Object.keys(SPACE_LABELS) as SpaceType[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setSpaceType(k)}
            className={`px-4 py-2 rounded-full text-sm font-display font-bold border transition ${
              spaceType === k
                ? "border-aqua bg-aqua/10 text-ink"
                : "border-line text-muted hover:border-aqua"
            }`}
          >
            {<UiText text={SPACE_LABELS[k]}/>}
          </button>
        ))}
      </div>

      <label className="block text-xs uppercase tracking-wide text-muted font-semibold mb-2"><UiText text={"Suprafață: "}/>{sqm}<UiText text={" mp"}/></label>
      <input
        type="range"
        min={20}
        max={200}
        step={5}
        value={sqm}
        onChange={(e) => setSqm(Number(e.target.value))}
        className="w-full accent-aqua mb-6"
      />

      <div className="flex items-center justify-between bg-mist rounded-xl p-5">
        <span className="text-sm text-muted"><UiText text={"Preț estimat"}/></span>
        <span className="font-display font-extrabold text-3xl text-aqua-deep"><UiMoney ron={price}/></span>
      </div>

      <Link
        href={`/rezervare?spaceType=${spaceType}&sqm=${sqm}`}
        className="mt-5 block text-center px-6 py-3 rounded-xl bg-ink text-white font-display font-bold hover:opacity-90 transition"
      ><UiText text={"Continuă cu rezervarea"}/></Link>
    </div>
  );
}
