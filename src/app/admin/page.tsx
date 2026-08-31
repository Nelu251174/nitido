"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Logo, Card, Button } from "@/components/ui";
import { JobRow } from "@/lib/types";

interface FirmRow {
  id: string;
  name: string;
  coverage_city: string;
  cui: string | null;
  rating_sum: number;
  rating_count: number;
  strikes_30d: number;
  strikes_90d: number;
  suspended_until: string | null;
  verified: number;
}

interface PaymentRow {
  id: string;
  job_id: string;
  amount_gross: number;
  commission_amount: number;
  amount_net: number;
  status: string;
  stripe_fee_amount: number|null;
  transfer_status: string;
  payout_status: string;
  refund_status: string;
  dispute_status: string;
}

interface NotificationRow {
  id: string;
  event_type: string;
  recipient_masked: string;
  status: string;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  channel?:string;
  platform?:string|null;
}
interface ProofRow { id:string; job_id:string; uploaded_by_firm_id:string; proof_type:"ARRIVAL"|"COMPLETION"; status:string; created_at:string; validated_at:string|null; url:string }
interface ReviewRow { id:string;job_id:string;firm_id:string;stars:number;comment:string|null;moderation_status:string;created_at:string;report_count:number;verified_job:number }

interface AdminStats {
  totalJobs: number;
  jobsToday: number;
  completedJobs: number;
  gmv: number;
  avgOrderValue: number;
  noShowRatePct: number;
  verifiedFirms: number;
  totalFirms: number;
  topFirms: { id: string; name: string; completedJobs: number }[];
}

