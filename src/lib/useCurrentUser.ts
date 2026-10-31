"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

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

function useCurrentUserState(enabled = true, revalidateKey?: string | null) {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined); // undefined = loading
  const [firm, setFirm] = useState<CurrentFirm | null>(null);
  const [error,setError]=useState<string|null>(null);
  const [attempt,setAttempt]=useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const controller = new AbortController();
    fetch("/api/auth/me", {cache: "no-store", signal: controller.signal})
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
      controller.abort();
    };
  }, [attempt, enabled, revalidateKey]);

  const retry = useCallback(() => {setUser(undefined);setError(null);setAttempt(n=>n+1);}, []);
  return useMemo(() => ({user, firm, loading: user === undefined, error, retry}), [user, firm, error, retry]);
}

type CurrentUserState = ReturnType<typeof useCurrentUserState>;
const CurrentUserContext = createContext<CurrentUserState | null>(null);

/** The client layout survives page navigation; revalidate without removing its authenticated shell. */
export function CurrentUserProvider({children}: {children: ReactNode}) {
  const pathname = usePathname();
  const state = useCurrentUserState(true, pathname);
  return createElement(CurrentUserContext.Provider, {value: state}, children);
}

export function useCurrentUser() {
  const shared = useContext(CurrentUserContext);
  const standalone = useCurrentUserState(shared === null);
  return shared ?? standalone;
}
