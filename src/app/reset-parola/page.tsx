"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { Field, inputClass, Button } from "@/components/ui";
import { AuthLayout } from "@/components/AuthLayout";

export default function ResetParolaPage() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Citim token-ul din URL fără useSearchParams (evită cerința de Suspense la build).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- token citit din URL după montare (client-only)
    setToken(new URLSearchParams(window.location.search).get("token"));
    setReady(true);
  }, []);

  if (!ready) return <AuthLayout><p className="text-sm text-muted">Se încarcă...</p></AuthLayout>;
  return token ? <SetNewPassword token={token} /> : <RequestLink />;
}

// --- Pasul 1: cere link pe email ---
function RequestLink() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Eroare");
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare necunoscută");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display font-extrabold text-2xl text-ink mb-1">Ai uitat parola?</h1>
      <p className="text-sm text-muted mb-6">Îți trimitem un link de resetare pe email.</p>
      {sent ? (
        <div className="rounded-xl border border-line bg-mist p-4 text-sm text-ink">
          Dacă există un cont cu acest email, ți-am trimis un link de resetare. Verifică-ți inboxul (și folderul Spam).
          <div className="mt-4"><Link href="/login" className="text-aqua-deep font-display font-bold">← Înapoi la autentificare</Link></div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <Field label="Email">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="email@exemplu.ro" />
          </Field>
          {error && <p className="text-coral text-xs mt-2 mb-1">{error}</p>}
          <Button type="submit" className="w-full mt-4" disabled={busy}>{busy ? "Se trimite..." : "Trimite linkul de resetare"}</Button>
          <p className="text-center text-sm text-muted mt-4"><Link href="/login" className="text-aqua-deep font-display font-bold">Înapoi la autentificare</Link></p>
        </form>
      )}
    </AuthLayout>
  );
}

// --- Pasul 2: seteaza parola noua (cu token din email) ---
function SetNewPassword({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Parolele nu coincid."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Eroare");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare necunoscută");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display font-extrabold text-2xl text-ink mb-1">Setează o parolă nouă</h1>
      <p className="text-sm text-muted mb-6">Alege o parolă de minim 10 caractere, cu litere și cifre.</p>
      {done ? (
        <div className="rounded-xl border border-line bg-mist p-4 text-sm text-ink">
          Parola a fost schimbată cu succes. Te poți autentifica acum.
          <div className="mt-4"><Link href="/login" className="text-aqua-deep font-display font-bold">Mergi la autentificare →</Link></div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <Field label="Parolă nouă">
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="minim 10 caractere" />
          </Field>
          <Field label="Confirmă parola">
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} placeholder="repetă parola" />
          </Field>
          {error && <p className="text-coral text-xs mt-2 mb-1">{error}</p>}
          <Button type="submit" className="w-full mt-4" disabled={busy}>{busy ? "Se salvează..." : "Schimbă parola"}</Button>
          <p className="text-center text-sm text-muted mt-4"><Link href="/login" className="text-aqua-deep font-display font-bold">Înapoi la autentificare</Link></p>
        </form>
      )}
    </AuthLayout>
  );
}
