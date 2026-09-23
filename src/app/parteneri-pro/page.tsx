"use client";

import { FormEvent, useState } from "react";

export default function PartnersProPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus("loading");
    const res = await fetch("/api/pro/leads/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        phone: form.get("phone"),
        serviceTypes: form.get("serviceTypes"),
        areas: form.get("areas"),
        availability: form.get("availability"),
        experience: form.get("experience"),
        capacity: form.get("capacity"),
        notes: form.get("notes"),
        acceptStandards: form.get("acceptStandards") === "on",
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Nu am putut trimite candidatura.");
      setStatus("error");
      return;
    }
    window.location.href = "/parteneri-pro/multumim";
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="font-display font-extrabold text-4xl text-ink">Devino partener NITIDO Pro</h1>
      <p className="text-muted mt-4">
        Lucrari recurente, calendar predictibil, standarde de executie, proceduri de acces si raportare,
        evaluare operationala, facturare clara.
      </p>
      <p className="text-sm mt-2">Trimiterea formularului nu activeaza automat colaborarea.</p>
      <form onSubmit={onSubmit} className="mt-10 space-y-4 border border-line rounded-2xl p-6 bg-white">
        <label className="block text-sm">Nume persoana / firma<input name="name" required className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
        <label className="block text-sm">Email<input name="email" type="email" className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
        <label className="block text-sm">Telefon<input name="phone" className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
        <label className="block text-sm">Tipuri de servicii<input name="serviceTypes" required className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
        <label className="block text-sm">Zone deservite<input name="areas" required className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
        <label className="block text-sm">Disponibilitate<input name="availability" className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
        <label className="block text-sm">Experienta<textarea name="experience" className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
        <label className="block text-sm">Capacitate estimata<input name="capacity" className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
        <label className="block text-sm">Observatii<textarea name="notes" className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
        <label className="block text-sm"><input type="checkbox" name="acceptStandards" required /> Accept standardele de lucru NITIDO Pro.</label>
        {status === "error" && <p className="text-sm text-coral" role="alert">{error}</p>}
        <button disabled={status === "loading"} className="px-5 py-3 rounded-full btn-aurora text-white font-display font-bold">
          {status === "loading" ? "Se trimite..." : "Trimite candidatura"}
        </button>
      </form>
    </main>
  );
}
