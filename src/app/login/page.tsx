"use client";

import {UiText} from '@/components/UiText';
import { useState, Suspense, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Field, inputClass, Button } from "@/components/ui";
import { AuthLayout } from "@/components/AuthLayout";
import {postAuthDestination,authSwitchHref} from "@/lib/authRedirect";

export default function LoginPage() {return <Suspense fallback={<p role="status"><UiText text={"Se încarcă…"}/></p>}><LoginForm/></Suspense>}

function LoginForm() {
  const router = useRouter();
  const searchParams=useSearchParams();
  const [role, setRole] = useState<"client" | "firma">(searchParams.get("role")==="firma"?"firma":"client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Eroare la autentificare");
      router.push(postAuthDestination(searchParams.get("next"),data.role==="firma"?"firma":"client"));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare necunoscută");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display font-extrabold text-2xl text-ink mb-1"><UiText text={"Autentificare"}/></h1>
      <p className="text-sm text-muted mb-6"><UiText text={"Alege tipul de cont și intră."}/></p>

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

        <div className="flex justify-end -mt-1 mb-3">
          <Link href="/reset-parola" className="text-xs text-aqua-deep font-semibold"><UiText text={"Am uitat parola"}/></Link>
        </div>

        {error && <p className="text-coral text-xs mb-3">{<UiText text={error}/>}</p>}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? <UiText text={"Se autentifică..."}/> : <UiText text={"Autentificare"}/>}
        </Button>
      </form>

      <p className="text-xs text-muted text-center mt-5"><UiText text={"Nu ai cont?"}/>{" "}
        <Link href={authSwitchHref("signup",searchParams.get("next"),role)} className="text-aqua-deep font-semibold"><UiText text={"Creează unul"}/></Link>
      </p>
    </AuthLayout>
  );
}
