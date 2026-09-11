"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Me = { role: "client" | "firma"; name: string } | null;

/**
 * Butoanele din dreapta antetului, conștiente de sesiune. Problema veche:
 * antetul paginilor publice (Contact, Încredere etc.) arăta MEREU
 * „Autentificare / Înregistrează-te", chiar dacă utilizatorul era logat — așa
 * că, dând click pe „Mesaje" (→ /contact) sau „Încredere" (→ /incredere) din
 * panoul de client, părea că a fost dat afară din cont, deși sesiunea era
 * intactă. Acum, dacă există sesiune, arătăm „Contul meu" (→ /client sau
 * /firma). Starea se citește din /api/auth/me.
 *
 * Cât timp nu știm încă starea (loading), nu afișăm butoanele de „oaspete", ca
 * să nu apară o clipire de „delogat" pentru un utilizator logat.
 */
export function HeaderAuthButtons() {
  const [me, setMe] = useState<Me | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => {
        if (!cancelled) setMe(d.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (me === undefined) {
    // Necunoscut încă — rezervăm spațiul, fără a afișa o stare greșită.
    return <div className="h-10 w-[120px]" aria-hidden="true" />;
  }

  if (me) {
    const href = me.role === "firma" ? "/firma" : "/client";
    return (
      <Link href={href} className="v2-btn v2-btn-primary">
        Contul meu
      </Link>
    );
  }

  return (
    <>
      <Link href="/login" className="v2-btn v2-btn-secondary v2-hide-mobile">
        Autentificare
      </Link>
      <Link href="/signup" className="v2-btn v2-btn-primary">
        Înregistrează-te
      </Link>
    </>
  );
}
