"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Field, inputClass, Button } from "@/components/ui";
import { AuthLayout } from "@/components/AuthLayout";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<"client" | "firma">("client");
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
      router.push(data.role === "client" ? "/client" : "/firma");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare necunoscută");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display font-extrabold text-2xl text-ink mb-1">Autentificare</h1>
      <p className="text-sm text-muted mb-6">Alege tipul de cont și intră.</p>

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
          <Link href="/reset-parola" className="text-xs text-aqua-deep font-semibold">
            Am uitat parola
          </Link>
        </div>

        {error && <p className="text-coral text-xs mb-3">{error}</p>}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Se autentifică..." : "Autentificare"}
        </Button>
      </form>

      <p className="text-xs text-muted text-center mt-5">
        Nu ai cont?{" "}
        <Link href="/signup" className="text-aqua-deep font-semibold">
          Creează unul
        </Link>
      </p>
    </AuthLayout>
  );
}
