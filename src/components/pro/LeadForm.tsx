"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { SERVICES } from "@/lib/pro/shared";
export default function LeadForm({ partner = false }: { partner?: boolean }) {
  const [step, setStep] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (step === 1) {
      setStep(2);
      return;
    }
    setBusy(true);
    setError("");
    const fd = new FormData(form),
      b = {
        ...Object.fromEntries(fd),
        kind: partner ? "partner" : "client",
        property_count: Number(fd.get("property_count")),
        consent: fd.get("consent") === "on",
        services: fd.getAll("services"),
        policy_version: "pro-v1.1",
      };
    try {
      const r = await fetch("/api/pro/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(b),
        }),
        data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setDone(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Cererea nu a fost trimisă. Reîncearcă.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <div className="pro-form">
        <div className="pro-success">
          <h1>Cererea ta a fost înregistrată.</h1>
          <p>
            Un reprezentant NITIDO va analiza{" "}
            {partner
              ? "solicitarea de parteneriat"
              : "eligibilitatea portofoliului"}
            .
          </p>
        </div>
        <Link href="/nitido-pro" className="v2-btn v2-btn-primary">
          Înapoi la NITIDO Pro
        </Link>
      </div>
    );
  return (
    <div className="pro-form">
      <p className="pro-eyebrow">
        NITIDO PRO · {partner ? "Parteneriat" : "Evaluarea portofoliului"}
      </p>
      <h1>
        {partner
          ? "Aplică pentru parteneriat"
          : "Verifică dacă portofoliul tău este eligibil pentru NITIDO Pro"}
      </h1>
      <p className="pro-muted">
        {partner
          ? "Analizăm serviciile, zona și capacitatea firmei înainte de activare."
          : "Analizăm tipul proprietăților, zona de operare, volumul lucrărilor și nevoile recurente înainte de activare."}
      </p>
      <p className="my-6 text-sm">
        Pasul {step} din 2 · {step === 1 ? "Nevoile tale" : "Date de contact"}
      </p>
      <form onSubmit={submit} className="pro-card">
        <div hidden={step !== 1}>
          <div className="pro-form-grid">
            <label className="pro-field">
              Oraș / zone
              <input required={step === 1} name="city" maxLength={120} />
            </label>
            {!partner && (
              <label className="pro-field">
                Număr de proprietăți
                <input
                  required={step === 1}
                  name="property_count"
                  type="number"
                  min={5}
                  max={100000}
                />
              </label>
            )}
            <label className="pro-field">
              {partner ? "Denumire firmă" : "Companie / brand (opțional)"}
              <input
                name="company"
                required={partner && step === 1}
                maxLength={150}
              />
            </label>
            {partner ? (
              <label className="pro-field">
                CUI
                <input name="legal_id" required={step === 1} maxLength={40} />
              </label>
            ) : (
              <>
                <label className="pro-field">
                  Tip proprietăți
                  <select name="property_type">
                    <option>Apartamente</option>
                    <option>Case / vile</option>
                    <option>Aparthotel</option>
                    <option>Mixt</option>
                  </select>
                </label>
                <label className="pro-field">
                  Utilizare
                  <select name="usage">
                    <option>Regim hotelier</option>
                    <option>Chirie pe termen lung</option>
                    <option>Mixt</option>
                    <option>Altul</option>
                  </select>
                </label>
              </>
            )}
            <label className="pro-field">
              {partner
                ? "Capacitate lucrări / lună"
                : "Volum estimat de lucrări / lună"}
              <input
                name="monthly_volume"
                type="number"
                min={1}
                max={100000}
                required={step === 1}
              />
            </label>
            <label className="pro-field">
              Data estimată pentru activare
              <input name="start_date" type="date" required={step === 1} />
            </label>
          </div>
          <fieldset className="my-5">
            <legend className="font-semibold text-sm mb-3">
              Servicii {partner ? "oferite" : "de interes"}
            </legend>
            {Object.entries(SERVICES).map(([v, l]) => (
              <label className="pro-check mb-2" key={v}>
                <input type="checkbox" name="services" value={v} />
                {l}
              </label>
            ))}
          </fieldset>
          <label className="pro-field">
            {partner
              ? "Experiență și disponibilitate"
              : "Cea mai mare problemă operațională actuală"}
            <textarea name="notes" maxLength={2000} required={step === 1} />
          </label>
          {!partner && (
            <p className="text-xs pro-muted mt-4">
              Minimum 5 proprietăți în pilot. Pentru solicitări punctuale,{" "}
              <Link className="underline" href="/rezervare">
                configurează curățenia
              </Link>
              .
            </p>
          )}
        </div>
        <div hidden={step !== 2}>
          <div className="pro-form-grid">
            <label className="pro-field">
              Nume și prenume
              <input
                name="name"
                required={step === 2}
                maxLength={150}
                autoComplete="name"
              />
            </label>
            <label className="pro-field">
              Telefon
              <input
                name="phone"
                type="tel"
                required={step === 2}
                maxLength={40}
                autoComplete="tel"
              />
            </label>
            <label className="pro-field">
              E-mail
              <input
                name="email"
                type="email"
                required={step === 2}
                maxLength={200}
                autoComplete="email"
              />
            </label>
          </div>
          <label className="pro-check mt-6">
            <input type="checkbox" name="consent" required={step === 2} />
            Am citit informarea privind prelucrarea datelor și sunt de acord să
            fiu contactat pentru această solicitare.
          </label>
          <Link
            href="/confidentialitate"
            className="underline text-sm mt-3 block"
          >
            Politica de confidențialitate
          </Link>
          <p className="text-xs pro-muted mt-4">
            Nu include adrese exacte, coduri de acces, date de card sau date
            despre oaspeți.
          </p>
        </div>
        {error && (
          <p role="alert" className="pro-error">
            {error}
          </p>
        )}
        <div className="pro-actions">
          {step === 2 && (
            <button
              type="button"
              className="v2-btn v2-btn-secondary"
              onClick={() => setStep(1)}
            >
              Înapoi
            </button>
          )}
          <button disabled={busy} className="v2-btn v2-btn-primary">
            {busy
              ? "Se trimite…"
              : step === 1
                ? "Continuă"
                : partner
                  ? "Trimite solicitarea"
                  : "Trimite cererea de evaluare"}
          </button>
        </div>
      </form>
    </div>
  );
}
