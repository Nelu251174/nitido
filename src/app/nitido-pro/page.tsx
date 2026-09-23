"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";

const field = "mt-2 w-full rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 outline-none focus:border-[var(--nitido-brand)]";

export default function NitidoProPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus("loading");
    const res = await fetch("/api/pro/leads/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        phone: form.get("phone"),
        email: form.get("email"),
        city: form.get("city"),
        contactConsent: form.get("contactConsent") === "on",
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Eroare");
      setStatus("error");
      return;
    }
    window.location.href = "/nitido-pro/multumim";
  }
  return (
    <main className="bg-[#f7f9fc] text-[#111827]">
      <SiteHeader />
      <section className="v2-container py-20 max-md:py-12">
        <p className="v2-eyebrow">NITIDO Pro · Pilot proprietăți</p>
        <h1 className="mt-5 max-w-4xl text-[clamp(40px,6vw,68px)] font-bold leading-[1.04] tracking-[-.045em]">
          Operațiuni recurente pentru portofoliul tău, fără haos operațional.
        </h1>
        <p className="mt-7 max-w-3xl text-lg leading-8 text-[#3e4842]">
          Curățenie recurentă, verificări, intervenții aprobate, calendar și raportare cu dovezi. Pilot în Constanța, Mamaia și Mamaia-Sat. Nu promitem acoperire națională sau SLA garantat.
        </p>
      </section>
      <section className="v2-container pb-24 max-w-3xl">
        <form onSubmit={onSubmit} className="rounded-[28px] border border-[#e2e8f0] bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,.06)]">
          <h2 className="text-3xl font-bold tracking-[-.03em]">Cere o discuție de pilot</h2>
          <label className="mt-6 block text-sm font-medium">Nume<input name="name" required className={field} /></label>
          <label className="mt-4 block text-sm font-medium">Telefon<input name="phone" className={field} /></label>
          <label className="mt-4 block text-sm font-medium">Email<input name="email" type="email" className={field} /></label>
          <label className="mt-4 block text-sm font-medium">Oraș<input name="city" required className={field} /></label>
          <label className="mt-5 flex gap-3 text-sm text-[#3e4842]"><input type="checkbox" name="contactConsent" required className="mt-1" /><span>Sunt de acord să fiu contactat pentru evaluarea eligibilității.</span></label>
          {status === "error" && <p className="mt-3 text-sm text-[#b42318]">{error}</p>}
          <button disabled={status === "loading"} className="v2-btn v2-btn-primary mt-8">{status === "loading" ? "Se trimite…" : "Trimite solicitarea"}</button>
        </form>
        <p className="mt-8 text-sm text-[#6b736e]">Ești firmă de servicii? <Link href="/parteneri-pro" className="font-semibold text-[var(--nitido-brand-dark)]">Aplică în rețeaua de parteneri</Link></p>
      </section>
      <SiteFooter />
    </main>
  );
}
