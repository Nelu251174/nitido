"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

import { HeaderAuthButtons } from "./HeaderAuthButtons";

/** Public mobile navigation shares the same account entry as the desktop header. */
const LINKS: Array<[string, string]> = [
  ["/cum-functioneaza", "Cum funcționează"],
  ["/pentru-clienti", "Pentru clienți"],
  ["/pentru-firme", "Pentru firme"],
  ["/preturi", "Prețuri"],
  ["/despre-noi", "Despre noi"],
  ["/contact", "Contact"],
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  // Blochează scroll-ul paginii cât timp meniul e deschis.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Închide meniul" : "Deschide meniul"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="v2-only-mobile items-center justify-center w-11 h-11 -mr-2 rounded-lg text-[#111827]"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 top-[66px] z-40 bg-[#f7f9fc]" role="dialog" aria-modal="true">
          <nav className="v2-container py-4 flex flex-col">
            {LINKS.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="py-4 text-lg font-semibold text-[#111827] border-b border-[#e2e8f0]"
              >
                {label}
              </Link>
            ))}
            <div className="flex flex-col gap-3 mt-6">
              <HeaderAuthButtons onNavigate={() => setOpen(false)} />
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
