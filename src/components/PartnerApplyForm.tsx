"use client";
import { FormEvent, useState } from "react";

const SERVICES = [
  ["curatenie", "Curățenie recurentă și turnover"],
  ["textile", "Textile și consumabile"],
  ["sanitare", "Instalații sanitare ușoare"],
  ["electric", "Electric ușor"],
  ["hvac", "HVAC / aer condiționat"],
  ["acces", "Acces, lockbox, smart lock"],
];
const ZONES = ["Constanța", "Mamaia", "Mamaia-Sat"];
const field = "mt-2 w-full rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 text-[#111827] outline-none focus:border-[var(--nitido-brand)]";

export function PartnerApplyForm() {
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
    <form id="aplica" onSubmit={onSubmit} className="rounded-[28px] border border-[#e2e8f0] bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,.06)]">
      <p className="v2-eyebrow">Verificare</p>
      <h2 className="mt-3 text-3xl font-bold tracking-[-.03em]">Aplică pentru programul Pro</h2>
      <p className="mt-3 max-w-2xl text-[#4d5751] leading-7">Completarea durează câteva minute. Nu activează colaborarea și nu garantează volum.</p>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <section>
          <h3 className="text-sm font-bold uppercase tracking-[.12em] text-[#6b736e]">Firmă</h3>
          <label className="mt-4 block text-sm font-medium">Denumire firmă / PFA<input name="company" required minLength={2} className={field} /></label>
          <label className="mt-4 block text-sm font-medium">CUI / CIF<input name="cui" required className={field} /></label>
          <label className="mt-4 block text-sm font-medium">Formă juridică
            <select name="legalForm" required className={field}>
              <option value="SRL">SRL</option>
              <option value="PFA">PFA</option>
              <option value="II">II</option>
              <option value="IF">IF</option>
              <option value="alta">Altă formă eligibilă</option>
            </select>
          </label>
          <label className="mt-4 block text-sm font-medium">Reprezentant<input name="representative" required className={field} /></label>
        </section>
        <section>
          <h3 className="text-sm font-bold uppercase tracking-[.12em] text-[#6b736e]">Contact operațional</h3>
          <label className="mt-4 block text-sm font-medium">Telefon<input name="phone" required className={field} /></label>
          <label className="mt-4 block text-sm font-medium">E-mail<input name="email" type="email" required className={field} /></label>
          <label className="mt-4 block text-sm font-medium">Echipe disponibile<input name="teams" type="number" min={1} required className={field} /></label>
          <label className="mt-4 block text-sm font-medium">Persoane active<input name="people" type="number" min={1} required className={field} /></label>
        </section>
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <fieldset>
          <legend className="text-sm font-bold uppercase tracking-[.12em] text-[#6b736e]">Servicii</legend>
          <div className="mt-4 space-y-3 text-sm text-[#3e4842]">{SERVICES.map(([v, l]) => <label key={v} className="flex gap-3 rounded-2xl border border-[#eef2f6] px-4 py-3"><input type="checkbox" name="services" value={v} className="mt-1" /><span>{l}</span></label>)}</div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-bold uppercase tracking-[.12em] text-[#6b736e]">Zone pilot</legend>
          <div className="mt-4 space-y-3 text-sm text-[#3e4842]">{ZONES.map((z) => <label key={z} className="flex gap-3 rounded-2xl border border-[#eef2f6] px-4 py-3"><input type="checkbox" name="zones" value={z} className="mt-1" /><span>{z}</span></label>)}</div>
          <label className="mt-4 block text-sm font-medium">Capacitate săptămânală<input name="capacity" required className={field} placeholder="ex. 12 turnover-uri sau 40 ore" /></label>
          <fieldset className="mt-4 text-sm"><legend className="font-medium">Poate prelua urgențe</legend>
            <label className="mr-6 mt-2 inline-flex gap-2"><input type="radio" name="emergency" value="da" required /> Da</label>
            <label className="inline-flex gap-2"><input type="radio" name="emergency" value="nu" /> Nu</label>
          </fieldset>
        </fieldset>
      </div>

      <label className="mt-8 block text-sm font-medium">Structură de preț<textarea name="pricing" required rows={4} className={field} /></label>
      <label className="mt-4 block text-sm font-medium">Experiență relevantă<textarea name="experience" required maxLength={1500} rows={5} className={field} /></label>

      <div className="mt-8 space-y-3 text-sm text-[#3e4842]">
        <label className="flex gap-3"><input type="checkbox" name="accurate" required className="mt-1" /><span>Confirm că informațiile transmise sunt corecte.</span></label>
        <label className="flex gap-3"><input type="checkbox" name="dataConsent" required className="mt-1" /><span>Sunt de acord cu prelucrarea datelor pentru evaluarea aplicării.</span></label>
        <label className="flex gap-3"><input type="checkbox" name="noGuarantee" required className="mt-1" /><span>Înțeleg că aplicarea nu garantează activarea sau un volum de lucrări.</span></label>
      </div>
      {status === "error" && <p className="mt-4 text-sm text-[#b42318]" role="alert">{error}</p>}
      <button disabled={status === "loading"} className="v2-btn v2-btn-primary mt-8">
        {status === "loading" ? "Se trimite…" : "Trimite spre verificare"}
      </button>
    </form>
  );
}
