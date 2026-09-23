"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

import { HeaderAuthButtons } from "./HeaderAuthButtons";

const LINKS: Array<[string, string]> = [
  ["/nitido-pro", "NITIDO Pro"],
  ["/cum-functioneaza", "Cum funcționează"],
  ["/pentru-clienti", "Pentru clienți"],
  ["/pentru-firme", "Pentru firme"],
  ["/preturi", "Prețuri"],
  ["/despre-noi", "Despre noi"],
  ["/contact", "Contact"],
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
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
        <div className="public-mobile-menu" aria-label="Meniu principal">
          <nav className="public-mobile-menu-links">
            {LINKS.map(([href, label]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className="public-mobile-menu-link">
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
