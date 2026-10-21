"use client";
import {UiText} from '@/components/UiText';
import { useState,useRef, type FormEvent } from "react";
import Link from "next/link";
import { SERVICES } from "@/lib/pro/shared";
export default function LeadForm({ partner = false }: { partner?: boolean }) {
  const [step, setStep] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  const inFlight=useRef(false),requestKey=useRef<string|null>(null),requestBody=useRef('');
  const [reference,setReference]=useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(inFlight.current)return;
    const form = e.currentTarget;
    if (step === 1) {
      setStep(2);
      return;
    }
    inFlight.current=true;setBusy(true);
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
    const serialized=JSON.stringify(b);
    if(requestBody.current!==serialized){requestBody.current=serialized;requestKey.current=crypto.randomUUID();}
    try {
      const r = await fetch("/api/pro/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key":requestKey.current! },
          signal:AbortSignal.timeout(15000),
          body: serialized,
        }),
        data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if(typeof data.id!=='string'||!data.id)throw new Error("Confirmarea nu a fost primită. Reîncearcă; solicitarea nu se dublează.");
      setReference(data.id);setDone(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.name==='TimeoutError'?"Confirmarea întârzie. Datele sunt păstrate; poți reîncerca fără dublarea cererii.":e.message
          : "Cererea nu a fost trimisă. Reîncearcă.",
      );
    } finally {
      inFlight.current=false;setBusy(false);
    }
  }
  if (done)
    return (
      <div className="pro-form">
        <div className="pro-success">
          <h1><UiText text={"Cererea ta a fost înregistrată."}/></h1><p><UiText text="Referință solicitare: "/><b>{reference}</b></p>
          <p><UiText text={"Un reprezentant NITIDO va analiza"}/>{" "}
            {partner
              ? <UiText text={"solicitarea de parteneriat"}/>
              : <UiText text={"eligibilitatea portofoliului"}/>}<UiText text={". Cererea nu activează automat accesul la portofoliu. Dacă trebuie să corectezi informațiile trimise, contactează echipa la support@nitido.ro și menționează adresa de email folosită în formular."}/></p>
        </div>
        <Link href="/nitido-pro" className="v2-btn v2-btn-primary"><UiText text={"Înapoi la NITIDO Pro"}/></Link>
      </div>
    );
  return (
    <div className="pro-form">
      <p className="pro-eyebrow"><UiText text={"NITIDO PRO · "}/>{partner ? <UiText text={"Parteneriat"}/> : <UiText text={"Evaluarea portofoliului"}/>}
      </p>
      <h1>
        {partner
          ? <UiText text={"Aplică pentru parteneriat"}/>
          : <UiText text={"Verifică dacă portofoliul tău este eligibil pentru NITIDO Pro"}/>}
      </h1>
      <p className="pro-muted">
        {partner
          ? <UiText text={"Prezintă serviciile pe care le poți executa, zonele acoperite și capacitatea reală a firmei. Analizăm potrivirea cu lucrările din pilot înainte de activare; trimiterea cererii nu garantează acceptarea sau un volum de comenzi. La pasul următor ne lași datele pentru clarificarea solicitării."}/>
          : <UiText text={"Descrie zona, numărul de proprietăți, utilizarea lor și serviciile recurente de care ai nevoie. Pilotul se adresează portofoliilor de minimum 5 proprietăți din zone eligibile. Analizăm cererea înainte de activare și stabilim separat condițiile colaborării; acest formular nu generează o rezervare sau o plată."}/>}
      </p>
      <p className="my-6 text-sm"><UiText text={"Pasul "}/>{step}<UiText text={" din 2 · "}/>{step === 1 ? <UiText text={"Descrie serviciile și zona"}/> : <UiText text={"Completează datele pentru contact"}/>}
      </p>
      <form onSubmit={submit} className="pro-card" onInvalidCapture={e=>{const field=e.target as HTMLInputElement;field.scrollIntoView({block:'center'});}}>
        <div hidden={step !== 1}>
          <div className="pro-form-grid">
            <label className="pro-field"><UiText text={"Oraș / zone"}/><input required={step === 1} name="city" maxLength={120} />
            </label>
            {!partner && (
              <label className="pro-field"><UiText text={"Număr de proprietăți"}/><input
                  required={step === 1}
                  name="property_count"
                  type="number"
                  min={5}
                  max={100000}
                />
              </label>
            )}
            <label className="pro-field">
              {partner ? <UiText text={"Denumire firmă"}/> : <UiText text={"Companie / brand (opțional)"}/>}
              <input
                name="company"
                required={partner && step === 1}
                maxLength={150}
              />
            </label>
            {partner ? (
              <label className="pro-field"><UiText text={"CUI"}/><input name="legal_id" required={step === 1} maxLength={40} />
              </label>
            ) : (
              <>
                <label className="pro-field"><UiText text={"Tip proprietăți"}/><select name="property_type">
                    <option value="Apartamente"><UiText text={"Apartamente"}/></option>
                    <option value="Case / vile"><UiText text={"Case / vile"}/></option>
                    <option value="Aparthotel"><UiText text={"Aparthotel"}/></option>
                    <option value="Mixt"><UiText text={"Mixt"}/></option>
                  </select>
                </label>
                <label className="pro-field"><UiText text={"Utilizare"}/><select name="usage">
                    <option value="Regim hotelier"><UiText text={"Regim hotelier"}/></option>
                    <option value="Chirie pe termen lung"><UiText text={"Chirie pe termen lung"}/></option>
                    <option value="Mixt"><UiText text={"Mixt"}/></option>
                    <option value="Altul"><UiText text={"Altul"}/></option>
                  </select>
                </label>
              </>
            )}
            <label className="pro-field">
              {partner
                ? <UiText text={"Capacitate lucrări / lună"}/>
                : <UiText text={"Volum estimat de lucrări / lună"}/>}
              <input
                name="monthly_volume"
                type="number"
                min={1}
                max={100000}
                required={step === 1}
              />
            </label>
            <label className="pro-field"><UiText text={"Data estimată pentru activare"}/><input name="start_date" type="date" required={step === 1} />
            </label>
          </div>
          <fieldset className="my-5">
            <legend className="font-semibold text-sm mb-3"><UiText text={"Servicii "}/>{partner ? <UiText text={"oferite"}/> : <UiText text={"de interes"}/>}
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
              ? <UiText text={"Experiență și disponibilitate"}/>
              : <UiText text={"Detalii suplimentare (opțional)"}/>}
            <textarea name="notes" maxLength={2000} />
          </label>
          {!partner && (
            <p className="text-xs pro-muted mt-4"><UiText text={"Minimum 5 proprietăți în pilot. Pentru solicitări punctuale,"}/>{" "}
              <Link className="underline" href="/rezervare"><UiText text={"configurează curățenia"}/></Link>
              .
            </p>
          )}
        </div>
        <div hidden={step !== 2}>
          <div className="pro-form-grid">
            <label className="pro-field"><UiText text={"Nume și prenume"}/><input
                name="name"
                required={step === 2}
                maxLength={150}
                autoComplete="name"
              />
            </label>
            <label className="pro-field"><UiText text={"Telefon"}/><input
                name="phone"
                type="tel"
                required={step === 2}
                maxLength={40}
                autoComplete="tel"
              />
            </label>
            <label className="pro-field"><UiText text={"E-mail"}/><input
                name="email"
                type="email"
                required={step === 2}
                maxLength={200}
                autoComplete="email"
              />
            </label>
          </div>
          <label className="pro-check mt-6">
            <input type="checkbox" name="consent" required={step === 2} /><UiText text={"Am citit informarea privind prelucrarea datelor și sunt de acord să fiu contactat pentru această solicitare."}/></label>
          <Link
            href="/confidentialitate"
            className="underline text-sm mt-3 block"
          ><UiText text={"Politica de confidențialitate"}/></Link>
          <p className="text-xs pro-muted mt-4"><UiText text={"Nu include adrese exacte, coduri de acces, date de card sau date despre oaspeți."}/></p>
        </div>
        {error && (
          <p role="alert" className="pro-error">
            {<UiText text={error}/>}
          </p>
        )}
        <div className="pro-actions">
          {step === 2 && (
            <button
              type="button"
              className="v2-btn v2-btn-secondary"
              onClick={() => setStep(1)}
            ><UiText text={"Înapoi"}/></button>
          )}
          <button disabled={busy} aria-busy={busy} className="v2-btn v2-btn-primary">
            {busy
              ? <UiText text={"Se trimite…"}/>
              : step === 1
                ? <UiText text={"Continuă"}/>
                : partner
                  ? <UiText text={"Trimite solicitarea"}/>
                  : <UiText text={"Trimite cererea de evaluare"}/>}
          </button>
        </div>
      </form>
    </div>
  );
}
