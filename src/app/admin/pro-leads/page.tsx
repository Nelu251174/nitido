"use client";
import { useEffect, useState } from "react";
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
  created_at: string;
};

export default function ProLeadsAdmin() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
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

  if (error) return <p className="p-8 text-coral">{error}</p>;
  if (!leads) return <p className="p-8 text-muted">Se încarcă…</p>;

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <p className="text-xs uppercase tracking-wide text-muted">NITIDO Pro</p>
      <h1 className="font-display font-extrabold text-3xl text-ink mt-2">Cereri client și partener</h1>
      <p className="text-muted mt-2">Lead-urile nu activează automat un cont. Verificare manuală.</p>
      <p className="mt-4"><Link href="/admin" className="text-aqua-deep">← Operațiuni</Link></p>
      <div className="mt-6 overflow-x-auto border border-line rounded-xl bg-white">
        <table className="w-full text-sm">
          <thead className="bg-mist text-muted">
            <tr>
              <th className="text-left px-3 py-2">Dată</th>
              <th className="text-left px-3 py-2">Tip</th>
              <th className="text-left px-3 py-2">Nume / firmă</th>
              <th className="text-left px-3 py-2">Contact</th>
              <th className="text-left px-3 py-2">Zonă</th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-t border-line align-top">
                <td className="px-3 py-2 whitespace-nowrap">{l.created_at}</td>
                <td className="px-3 py-2">{l.kind}</td>
                <td className="px-3 py-2">{l.contact_name}</td>
                <td className="px-3 py-2">{[l.contact_phone, l.contact_email].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-3 py-2">{l.city ?? "—"}</td>
                <td className="px-3 py-2">{l.status}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr><td className="px-3 py-6 text-muted" colSpan={6}>Nicio cerere încă.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
