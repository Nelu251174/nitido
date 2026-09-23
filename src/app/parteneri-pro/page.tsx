"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";

const SERVICES = [
  ["curatenie", "Curățenie recurentă / turnover"],
  ["textile", "Textile și consumabile"],
  ["sanitare", "Instalații sanitare ușoare"],
  ["electric", "Electric ușor"],
  ["hvac", "HVAC / AC"],
  ["acces", "Acces proprietate / lockbox"],
];
const ZONES = ["Constanța", "Mamaia", "Mamaia-Sat"];

export default function ParteneriProPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus("loading");
    setError("");
    const res = await fetch("/api/pro/leads/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: form.get("company"),
        cui: form.get("cui"),
        legalForm: form.get("legalForm"),
        representative: form.get("representative"),
        phone: form.get("phone"),
        email: form.get("email"),
        services: form.getAll("services"),
        zones: form.getAll("zones"),
        teams: form.get("teams"),
        people: form.get("people"),
        capacity: form.get("capacity"),
        emergency: form.get("emergency"),
        pricing: form.get("pricing"),
        experience: form.get("experience"),
        accurate: form.get("accurate") === "on",
        noGuarantee: form.get("noGuarantee") === "on",
        dataConsent: form.get("dataConsent") === "on",
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Nu am putut trimite aplicația.");
      setStatus("error");
      return;
    }
    window.location.href = "/parteneri-pro/multumim";
  }

  return (
    <div>
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs font-bold uppercase tracking-wide text-aqua-deep">Program pilot · Constanța, Mamaia și Mamaia-Sat</p>
        <h1 className="font-display font-extrabold text-4xl text-ink mt-3">Devino partener NITIDO Pro</h1>
        <p className="text-muted mt-4 leading-relaxed">
          Lucrări recurente pentru echipe care livrează corect, documentat și la timp.
          Primești lucrări potrivite zonelor și serviciilor tale, cu calendar, instrucțiuni, raportare și facturare clară.
        </p>
        <p className="text-sm mt-3">Programul nu garantează volum minim. Activarea depinde de zonă, categorie, documente, capacitate și evaluarea operațională.</p>

        <section className="mt-10 space-y-2 text-sm text-ink">
          <h2 className="font-display font-bold text-xl">Standarde</h2>
          <p>Confirmare sau refuz rapid. Interval respectat. Checklist și raport. Acces doar la lucrarea alocată. Deviz înainte de cost peste plafon.</p>
        </section>

        <form id="aplica" onSubmit={onSubmit} className="mt-10 space-y-4 border border-line rounded-2xl p-6 bg-white">
          <h2 className="font-display font-bold text-xl">Aplică pentru verificare</h2>
          <label className="block text-sm">Denumire firmă / PFA<input name="company" required minLength={2} className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
          <label className="block text-sm">CUI / CIF<input name="cui" required className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
          <label className="block text-sm">Formă juridică
            <select name="legalForm" required className="mt-1 w-full border border-line rounded-lg px-3 py-2">
              <option value="SRL">SRL</option>
              <option value="PFA">PFA</option>
              <option value="II">II</option>
              <option value="IF">IF</option>
              <option value="alta">Altă formă eligibilă</option>
            </select>
          </label>
          <label className="block text-sm">Reprezentant<input name="representative" required className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
          <label className="block text-sm">Telefon operațional<input name="phone" required className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
          <label className="block text-sm">E-mail operațional<input name="email" type="email" required className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
          <fieldset className="text-sm space-y-1"><legend>Categorii</legend>
            {SERVICES.map(([v, l]) => <label key={v} className="block"><input type="checkbox" name="services" value={v} /> {l}</label>)}
          </fieldset>
          <fieldset className="text-sm space-y-1"><legend>Zone</legend>
            {ZONES.map((z) => <label key={z} className="block"><input type="checkbox" name="zones" value={z} /> {z}</label>)}
          </fieldset>
          <label className="block text-sm">Număr echipe<input name="teams" type="number" min={1} required className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
          <label className="block text-sm">Persoane active<input name="people" type="number" min={1} required className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
          <label className="block text-sm">Capacitate săptămânală estimată<input name="capacity" required className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
          <fieldset className="text-sm"><legend>Poate prelua urgențe</legend>
            <label className="mr-4"><input type="radio" name="emergency" value="da" required /> Da</label>
            <label><input type="radio" name="emergency" value="nu" /> Nu</label>
          </fieldset>
          <label className="block text-sm">Structură de preț<textarea name="pricing" required className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
          <label className="block text-sm">Experiență relevantă<textarea name="experience" required maxLength={1500} className="mt-1 w-full border border-line rounded-lg px-3 py-2" /></label>
          <label className="block text-sm"><input type="checkbox" name="accurate" required /> Confirm că informațiile sunt corecte.</label>
          <label className="block text-sm"><input type="checkbox" name="dataConsent" required /> Sunt de acord cu prelucrarea datelor pentru evaluarea aplicării.</label>
          <label className="block text-sm"><input type="checkbox" name="noGuarantee" required /> Înțeleg că trimiterea nu garantează activarea sau volum de lucrări.</label>
          {status === "error" && <p className="text-sm text-coral" role="alert">{error}</p>}
          <button disabled={status === "loading"} className="px-5 py-3 rounded-full btn-aurora text-white font-display font-bold">
            {status === "loading" ? "Se trimite…" : "Aplică pentru verificare"}
          </button>
        </form>
        <p className="text-sm mt-8"><Link href="/nitido-pro" className="text-aqua-deep">Ești proprietar? NITIDO Pro clienți</Link></p>
      </main>
      <SiteFooter />
    </div>
  );
}
