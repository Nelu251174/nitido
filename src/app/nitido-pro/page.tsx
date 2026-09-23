"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
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
        name: form.get("name"), phone: form.get("phone"), email: form.get("email"),
        city: form.get("city"), propertyType: form.get("propertyType"), propertyCount: form.get("propertyCount"),
        needs: form.getAll("needs"), frequency: form.get("frequency"), notes: form.get("notes"),
        contactConsent: form.get("contactConsent") === "on",
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Nu am putut trimite solicitarea.");
      setStatus("error");
      return;
    }
    window.location.href = "/nitido-pro/multumim";
  }
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <p className="text-xs font-bold uppercase tracking-wide text-aqua-deep">NITIDO Pro · Pilot</p>
      <h1 className="font-display font-extrabold text-4xl text-ink mt-3">Operatiuni recurente pentru proprietatile tale.</h1>
      <p className="text-muted mt-4">Pilot pentru un numar limitat de clienti. Nu este un serviciu de orice reparatie.</p>
      <form onSubmit={onSubmit} className="mt-10 space-y-4 border border-line rounded-2xl p-6 bg-white">
        <label className="block text-sm">Nume<input name="name" required className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
        <label className="block text-sm">Telefon<input name="phone" className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
        <label className="block text-sm">Email<input name="email" type="email" className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
        <label className="block text-sm">Oras / zona<input name="city" required className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
        <fieldset className="text-sm space-y-1"><legend>Tip de nevoie</legend>
          <label className="block"><input type="checkbox" name="needs" value="curatenie_recurenta" /> Curatenie recurenta</label>
          <label className="block"><input type="checkbox" name="needs" value="verificare" /> Verificare</label>
          <label className="block"><input type="checkbox" name="needs" value="mentenanta_usoara" /> Mentenanta usoara</label>
          <label className="block"><input type="checkbox" name="needs" value="interventie" /> Interventie aprobata</label>
        </fieldset>
        <label className="block text-sm"><input type="checkbox" name="contactConsent" required /> Sunt de acord sa fiu contactat despre NITIDO Pro.</label>
        {status === "error" && <p className="text-sm text-coral" role="alert">{error}</p>}
        <button disabled={status === "loading"} className="px-5 py-3 rounded-full btn-aurora text-white font-display font-bold">{status === "loading" ? "Se trimite..." : "Solicita o discutie pentru NITIDO Pro"}</button>
      </form>
      <p className="text-sm mt-8"><Link href="/parteneri-pro" className="text-aqua-deep">Devino partener NITIDO Pro</Link></p>
    </main>
  );
}
