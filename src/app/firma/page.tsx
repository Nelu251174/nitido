"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo, Card, Button } from "@/components/ui";
import { calcNetForFirm } from "@/lib/pricing";
import { mapsDirectionsUrl } from "@/lib/maps";
import { JobRow } from "@/lib/types";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function FirmaPage() {
  const router = useRouter();
  const { user, firm, loading } = useCurrentUser();
  const [waitingJobs, setWaitingJobs] = useState<JobRow[]>([]);
  const [myJobs, setMyJobs] = useState<JobRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== "firma") router.replace("/login");
  }, [loading, user, router]);

  const refresh = useCallback(async () => {
    if (!firm) return;
    const [waitingRes, allRes] = await Promise.all([
      fetch(`/api/jobs?status=waiting&firmId=${encodeURIComponent(firm.id)}`),
      fetch(`/api/jobs`),
    ]);
    const waitingData = await waitingRes.json();
    const allData = await allRes.json();
    setWaitingJobs(waitingData.jobs);
    setMyJobs(
      (allData.jobs as JobRow[]).filter(
        (j) => j.accepted_firm_id === firm.id && j.status !== "no_show"
      )
    );
  }, [firm]);

  useEffect(() => {
    if (!firm) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prima citire + polling pe interval
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [firm, refresh]);

  async function accept(jobId: string) {
    if (!firm) return;
    setMessage(null);
    const res = await fetch(`/api/jobs/${jobId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firmId: firm.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Nu s-a putut accepta lucrarea");
    }
    refresh();
  }

  async function markArrived(jobId: string) {
    await fetch(`/api/jobs/${jobId}/arrived`, { method: "POST" });
    refresh();
  }

  async function markComplete(jobId: string) {
    await fetch(`/api/jobs/${jobId}/complete`, { method: "POST" });
    refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (loading || !user || user.role !== "firma") {
    return (
      <div className="min-h-screen bg-mist flex items-center justify-center text-muted text-sm">
        Se încarcă...
      </div>
    );
  }

  const activeJobs = myJobs.filter((j) => ["accepted", "arrived"].includes(j.status));
  const historyJobs = myJobs.filter((j) => ["completed"].includes(j.status));

  const now = new Date();
  const earningsTotal = historyJobs.reduce((sum, j) => sum + calcNetForFirm(j.price_gross), 0);
  const earningsThisMonth = historyJobs
    .filter((j) => {
      const d = new Date(j.completed_at ?? j.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, j) => sum + calcNetForFirm(j.price_gross), 0);

  return (
    <div className="min-h-screen mesh-light">
      <header className="glass sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted">
              <b className="text-ink">{user.name}</b> — {firm?.coverage_city}
              {firm?.coverage_cities_extra ? ` + ${firm.coverage_cities_extra}` : ""}
            </span>
            <Link href="/" className="text-sm font-display font-bold text-muted hover:text-ink">
              Vezi site-ul public →
            </Link>
            <button onClick={logout} className="text-sm text-muted hover:text-coral">
              Ieși din cont
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {message && (
          <div className="bg-coral/10 border border-coral text-coral text-sm rounded-lg px-4 py-2.5">
            {message}
          </div>
        )}

        <section>
          <h2 className="font-display font-bold text-ink mb-3">Alerte noi</h2>
          {waitingJobs.length === 0 && (
            <Card>
              <p className="text-sm text-muted">
                Nicio alertă activă. Când un client postează o lucrare în{" "}
                {firm?.coverage_city ?? "zona ta"}, apare aici instant.
              </p>
            </Card>
          )}
          <div className="space-y-3">
            {waitingJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white border-2 border-coral rounded-2xl p-4 relative"
              >
                <span className="inline-block bg-coral text-white text-[10px] font-display font-bold px-2.5 py-1 rounded-full mb-2">
                  🔔 LUCRARE NOUĂ
                </span>
                <div className="font-display font-bold text-sm text-ink">
                  Curățenie {job.space_type}, {job.city}
                </div>
                <div className="text-xs text-muted mb-2 flex flex-wrap items-center gap-x-1.5">
                  <span>
                    {job.street}
                    {job.postal_code ? `, cod poștal ${job.postal_code}` : ""}
                    {job.floor ? `, etaj ${job.floor}` : ""}
                  </span>
                  <a
                    href={mapsDirectionsUrl(job)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-aqua-deep font-semibold underline underline-offset-2 whitespace-nowrap"
                  >
                    📍 vezi distanța pe hartă
                  </a>
                </div>
                <div className="flex gap-2 flex-wrap mb-2">
                  <span className="text-[11px] bg-mist px-2 py-1 rounded-md">{job.sqm} mp</span>
                  <span className="text-[11px] bg-mist px-2 py-1 rounded-md">{job.space_type}</span>
                  {job.scheduled_at && (
                    <span className="text-[11px] bg-mist px-2 py-1 rounded-md">
                      {new Date(job.scheduled_at).toLocaleString("ro-RO", {
                        weekday: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
                {job.photos && job.photos.length > 0 && (
                  <div className="flex gap-1.5 mb-2">
                    {job.photos.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={url}
                        alt="Poză lucrare"
                        className="w-12 h-12 rounded-lg object-cover border border-line"
                      />
                    ))}
                  </div>
                )}
                <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold">
                  Tu primești
                </div>
                <div className="font-display font-extrabold text-lg text-aqua-deep mb-3">
                  {calcNetForFirm(job.price_gross)} lei
                </div>
                <Button className="w-full" onClick={() => accept(job.id)}>
                  Accept lucrarea
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display font-bold text-ink mb-3">Lucrări active</h2>
          {activeJobs.length === 0 && (
            <p className="text-sm text-muted">Nicio lucrare activă momentan.</p>
          )}
          <div className="space-y-3">
            {activeJobs.map((job) => (
              <Card key={job.id}>
                <a
                  href={mapsDirectionsUrl(job)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-display font-bold text-sm text-ink mb-1 flex items-center gap-1.5 hover:text-aqua-deep transition-colors"
                >
                  <span className="underline decoration-dotted underline-offset-2">
                    {job.street}, {job.city}
                  </span>
                  <span className="text-aqua-deep text-[11px] font-semibold whitespace-nowrap">
                    📍 vezi traseul →
                  </span>
                </a>
                <div className="text-[11px] text-muted mb-3">
                  Se deschide în Google Maps — durată și distanță până la locație
                </div>
                <div className="text-xs text-muted mb-3">
                  {job.sqm} mp · {calcNetForFirm(job.price_gross)} lei · status: {job.status}
                </div>
                {job.status === "accepted" && (
                  <Button className="w-full" onClick={() => markArrived(job.id)}>
                    Am ajuns / Lucrare începută
                  </Button>
                )}
                {job.status === "arrived" && (
                  <Button className="w-full" onClick={() => markComplete(job.id)}>
                    Finalizează lucrarea
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </section>

        {historyJobs.length > 0 && (
          <section className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-line rounded-2xl p-4">
              <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold">
                Câștiguri luna aceasta
              </div>
              <div className="font-display font-extrabold text-2xl text-aqua-deep">
                {earningsThisMonth} lei
              </div>
            </div>
            <div className="bg-white border border-line rounded-2xl p-4">
              <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold">
                Câștiguri totale
              </div>
              <div className="font-display font-extrabold text-2xl text-ink">
                {earningsTotal} lei
              </div>
              <div className="text-[11px] text-muted mt-0.5">{historyJobs.length} lucrări finalizate</div>
            </div>
          </section>
        )}

        {historyJobs.length > 0 && (
          <section>
            <h2 className="font-display font-bold text-ink mb-3">Istoric</h2>
            <div className="space-y-2">
              {historyJobs.map((job) => (
                <div key={job.id} className="text-sm text-muted bg-white border border-line rounded-lg px-4 py-2.5">
                  {job.street}, {job.city} — finalizată
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
