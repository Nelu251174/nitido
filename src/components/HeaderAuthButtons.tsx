"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Me = { role: "client" | "firma"; name: string } | null;

// Keep both role entry points visible, including while session data loads.
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

  return <div className="public-account-actions">
    <Link href="/login?role=client" className="v2-btn v2-btn-secondary">Login client</Link>
    <Link href="/login?role=firma" className="v2-btn v2-btn-secondary">Login firmă</Link>
    {me && <Link href={me.role === "firma" ? "/firma" : "/client"} className="v2-btn v2-btn-primary">Contul meu</Link>}
  </div>;
}
