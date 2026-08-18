"use client";

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
      <div className="text-xs font-display font-bold text-aqua-deep uppercase tracking-wide mb-1">
        Calculează prețul
      </div>
      <p className="text-sm text-muted mb-6">Fără cont, fără angajament — doar o estimare rapidă.</p>

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
            {SPACE_LABELS[k]}
          </button>
        ))}
      </div>

      <label className="block text-xs uppercase tracking-wide text-muted font-semibold mb-2">
        Suprafață: {sqm} mp
      </label>
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
        <span className="text-sm text-muted">Preț estimat</span>
        <span className="font-display font-extrabold text-3xl text-aqua-deep">{price} lei</span>
      </div>

      <Link
        href="/signup?role=client"
        className="mt-5 block text-center px-6 py-3 rounded-xl bg-ink text-white font-display font-bold hover:opacity-90 transition"
      >
        Postează lucrarea la acest preț
      </Link>
    </div>
  );
}
