"use client";

import { useState, Suspense, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Field, inputClass, Button } from "@/components/ui";
import { AuthLayout } from "@/components/AuthLayout";

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
      router.push(role === "client" ? "/client" : "/firma");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare necunoscută");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display font-extrabold text-2xl text-ink mb-1">Cont nou</h1>
      <p className="text-sm text-muted mb-6">Alege tipul de cont și completează datele.</p>

      <div className="flex gap-2 mb-5">
        <button
          type="button"
          onClick={() => setRole("client")}
          className={`flex-1 py-2.5 rounded-xl border font-display font-bold text-xs transition-all ${
            role === "client"
              ? "border-aqua bg-aqua/10 text-ink shadow-[0_1px_2px_rgba(14,143,128,0.1)]"
              : "border-line text-muted hover:border-ink/20"
          }`}
        >
          Sunt client
        </button>
        <button
          type="button"
          onClick={() => setRole("firma")}
          className={`flex-1 py-2.5 rounded-xl border font-display font-bold text-xs transition-all ${
            role === "firma"
              ? "border-aqua bg-aqua/10 text-ink shadow-[0_1px_2px_rgba(14,143,128,0.1)]"
              : "border-line text-muted hover:border-ink/20"
          }`}
        >
          Sunt firmă de curățenie
        </button>
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
            <input
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
                <input
                  className={inputClass}
                  placeholder="ex: RO12345678"
                  value={cui}
                  onChange={(e) => setCui(e.target.value)}
                />
                <p className="text-[11px] text-muted mt-1">
                  Verificăm CUI-ul direct la ANAF — trebuie să corespundă unei firme reale, active.
                </p>
              </Field>
              <Field label="Zonă de acoperire (oraș principal)">
                <input
                  className={inputClass}
                  value={coverageCity}
                  onChange={(e) => setCoverageCity(e.target.value)}
                />
              </Field>
              <Field label="Alte localități acoperite (opțional)">
                <input
                  className={inputClass}
                  placeholder="ex: Ovidiu, Mamaia, Năvodari"
                  value={coverageCitiesExtra}
                  onChange={(e) => setCoverageCitiesExtra(e.target.value)}
                />
                <p className="text-[11px] text-muted mt-1">
                  Separate prin virgulă — primești alerte și pentru lucrări din aceste zone,
                  nu doar din orașul principal.
                </p>
              </Field>
            </>
          )}

          <Field label="Cod de recomandare (opțional)">
            <input
              className={inputClass}
              placeholder="ex: ANAP-4X7Q"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
            />
            <p className="text-[11px] text-muted mt-1">
              Ai un cod de la un prieten? Primiți amândoi 20 lei credit.
            </p>
          </Field>

          {error && <p className="text-coral text-xs mb-3">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Se creează contul..." : "Creează cont"}
          </Button>
      </form>

      <p className="text-xs text-muted text-center mt-5">
        Ai deja cont?{" "}
        <Link href="/login" className="text-aqua-deep font-semibold">
          Autentifică-te
        </Link>
      </p>
    </AuthLayout>
  );
}
