"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui";

/**
 * Ecran de autentificare/înregistrare pe două coloane — panou de brand (stânga,
 * doar pe ecrane md+, fundal „mesh" animat) + formularul propriu-zis, plutind
 * într-un card de sticlă (dreapta) peste un fundal deschis cu urmă de gradient.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden md:flex md:w-[42%] lg:w-[38%] mesh-dark relative overflow-hidden flex-col justify-between p-10 lg:p-14">
        {/* pete de gradient animate, discret, fără să distragă */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-aqua/25 blur-3xl animate-blob" />
        <div className="pointer-events-none absolute top-1/3 -left-20 w-72 h-72 rounded-full bg-indigo/25 blur-3xl animate-blob-slow animate-blob-delay" />
        <div className="pointer-events-none absolute bottom-0 right-0 w-64 h-64 rounded-full bg-coral/15 blur-3xl animate-blob-slow" />

        <Link href="/" className="font-display font-extrabold text-lg text-white inline-block w-fit relative">
          Nit<span className="text-gradient">ido</span>
        </Link>

        <div className="relative">
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-display font-bold text-aqua glass-dark mb-5">
            Marketplace de curățenie · România
          </span>
          <h2 className="font-display font-extrabold text-3xl lg:text-4xl text-white leading-tight">
            Postezi. Prima firmă care apasă „Accept&quot; o ia.
          </h2>
          <p className="text-white/60 text-sm mt-4 max-w-sm leading-relaxed">
            Fără telefoane, fără negociere. Preț fix afișat de la început, plată
            securizată prin Stripe, firme verificate real la ANAF.
          </p>
          <div className="mt-8 space-y-3">
            {[
              "Alertă instant către firmele din zonă",
              "Banii se rezervă doar la acceptare",
              "Firme verificate direct la ANAF",
            ].map((t) => (
              <div key={t} className="flex items-center gap-2.5 text-white/80 text-sm">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                  <circle cx="8" cy="8" r="8" fill="#17B8A6" />
                  <path
                    d="M4.5 8.2l2.2 2.2L11.5 5.5"
                    stroke="white"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {t}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-white/30 text-xs">© 2026 Nitido</p>
      </div>

      <div className="flex-1 flex flex-col mesh-light">
        <div className="p-6 md:hidden">
          <Logo />
        </div>
        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md bg-white/90 backdrop-blur-sm border border-white rounded-3xl p-8 shadow-[0_8px_40px_-12px_rgba(20,37,48,0.18)]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
