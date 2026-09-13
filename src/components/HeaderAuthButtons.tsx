"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Account = { role: string | null; label: string | null };

// Resolve the current session on the server at click time, including ADMIN.
// A normal anchor avoids a prefetched destination surviving a role change.
export function HeaderAuthButtons({onNavigate}:{onNavigate?:()=>void} = {}) {
  const [account, setAccount] = useState<Account | null>(null);
  const pathname = usePathname();
  useEffect(() => {
    let controller: AbortController | undefined;
    const refresh = async () => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      try {
        const response = await fetch("/api/auth/account", { cache: "no-store", signal: current.signal });
        if (!response.ok) throw new Error("Account lookup failed");
        const next: Account = await response.json();
        if (!current.signal.aborted) setAccount(next);
      } catch {
        if (!current.signal.aborted) setAccount(null);
      }
    };
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      controller?.abort();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [pathname]);

  return <div className="public-account-actions">
    {account && account.role !== "admin" && <>
    <Link href="/login?role=client" onClick={onNavigate} className="v2-btn v2-btn-secondary">Login client</Link>
    <Link href="/login?role=firma" onClick={onNavigate} className="v2-btn v2-btn-secondary">Login firmă</Link>
    </>}
    {(!account || account.label) && <a href="/cont" onClick={onNavigate} className="v2-btn v2-btn-primary">{account?.label ?? "Acces cont"}</a>}
  </div>;
}
