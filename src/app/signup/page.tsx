"use client";

import {UiText,UiElement} from '@/components/UiText';
import { useState, Suspense, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Field, inputClass, Button } from "@/components/ui";
import { AuthLayout } from "@/components/AuthLayout";
import { EmailVerificationNotice } from "@/components/EmailVerificationNotice";
import {trackCompanySignup} from "@/lib/googleAds";
import {postAuthDestination,authSwitchHref} from "@/lib/authRedirect";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") === "firma" ? "firma" : "client";
  const [role, setRole] = useState<"client" | "firma">(initialRole);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [cui, setCui] = useState("");
  const [coverageCity, setCoverageCity] = useState("Constanța");
  const [coverageCitiesExtra, setCoverageCitiesExtra] = useState("");
  const [referralCode, setReferralCode] = useState(searchParams.get("ref") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ email: string; emailAccepted: boolean; role: "client" | "firma"; destination: string } | null>(null);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!phone.trim()) {
      setError("Numărul de telefon este obligatoriu");
      return;
    }
    if (role === "firma" && !cui.trim()) {
      setError("CUI-ul firmei este obligatoriu");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          name,
          email,
          password,
          phone,
          cui,
          coverageCity,
          coverageCitiesExtra,
          referralCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Eroare la înregistrare");
      setCreated({
        email: email.trim(),
        emailAccepted: data.welcomeEmailStatus === "accepted",
        role,
        destination: postAuthDestination(searchParams.get("next"), role),
      });
      // Measurement must never affect creation or the confirmation screen.
      try { if (res.status === 201 && data.ok === true && data.role === "firma") trackCompanySignup("firma"); } catch { /* Optional measurement. */ }
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare necunoscută");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <AuthLayout>
        <div role="status" aria-live="polite">
          <h1 className="font-display font-bold text-2xl text-ink mb-3"><UiText text={"Contul a fost creat cu succes"}/></h1>
          <p className="text-sm text-ink mb-4 break-words"><UiText text={"Adresa contului: "}/><strong>{created.email}</strong></p>
          <p className="text-sm text-muted mb-5">
            {created.emailAccepted
              ? <UiText text={"Emailul de confirmare a fost acceptat pentru trimitere. Caută mesajul «NITIDO — confirmă adresa de email» în Inbox sau Spam. Primirea lui nu este încă confirmată."}/>
              : <UiText text={"Contul este salvat, dar trimiterea emailului de confirmare nu a fost confirmată. Nu trebuie să creezi contul din nou."}/>}
          </p>
        </div>
        <EmailVerificationNotice />
        {created.role === "firma" && (
          <p className="text-sm text-muted mb-5"><UiText text={"Confirmarea emailului este separată de verificarea firmei. Pentru a primi lucrări, firma trebuie să fie validată prin ANAF."}/></p>
        )}
        <Button className="w-full" onClick={() => {
          router.push(created.destination);
          router.refresh();
        }}><UiText text={"Continuă în cont"}/></Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="font-display font-extrabold text-2xl text-ink mb-1"><UiText text={"Cont nou"}/></h1>
      <p className="text-sm text-muted mb-6"><UiText text={"Alege tipul de cont și completează datele."}/></p>

      <div className="flex gap-2 mb-5">
        <button
          type="button"
          onClick={() => setRole("client")}
          className={`flex-1 py-2.5 rounded-xl border font-display font-bold text-xs transition-all ${
            role === "client"
              ? "border-aqua bg-aqua/10 text-ink shadow-[0_1px_2px_rgba(0,158,96,0.1)]"
              : "border-line text-muted hover:border-ink/20"
          }`}
        ><UiText text={"Sunt client"}/></button>
        <button
          type="button"
          onClick={() => setRole("firma")}
          className={`flex-1 py-2.5 rounded-xl border font-display font-bold text-xs transition-all ${
            role === "firma"
              ? "border-aqua bg-aqua/10 text-ink shadow-[0_1px_2px_rgba(0,158,96,0.1)]"
              : "border-line text-muted hover:border-ink/20"
          }`}
        ><UiText text={"Sunt firmă de curățenie"}/></button>
      </div>

      <form onSubmit={submit}>
          <Field label={role === "firma" ? "Nume firmă" : "Nume"}>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Parolă">
            <input
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Telefon *">
            <UiElement as="input"
              className={inputClass}
              placeholder="07xx xxx xxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </Field>

          {role === "firma" && (
            <>
              <Field label="CUI *">
                <UiElement as="input"
                  className={inputClass}
                  placeholder="ex: RO12345678"
                  value={cui}
                  onChange={(e) => setCui(e.target.value)}
                />
                <p className="text-[11px] text-muted mt-1"><UiText text={"Verificăm CUI-ul direct la ANAF — trebuie să corespundă unei firme reale, active."}/></p>
              </Field>
              <Field label="Zonă de acoperire (oraș principal)">
                <input
                  className={inputClass}
                  value={coverageCity}
                  onChange={(e) => setCoverageCity(e.target.value)}
                />
              </Field>
              <Field label="Alte localități acoperite (opțional)">
                <UiElement as="input"
                  className={inputClass}
                  placeholder="ex: Ovidiu, Mamaia, Năvodari"
                  value={coverageCitiesExtra}
                  onChange={(e) => setCoverageCitiesExtra(e.target.value)}
                />
                <p className="text-[11px] text-muted mt-1"><UiText text={"Separate prin virgulă — primești alerte și pentru lucrări din aceste zone, nu doar din orașul principal."}/></p>
              </Field>
            </>
          )}

          <Field label="Cod de recomandare (opțional)">
            <UiElement as="input"
              className={inputClass}
              placeholder="ex: ANAP-4X7Q"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
            />
            <p className="text-[11px] text-muted mt-1"><UiText text={"Ai un cod de la un prieten? Primiți amândoi 20 lei credit."}/></p>
          </Field>

          {error && <p className="text-coral text-xs mb-3">{<UiText text={error}/>}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <UiText text={"Se creează contul..."}/> : <UiText text={"Creează cont"}/>}
          </Button>
      </form>

      <p className="text-xs text-muted text-center mt-5"><UiText text={"Ai deja cont?"}/>{" "}
        <Link href={authSwitchHref("login",searchParams.get("next"),role)} className="text-aqua-deep font-semibold"><UiText text={"Autentifică-te"}/></Link>
      </p>
    </AuthLayout>
  );
}
