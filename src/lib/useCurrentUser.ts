"use client";

import { useEffect, useState } from "react";

export interface CurrentUser {
  id: string;
  role: "client" | "firma";
  name: string;
  email: string | null;
  referral_code: string | null;
  credit_balance: number;
}

export interface CurrentFirm {
  id: string;
  coverage_city: string;
  coverage_cities_extra: string | null;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined); // undefined = loading
  const [firm, setFirm] = useState<CurrentFirm | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setUser(d.user);
        setFirm(d.firm ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, firm, loading: user === undefined };
}