export default function AdminPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [firms, setFirms] = useState<FirmRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [proofs, setProofs] = useState<ProofRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/overview");
    if (res.status === 401) {
      setAuthenticated(false);
      return;
    }
    const data = await res.json();
    setAuthenticated(true);
    setJobs(data.jobs);
    setFirms(data.firms);
    setPayments(data.payments);
    setNotifications(data.notifications ?? []);
    setProofs(data.proofs ?? []);
    setReviews(data.reviews ?? []);
    setStats(data.stats ?? null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prima citire + polling pe interval
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  async function triggerNoShow(jobId: string) {
    await fetch(`/api/jobs/${jobId}/no-show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repost: false }),
    });
    refresh();
  }
  async function moderateReview(id:string,status:"published"|"under_review"|"hidden") { await fetch(`/api/admin/reviews/${id}/moderate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})}); await refresh(); }

  const [recheckState, setRecheckState] = useState<Record<string, string>>({});

  async function recheckCui(firmId: string) {
    setRecheckState((s) => ({ ...s, [firmId]: "Se verifică..." }));
    try {
      const res = await fetch(`/api/admin/firms/${firmId}/recheck-cui`, { method: "POST" });
      const data = await res.json();
      setRecheckState((s) => ({
        ...s,
        [firmId]: data.verified
          ? `Verificată: ${data.name}`
          : data.message ?? "Tot neverificată",
      }));
    } catch {
      setRecheckState((s) => ({ ...s, [firmId]: "Eroare la reverificare" }));
    }
    refresh();
  }

  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  async function resetHistory() {
    if (!window.confirm("Ștergi permanent istoricul de activitate? Acțiunea nu poate fi anulată.")) return;

    setResetting(true);
    setResetMessage(null);
    try {
      const res = await fetch("/api/admin/reset-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Eroare la ștergere");
      setResetMessage(
        `Șters: ${data.jobs} lucrări, ${data.payments} plăți, ${data.demoFirmsRemoved} firme demo.`
      );
    } catch (e) {
      setResetMessage(e instanceof Error ? e.message : "Eroare necunoscută");
    } finally {
      setResetting(false);
      refresh();
    }
  }

  async function adminLogin(event: React.FormEvent) {
    event.preventDefault();
    setAuthError(null);
    const res = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const data = await res.json();
    if (!res.ok) return setAuthError(data.error ?? "Autentificare eșuată");
    setAdminPassword("");
    await refresh();
  }

  if (authenticated !== true) {
    return (
      <div className="min-h-screen mesh-light flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8">
          <Logo />
          <h1 className="font-display text-2xl font-bold mt-6">Administrare</h1>
          <form onSubmit={adminLogin} className="mt-6 space-y-4">
            <input className="w-full rounded-xl border border-line p-3" type="email" autoComplete="username" required value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="Email admin" />
            <input className="w-full rounded-xl border border-line p-3" type="password" autoComplete="current-password" required value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Parolă" />
            {authError && <p className="text-coral text-sm">{authError}</p>}
            <Button type="submit" className="w-full">Autentificare</Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen mesh-light">
      <header className="glass sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4 text-sm font-display font-bold text-muted">
            <Link href="/client" className="hover:text-ink">Client</Link>
            <Link href="/firma" className="hover:text-ink">Firmă</Link>
            <Link href="/incredere" className="hover:text-ink">Încredere &amp; Siguranță</Link>
            <button
              onClick={resetHistory}
              disabled={resetting}
              className="text-coral hover:text-white hover:bg-coral transition-colors border border-coral rounded-full px-3.5 py-1.5 text-xs font-semibold"
            >
              {resetting ? "Se șterge..." : "Golește tot istoricul"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {resetMessage && (
          <div className="bg-aqua/10 border border-aqua text-aqua-deep text-xs rounded-lg px-4 py-2.5 -mt-4">
            {resetMessage}
          </div>
        )}
        <p className="text-xs text-muted -mt-4">
          Panou minim de administrare / verificare — utilizat și pentru a demonstra fluxul de
          no-show (secțiunea 5b din spec), care în producție ar fi declanșat automat de un
          scheduler, nu manual.
        </p>

        {stats && (
          <section>
            <h2 className="font-display font-bold text-ink mb-3">Statistici</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatTile label="Lucrări azi" value={String(stats.jobsToday)} sub={`${stats.totalJobs} total`} />
              <StatTile
                label="Valoare tranzacționată"
                value={`${stats.gmv} lei`}
                sub={`${stats.completedJobs} finalizate`}
              />
              <StatTile
                label="Valoare medie / comandă"
                value={`${stats.avgOrderValue} lei`}
              />
              <StatTile
                label="Rată no-show"
                value={`${stats.noShowRatePct}%`}
                sub={`${stats.verifiedFirms}/${stats.totalFirms} firme verificate`}
              />
            </div>
            {stats.topFirms.length > 0 && (
              <div className="mt-3 bg-white border border-line rounded-xl p-4">
                <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-2">
                  Top firme (lucrări finalizate)
                </div>
                <div className="flex flex-wrap gap-2">
                  {stats.topFirms.map((f) => (
                    <span
                      key={f.id}
                      className="text-xs bg-mist px-2.5 py-1.5 rounded-lg text-ink font-semibold"
                    >
                      {f.name} — {f.completedJobs}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <section>
          <h2 className="font-display font-bold text-ink mb-3">Lucrări ({jobs.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs bg-white border border-line rounded-xl overflow-hidden">
              <thead className="bg-mist text-muted">
                <tr>
                  <th className="text-left px-3 py-2">Adresă</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Preț brut</th>
                  <th className="text-left px-3 py-2">Firmă</th>
                  <th className="text-left px-3 py-2">Acțiune</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-t border-line">
                    <td className="px-3 py-2">{j.street}, {j.city}</td>
                    <td className="px-3 py-2">{j.status}</td>
                    <td className="px-3 py-2">{j.price_gross} lei</td>
                    <td className="px-3 py-2">{j.accepted_firm_id ?? "—"}</td>
                    <td className="px-3 py-2">
                      {j.status === "accepted" && (
                        <Button variant="outline" onClick={() => triggerNoShow(j.id)}>
                          Marchează no-show
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="font-display font-bold text-ink mb-3">Dovezi foto operaționale</h2>
          <div className="overflow-x-auto"><table className="w-full text-xs bg-white border border-line rounded-xl overflow-hidden"><thead className="bg-mist text-muted"><tr><th className="text-left px-3 py-2">Job</th><th className="text-left px-3 py-2">Firmă</th><th className="text-left px-3 py-2">Tip</th><th className="text-left px-3 py-2">Status</th><th className="text-left px-3 py-2">Încărcată</th><th className="text-left px-3 py-2">Validată</th><th className="text-left px-3 py-2">Dovadă</th></tr></thead><tbody>{proofs.map(p=><tr key={p.id} className="border-t border-line"><td className="px-3 py-2">{p.job_id}</td><td className="px-3 py-2">{p.uploaded_by_firm_id}</td><td className="px-3 py-2">{p.proof_type}</td><td className="px-3 py-2">{p.status}</td><td className="px-3 py-2">{p.created_at}</td><td className="px-3 py-2">{p.validated_at ?? "—"}</td><td className="px-3 py-2"><a className="font-bold text-aqua-deep underline" href={p.url} target="_blank" rel="noreferrer">Vezi fotografia</a></td></tr>)}</tbody></table></div>
        </section>

        <section><h2 className="font-display font-bold text-ink mb-3">Moderare recenzii</h2><div className="space-y-3">{reviews.map(review=><Card key={review.id}><div className="flex flex-wrap justify-between gap-3"><div><b>{review.stars} / 5 · Lucrare verificată</b><p className="text-xs text-muted">Job {review.job_id} · Firmă {review.firm_id} · {review.report_count} raportări</p></div><span className="text-xs font-bold text-aqua-deep">{review.moderation_status}</span></div>{review.comment&&<p className="mt-3 text-sm text-muted">{review.comment}</p>}<div className="mt-3 flex gap-2"><Button variant="outline" onClick={()=>moderateReview(review.id,"published")}>Publică/restaurează</Button><Button variant="outline" onClick={()=>moderateReview(review.id,"under_review")}>Analizează</Button><Button variant="outline" onClick={()=>moderateReview(review.id,"hidden")}>Ascunde</Button></div></Card>)}{reviews.length===0&&<p className="text-sm text-muted">Nu există recenzii.</p>}</div></section>

        <section>
          <h2 className="font-display font-bold text-ink mb-3">Firme</h2>
          <div className="grid md:grid-cols-3 gap-3">
            {firms.map((f) => (
              <Card key={f.id}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="font-display font-bold text-sm">{f.name}</div>
                  {f.verified ? (
                    <span className="text-[10px] font-display font-bold text-aqua-deep bg-aqua/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                      ✓ Verificată
                    </span>
                  ) : (
                    <span className="text-[10px] font-display font-bold text-coral bg-coral/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                      Neverificată
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted mb-1">{f.coverage_city}</div>
                <div className="text-xs text-muted mb-2">CUI: {f.cui ?? "—"}</div>
                <div className="text-xs">
                  ⭐ {f.rating_count > 0 ? (f.rating_sum / f.rating_count).toFixed(1) : "—"} (
                  {f.rating_count} recenzii)
                </div>
                <div className="text-xs text-muted">
                  Strike-uri: {f.strikes_30d} (30z) / {f.strikes_90d} (90z)
                </div>
                {f.suspended_until && (
                  <div className="text-xs text-coral font-semibold mt-1">
                    Suspendată până la {new Date(f.suspended_until).toLocaleDateString("ro-RO")}
                  </div>
                )}
                {!f.verified && (
                  <div className="mt-3">
                    <Button variant="outline" onClick={() => recheckCui(f.id)}>
                      Reverifică la ANAF
                    </Button>
                    {recheckState[f.id] && (
                      <p className="text-[11px] text-muted mt-1">{recheckState[f.id]}</p>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display font-bold text-ink mb-3">Plăți</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs bg-white border border-line rounded-xl overflow-hidden">
              <thead className="bg-mist text-muted">
                <tr>
                  <th className="text-left px-3 py-2">Job</th>
                  <th className="text-left px-3 py-2">Brut</th>
                  <th className="text-left px-3 py-2">Comision</th>
                  <th className="text-left px-3 py-2">Net firmă</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Taxă Stripe</th>
                  <th className="text-left px-3 py-2">Transfer</th>
                  <th className="text-left px-3 py-2">Payout</th>
                  <th className="text-left px-3 py-2">Refund / dispută</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="px-3 py-2">{p.job_id}</td>
                    <td className="px-3 py-2">{p.amount_gross} lei</td>
                    <td className="px-3 py-2">{p.commission_amount} lei</td>
                    <td className="px-3 py-2">{p.amount_net} lei</td>
                    <td className="px-3 py-2">{p.status}</td>
                    <td className="px-3 py-2">{p.stripe_fee_amount == null ? "Necunoscută" : `${(p.stripe_fee_amount/100).toFixed(2)} lei`}</td>
                    <td className="px-3 py-2">{p.transfer_status}</td>
                    <td className="px-3 py-2">{p.payout_status}</td>
                    <td className="px-3 py-2">{p.refund_status} / {p.dispute_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2 className="font-display font-bold text-ink mb-3">Notificări SMS</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs bg-white border border-line rounded-xl overflow-hidden">
              <thead className="bg-mist text-muted"><tr><th className="text-left px-3 py-2">Eveniment</th><th className="text-left px-3 py-2">Canal</th><th className="text-left px-3 py-2">Destinatar</th><th className="text-left px-3 py-2">Status</th><th className="text-left px-3 py-2">Încercări</th><th className="text-left px-3 py-2">Creat</th><th className="text-left px-3 py-2">Diagnostic</th></tr></thead>
              <tbody>{notifications.map((n)=><tr key={n.id} className="border-t border-line"><td className="px-3 py-2">{n.event_type}</td><td className="px-3 py-2">{n.channel}{n.platform?` · ${n.platform}`:""}</td><td className="px-3 py-2">{n.recipient_masked}</td><td className="px-3 py-2">{n.status}</td><td className="px-3 py-2">{n.attempt_count}</td><td className="px-3 py-2">{n.created_at}</td><td className="px-3 py-2">{n.last_error ?? "—"}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-line rounded-xl p-4">
      <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold">{label}</div>
      <div className="font-display font-extrabold text-xl text-ink">{value}</div>
      {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}
