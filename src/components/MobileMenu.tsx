"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

/**
 * Meniu pentru telefon (hamburger). Pe ecran mare, navigația din antet e
 * vizibilă direct (nav cu clasa `v2-hide-mobile`); pe telefon acea navigație e
 * ascunsă și NU exista niciun buton de meniu — de aici impresia că „butoanele
 * de sus nu funcționează". Componenta asta adaugă butonul de meniu (☰) care
 * apare doar pe telefon (`v2-only-mobile`) și deschide un panou cu aceleași
 * linkuri + Autentificare.
 */
const LINKS: Array<[string, string]> = [
  ["#cum", "Cum funcționează"],
  ["#score", "Calitate"],
  ["#firme", "Pentru firme"],
  ["#preturi", "Prețuri"],
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
        className="v2-only-mobile items-center justify-center w-11 h-11 -mr-2 rounded-lg text-[#101711]"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 top-[66px] z-40 bg-[#f4f3ee]" role="dialog" aria-modal="true">
          <nav className="v2-container py-4 flex flex-col">
            {LINKS.map(([href, label]) =>
              href.startsWith("#") ? (
                <a
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="py-4 text-lg font-semibold text-[#101711] border-b border-[#e3e2da]"
                >
                  {label}
                </a>
              ) : (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="py-4 text-lg font-semibold text-[#101711] border-b border-[#e3e2da]"
                >
                  {label}
                </Link>
              )
            )}
            <div className="flex flex-col gap-3 mt-6">
              <Link href="/login" onClick={() => setOpen(false)} className="v2-btn v2-btn-secondary w-full justify-center">
                Autentificare
              </Link>
              <Link href="/signup" onClick={() => setOpen(false)} className="v2-btn v2-btn-primary w-full justify-center">
                Înregistrează-te
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
