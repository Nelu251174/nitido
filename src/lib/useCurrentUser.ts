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
  verified?: number;
  description?: string | null;
  working_hours?: string | null;
  services?: string | null;
  website?: string | null;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined); // undefined = loading
  const [firm, setFirm] = useState<CurrentFirm | null>(null);
  const [error,setError]=useState<string|null>(null);
  const [attempt,setAttempt]=useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then(async r=>{if(r.status===401)return {user:null};if(!r.ok)throw new Error('Autentificarea nu a putut fi verificată.');return r.json();})
      .then((d) => {
        if (cancelled) return;
        if(!d||!(d.user===null||typeof d.user==='object'&&typeof d.user.id==='string'&&['client','firma'].includes(d.user.role)))throw new Error('Răspuns de autentificare incomplet.');
        setUser(d.user);
        setFirm(d.firm ?? null);
        setError(null);
      }).catch(()=>{if(!cancelled){setUser(null);setFirm(null);setError('Conexiunea nu permite verificarea contului. Reîncearcă.');}});
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retry(){setUser(undefined);setError(null);setAttempt(n=>n+1);}
  return { user, firm, loading: user === undefined,error,retry };
}
