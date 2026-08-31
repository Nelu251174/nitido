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
  const [uploadingProof, setUploadingProof] = useState<string | null>(null);
  const [trustProfile, setTrustProfile] = useState<{firms:{average_rating:number|null;review_count:number;completed_jobs:number;verified:number}[];reviews:{id:string;rating:number;reviewText:string|null;reviewer:string;badge:string}[]}>({firms:[],reviews:[]});
  const [reportReasons,setReportReasons]=useState<Record<string,string>>({});

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== "firma") router.replace("/login");
  }, [loading, user, router]);

  const refresh = useCallback(async () => {
    if (!firm) return;
    const [waitingRes, allRes, trustRes] = await Promise.all([
      fetch(`/api/jobs?status=waiting`),
      fetch(`/api/jobs`),
      fetch(`/api/trust?firmId=${encodeURIComponent(firm.id)}`),
    ]);
    const waitingData = await waitingRes.json();
    const allData = await allRes.json();
    if(trustRes.ok) setTrustProfile(await trustRes.json());
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
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Nu s-a putut accepta lucrarea");
    }
    refresh();
  }

  async function markArrived(jobId: string) {
    setMessage(null);
    const res = await fetch(`/api/jobs/${jobId}/arrived`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) setMessage(data.error ?? "Nu s-a putut confirma sosirea");
    await refresh();
  }

  async function markComplete(jobId: string) {
    setMessage(null);
    const res = await fetch(`/api/jobs/${jobId}/complete`, { method: "POST" });
    const data = await res.json();
    setMessage(res.ok ? "Lucrarea a fost finalizată. Plata a fost eliberată în platforma NITIDO." : data.error ?? "Nu s-a putut finaliza lucrarea");
    await refresh();
  }

  async function uploadProof(jobId: string, proofType: "ARRIVAL" | "COMPLETION", file?: File) {
    if (!file) return;
    setMessage(null); setUploadingProof(`${jobId}:${proofType}`);
    const form = new FormData(); form.set("file", file); form.set("jobId", jobId); form.set("proofType", proofType);
    const res = await fetch("/api/uploads", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) setMessage(data.error ?? "Fotografia nu a putut fi încărcată");
    await refresh(); setUploadingProof(null);
  }
  async function reportReview(reviewId:string){const reason=reportReasons[reviewId]||"alt_motiv";const res=await fetch(`/api/reviews/${reviewId}/report`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reason})});const data=await res.json();setMessage(res.ok?"Recenzia a fost raportată pentru analiză.":data.error??"Raportarea nu a putut fi trimisă");}
  async function startStripeOnboarding(){
    setMessage(null);const res=await fetch("/api/stripe/connect/onboarding",{method:"POST"});const data=await res.json();
    if(!res.ok)return setMessage(data.error??"Conectarea contului Stripe nu este disponibilă");
    window.location.assign(data.url);
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
            <Link href="/incredere" className="text-sm font-display font-bold text-muted hover:text-ink">Încredere &amp; Siguranță</Link>
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
                <div className="text-xs text-muted mb-2">Adresa exactă devine vizibilă după acceptare.</div>
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
                <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold">
                  Valoare lucrare: {job.price_gross} lei
                </div>
                <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold mt-1">Tu încasezi</div>
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
                {(() => { const hasArrival=job.proofs?.some(p=>p.type==="ARRIVAL")??false; const hasCompletion=job.proofs?.some(p=>p.type==="COMPLETION")??false; return <>
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
                  <div className="space-y-3"><div className="rounded-xl border border-line bg-mist p-4"><div className="flex justify-between gap-3 text-sm font-bold"><span>Fotografie la sosire · OBLIGATORIU</span><span className={hasArrival?"text-aqua-deep":"text-coral"}>{hasArrival?"Încărcată":"Lipsă"}</span></div><label className="mt-3 block cursor-pointer rounded-lg border border-line bg-white px-4 py-2 text-center text-sm font-bold">{uploadingProof===`${job.id}:ARRIVAL`?"Se încarcă…":"Încarcă fotografie la sosire"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={Boolean(uploadingProof)} onChange={e=>void uploadProof(job.id,"ARRIVAL",e.target.files?.[0])}/></label></div><Button disabled={!hasArrival} className="w-full disabled:cursor-not-allowed disabled:opacity-50" onClick={() => markArrived(job.id)}>Am ajuns / Începe lucrarea</Button></div>
                )}
                {job.status === "arrived" && (
                  <div className="space-y-3"><div className="rounded-xl border border-line bg-mist p-4"><div className="flex justify-between gap-3 text-sm font-bold"><span>Fotografie la finalizare · OBLIGATORIU</span><span className={hasCompletion?"text-aqua-deep":"text-coral"}>{hasCompletion?"Încărcată":"Lipsă"}</span></div><label className="mt-3 block cursor-pointer rounded-lg border border-line bg-white px-4 py-2 text-center text-sm font-bold">{uploadingProof===`${job.id}:COMPLETION`?"Se încarcă…":"Încarcă fotografia finală"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={Boolean(uploadingProof)} onChange={e=>void uploadProof(job.id,"COMPLETION",e.target.files?.[0])}/></label></div><p className="text-xs leading-5 text-muted">Plata este blocată până la finalizarea corectă a lucrării. Pentru eliberarea plății este obligatorie fotografia de finalizare.</p><Button disabled={!hasCompletion} className="w-full disabled:cursor-not-allowed disabled:opacity-50" onClick={() => markComplete(job.id)}>Finalizează lucrarea</Button></div>
                )}
                </>})()}
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

        <section className="rounded-2xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display font-bold text-ink">Încasări prin Stripe</h2><p className="mt-1 text-xs leading-5 text-muted">Conectează contul firmei prin onboarding-ul găzduit de Stripe. Transferurile reale rămân inactive până la aprobarea NITIDO.</p></div><Button variant="outline" onClick={startStripeOnboarding}>Configurează încasările</Button></div>
        </section>

        <section><h2 className="font-display font-bold text-ink mb-3">Reputația firmei</h2><Card>{trustProfile.firms[0]?<><div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1"><div><b className="text-2xl">{trustProfile.firms[0].average_rating?Number(trustProfile.firms[0].average_rating).toFixed(1):"—"} / 5</b><p className="text-xs text-muted">{trustProfile.firms[0].review_count} recenzii verificate</p></div><div><b className="text-2xl">{trustProfile.firms[0].completed_jobs}</b><p className="text-xs text-muted">lucrări finalizate</p></div><div><b className="text-sm text-aqua-deep">{trustProfile.firms[0].verified?"Firmă verificată":"Verificare în curs"}</b></div></div>{trustProfile.reviews.length?<div className="mt-5 space-y-3">{trustProfile.reviews.map(review=><article key={review.id} className="rounded-xl bg-mist p-4"><div className="flex justify-between text-sm"><b>{review.rating} / 5 · {review.reviewer}</b><span className="text-aqua-deep">{review.badge}</span></div>{review.reviewText&&<p className="mt-2 text-sm text-muted">{review.reviewText}</p>}<div className="mt-3 flex gap-2"><select aria-label="Motiv raportare" className="rounded-lg border border-line bg-white px-2 py-1 text-xs" value={reportReasons[review.id]||"alt_motiv"} onChange={e=>setReportReasons(current=>({...current,[review.id]:e.target.value}))}><option value="limbaj_abuziv">Limbaj abuziv</option><option value="date_personale">Date personale</option><option value="spam">Spam</option><option value="informatii_false">Informații false</option><option value="alt_motiv">Alt motiv</option></select><button type="button" className="text-xs font-bold text-coral" onClick={()=>void reportReview(review.id)}>Raportează</button></div></article>)}</div>:<p className="mt-4 text-sm text-muted">Încă nu există suficiente evaluări.</p>}</>:<p className="text-sm text-muted">Încă nu există suficiente evaluări.</p>}</Card></section>

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
