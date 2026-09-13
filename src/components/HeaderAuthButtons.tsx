"use client";

import Link from "next/link";

// Resolve the current session on the server at click time, including ADMIN.
// A normal anchor avoids a prefetched destination surviving a role change.
export function HeaderAuthButtons({onNavigate}:{onNavigate?:()=>void} = {}) {
  return <div className="public-account-actions">
    <Link href="/login?role=client" onClick={onNavigate} className="v2-btn v2-btn-secondary">Login client</Link>
    <Link href="/login?role=firma" onClick={onNavigate} className="v2-btn v2-btn-secondary">Login firmă</Link>
    <a href="/cont" onClick={onNavigate} className="v2-btn v2-btn-primary">Contul meu</a>
  </div>;
}
