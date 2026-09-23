"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Lead = {
  id: string;
  kind: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  city: string | null;
  status: string;
  payload_json: string;
  review_note: string | null;
  created_at: string;
};

export default function ProLeadsAdmin() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/pro-leads")
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/admin";
          return;
        }
        const data = await res.json();
        setLeads(data.leads ?? []);
      })
      .catch(() => setError("Nu am putut încărca lead-urile."));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(id: string, action: string) {
    setBusy(id + action);
    const res = await fetch("/api/admin/pro-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Acțiune eșuată");
    }
    setBusy(null);
    load();
  }

  if (!leads) return <p className="p-8 text-muted">Se încarcă…</p>;

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <p className="text-xs uppercase tracking-wide text-muted">NITIDO Pro</p>
      <h1 className="font-display font-extrabold text-3xl text-ink mt-2">Verificare cereri</h1>
      <p className="text-muted mt-2">Nicio cerere nu devine activă singură. Email intern pornește doar dacă Resend e configurat.</p>
      <p className="mt-4"><Link href="/admin" className="text-aqua-deep">← Operațiuni</Link></p>
      {error && <p className="text-coral text-sm mt-4">{error}</p>}
      <div className="mt-6 overflow-x-auto border border-line rounded-xl bg-white">
        <table className="w-full text-sm">
          <thead className="bg-mist text-muted">
            <tr>
              <th className="text-left px-3 py-2">Dată</th>
              <th className="text-left px-3 py-2">Tip</th>
              <th className="text-left px-3 py-2">Contact</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-t border-line align-top">
                <td className="px-3 py-2 whitespace-nowrap">{l.created_at}</td>
                <td className="px-3 py-2">{l.kind}<div className="text-xs text-muted">{l.city}</div></td>
                <td className="px-3 py-2">
                  <div>{l.contact_name}</div>
                  <div className="text-xs text-muted">{[l.contact_phone, l.contact_email].filter(Boolean).join(" · ")}</div>
                  {l.review_note && <div className="text-xs mt-1">{l.review_note}</div>}
                </td>
                <td className="px-3 py-2">{l.status}</td>
                <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                  <button disabled={busy!==null} className="underline" onClick={() => act(l.id, "in_review")}>În verificare</button>
                  <button disabled={busy!==null} className="underline" onClick={() => act(l.id, "qualified")}>Calificat</button>
                  <button disabled={busy!==null} className="underline" onClick={() => act(l.id, "rejected")}>Respinge</button>
                  {l.kind === "partner" && (
                    <button disabled={busy!==null} className="underline font-semibold" onClick={() => act(l.id, "activate_partner")}>Activează condiționat</button>
                  )}
                </td>
              </tr>
            ))}
            {leads.length === 0 && <tr><td className="px-3 py-6 text-muted" colSpan={5}>Nicio cerere încă.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
