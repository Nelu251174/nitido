"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {BoardSidebar} from "@/components/BoardSidebar";
import {FirmSummary} from "@/components/FirmSummary";
import { Logo, Card, Button, inputClass } from "@/components/ui";
import { calcNetForFirm } from "@/lib/pricing";
import { mapsDirectionsUrl } from "@/lib/maps";
import { JobRow } from "@/lib/types";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { AppRatingCard } from "@/components/AppRatingCard";

// Buton de acțiune uniform pentru antet/carduri: contur (linie) + schimbare de
// culoare la hover. Toate butoanele „text" folosesc același stil.
const ACTION_BTN =
  "inline-flex items-center rounded-full border border-line px-3.5 py-1.5 text-sm font-display font-bold text-ink transition-colors duration-150 hover:border-aqua hover:text-aqua-deep hover:bg-aqua/5";

export default function FirmaPage() {
  const router = useRouter();
  const { user, firm, loading } = useCurrentUser();
  const [waitingJobs, setWaitingJobs] = useState<JobRow[]>([]);
  const [myJobs, setMyJobs] = useState<JobRow[]>([]);
  const [offeredJobIds, setOfferedJobIds] = useState<string[]>([]);
  const [offerMsgs, setOfferMsgs] = useState<Record<string, string>>({});
  const [filter,setFilter]=useState("all");
  const [search,setSearch]=useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [settlingJob,setSettlingJob]=useState<string|null>(null);
  const [uploadingProof, setUploadingProof] = useState<string | null>(null);
  const [trustProfile, setTrustProfile] = useState<{firms:{average_rating:number|null;review_count:number;completed_jobs:number;verified:number}[];reviews:{id:string;rating:number;reviewText:string|null;reviewer:string;badge:string}[]}>({firms:[],reviews:[]});
  const [quality, setQuality] = useState<{score:number;rating:number;experience:number;reliability:number}|null>(null);
  const [reportReasons,setReportReasons]=useState<Record<string,string>>({});
  const [editingProfile,setEditingProfile]=useState(false);
  const [savingProfile,setSavingProfile]=useState(false);
  const [profileForm,setProfileForm]=useState({name:"",phone:"",coverageCity:"",coverageCitiesExtra:"",description:"",workingHours:"",services:"",website:""});

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== "firma") router.replace("/login");
  }, [loading, user, router]);

  async function openProfileEditor(){
    setMessage(null);
    try{
      const res=await fetch("/api/account/firm");
      const d=await res.json();
      if(!res.ok){setMessage(d.error??"Nu s-a putut încărca profilul");return;}
      setProfileForm({name:d.name??"",phone:d.phone??"",coverageCity:d.coverageCity??"",coverageCitiesExtra:d.coverageCitiesExtra??"",description:d.description??"",workingHours:d.workingHours??"",services:d.services??"",website:d.website??""});
      setEditingProfile(true);
      setTimeout(()=>{const editor=document.getElementById("firm-profile-editor");editor?.scrollIntoView({behavior:"smooth",block:"start"});editor?.querySelector("input")?.focus({preventScroll:true});},60);
    }catch{setMessage("Nu s-a putut încărca profilul");}
  }

  async function saveProfile(){
    setSavingProfile(true);setMessage(null);
    try{
      const res=await fetch("/api/account/firm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(profileForm)});
      const d=await res.json();
      if(!res.ok){setMessage(d.error??"Nu s-au putut salva modificările");setSavingProfile(false);return;}
      // Reîncărcăm pagina ca antetul (nume + oraș) să reflecte imediat modificările.
      window.location.reload();
    }catch{setMessage("Nu s-au putut salva modificările");setSavingProfile(false);}
  }

  const refresh = useCallback(async () => {
    if (!firm) return;
    const [waitingRes, allRes, trustRes, qualRes] = await Promise.all([
      fetch(`/api/jobs?status=waiting`),
      fetch(`/api/jobs`),
      fetch(`/api/trust?firmId=${encodeURIComponent(firm.id)}`),
      fetch(`/api/firm/quality`),
    ]);
    const waitingData = await waitingRes.json();
    const allData = await allRes.json();
    if(trustRes.ok) setTrustProfile(await trustRes.json());
    if(qualRes.ok) setQuality((await qualRes.json()).quality);
    setWaitingJobs(waitingData.jobs);
    setOfferedJobIds(waitingData.offeredJobIds ?? []);
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

  async function sendOffer(jobId: string, message: string) {
    if (!firm) return;
    setMessage(null);
    const res = await fetch(`/api/jobs/${jobId}/offers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    setMessage(res.ok ? "Ofertă trimisă! Clientul alege dintre firmele care au ofertat." : data.error ?? "Nu s-a putut trimite oferta");
    await refresh();
  }

  async function cancelJob(jobId: string) {
    setMessage(null);
    if (typeof window !== "undefined" && !window.confirm("Sigur renunți la lucrare? Va fi repusă automat pentru altă firmă.")) return;
    const res = await fetch(`/api/jobs/${jobId}/cancel`, { method: "POST" });
    const data = await res.json();
    setMessage(res.ok ? "Ai renunțat la lucrare. Am repus-o automat pentru altă firmă (Job Rescue)." : data.error ?? "Nu s-a putut renunța la lucrare");
    await refresh();
  }

  async function markArrived(jobId: string) {
    setMessage(null);
    const res = await fetch(`/api/jobs/${jobId}/arrived`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) setMessage(data.error ?? "Nu s-a putut confirma sosirea");
    await refresh();
  }

  async function markComplete(jobId: string) {
    if(settlingJob)return;
    setMessage(null);setSettlingJob(jobId);
    try{
      const res = await fetch(`/api/jobs/${jobId}/complete`, { method: "POST" });
      const data = await res.json();
      setMessage(res.ok ? "Finalizarea este confirmată. Starea plății a fost actualizată." : data.error ?? "Nu s-a putut finaliza lucrarea");
      await refresh();
    }catch{setMessage("Conexiunea s-a întrerupt. Reîncarcă lista și verifică starea plății înainte să reîncerci.");}
    finally{setSettlingJob(null);}
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
    <div className="board-page board-firm"><BoardSidebar role="firma"/>
      <header className="glass sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-3 max-[760px]:px-4">
          <Logo />
          <div className="flex flex-wrap items-center gap-2 max-[760px]:w-full">
            <span className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aqua-deep text-sm font-display font-extrabold text-white" aria-hidden="true">{user.name.trim().slice(0,1).toUpperCase()}</span>
              <span className="text-sm leading-tight">
                <span className="flex items-center gap-1.5"><b className="text-ink">{user.name}</b>{firm?.verified?<span className="inline-flex items-center gap-1 rounded-full bg-aqua/15 px-2 py-0.5 text-[10px] font-bold text-aqua-deep">✓ Verificată</span>:<span className="inline-flex items-center rounded-full bg-mist px-2 py-0.5 text-[10px] font-bold text-muted">Verificare în curs</span>}</span>
                <span className="block text-xs text-muted">{firm?.coverage_city}{firm?.coverage_cities_extra ? ` + ${firm.coverage_cities_extra}` : ""}</span>
              </span>
            </span>
            <button type="button" onClick={openProfileEditor} className={ACTION_BTN}>
              Editează profilul
            </button>
            <Link href="/" className={ACTION_BTN}>
              Vezi site-ul public →
            </Link>
            <Link href="/incredere" className={ACTION_BTN}>Încredere &amp; Siguranță</Link>
            <button onClick={logout} className="inline-flex items-center rounded-full border border-line px-3.5 py-1.5 text-sm font-display font-bold text-muted transition-colors duration-150 hover:border-coral hover:text-coral hover:bg-coral/5">
              Ieși din cont
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        <header className="section-heading"><div><p className="v2-eyebrow">NITIDO PARTENER</p><h1 className="workspace-title">Lucrări potrivite pentru echipa ta</h1><p className="text-muted">Aplică la oportunități și organizează-ți activitatea cu NITIDO.RO.</p></div><Link className="v2-btn v2-btn-primary" href="/firma/calendar">Deschide calendarul ↗</Link></header>
        <section className="workspace-metrics"><Card><p className="text-sm text-muted">Oportunități în zonă</p><b className="text-3xl">{waitingJobs.length}</b></Card><Card><p className="text-sm text-muted">Lucrări active</p><b className="text-3xl">{activeJobs.length}</b></Card><Card><p className="text-sm text-muted">Lucrări finalizate</p><b className="text-3xl">{historyJobs.length}</b></Card></section>
        {message && (
          <div className="bg-coral/10 border border-coral text-coral text-sm rounded-lg px-4 py-2.5">
            {message}
          </div>
        )}

        {editingProfile && (
          <section id="firm-profile-editor" className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-display font-bold text-ink">Editează profilul firmei</h2>
              <button type="button" onClick={()=>setEditingProfile(false)} className="text-sm text-muted hover:text-coral">Anulează</button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="text-muted">Numele firmei</span>
                <input className={inputClass} value={profileForm.name} onChange={(e)=>setProfileForm(f=>({...f,name:e.target.value}))} />
              </label>
              <label className="block text-sm">
                <span className="text-muted">Telefon</span>
                <input className={inputClass} value={profileForm.phone} onChange={(e)=>setProfileForm(f=>({...f,phone:e.target.value}))} placeholder="07xx xxx xxx" />
              </label>
              <label className="block text-sm">
                <span className="text-muted">Oraș principal de acoperire</span>
                <input className={inputClass} value={profileForm.coverageCity} onChange={(e)=>setProfileForm(f=>({...f,coverageCity:e.target.value}))} />
              </label>
              <label className="block text-sm">
                <span className="text-muted">Orașe suplimentare (opțional, separate prin virgulă)</span>
                <input className={inputClass} value={profileForm.coverageCitiesExtra} onChange={(e)=>setProfileForm(f=>({...f,coverageCitiesExtra:e.target.value}))} placeholder="Ex: Mangalia, Năvodari" />
              </label>
              <label className="block text-sm">
                <span className="text-muted">Despre firmă (descriere scurtă)</span>
                <textarea className={`${inputClass} min-h-[90px]`} value={profileForm.description} onChange={(e)=>setProfileForm(f=>({...f,description:e.target.value}))} placeholder="Ex: Echipă cu experiență în curățenie rezidențială și birouri, produse profesionale, personal verificat." />
              </label>
              <label className="block text-sm">
                <span className="text-muted">Servicii oferite</span>
                <input className={inputClass} value={profileForm.services} onChange={(e)=>setProfileForm(f=>({...f,services:e.target.value}))} placeholder="Ex: Apartamente, birouri, după constructor, geamuri" />
              </label>
              <label className="block text-sm">
                <span className="text-muted">Program de lucru</span>
                <input className={inputClass} value={profileForm.workingHours} onChange={(e)=>setProfileForm(f=>({...f,workingHours:e.target.value}))} placeholder="Ex: Luni–Sâmbătă, 08:00–20:00" />
              </label>
              <label className="block text-sm">
                <span className="text-muted">Website (opțional)</span>
                <input className={inputClass} value={profileForm.website} onChange={(e)=>setProfileForm(f=>({...f,website:e.target.value}))} placeholder="Ex: www.firma-ta.ro" />
              </label>
              <p className="text-xs text-muted">CUI-ul firmei este verificat la ANAF și nu poate fi modificat de aici.</p>
              <div className="flex gap-2 pt-1">
                <Button onClick={saveProfile} disabled={savingProfile}>{savingProfile?"Se salvează...":"Salvează"}</Button>
                <Button variant="outline" onClick={()=>setEditingProfile(false)} disabled={savingProfile}>Renunță</Button>
              </div>
            </div>
          </section>
        )}

        <div className="firm-work-grid"><section className="firm-opportunities">
          <h2 className="font-display font-bold text-ink mb-3">Oportunități noi</h2><div className="workspace-toolbar"><input aria-label="Caută oportunități" className={inputClass} placeholder="Caută după oraș sau tip de spațiu" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Mod de alocare" className={inputClass} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Toate lucrările</option><option value="standard">Standard</option><option value="express">Express</option></select></div>
          {waitingJobs.length === 0 && (
            <Card>
              <p className="text-sm text-muted">
                Nicio alertă activă. Când un client postează o lucrare în{" "}
                {firm?.coverage_city ?? "zona ta"}, apare aici instant.
              </p>
            </Card>
          )}
          <div className="space-y-3">
            {waitingJobs.filter(j=>(filter==="all"||(j.mode??"express")===filter)&&`${j.city} ${j.space_type}`.toLowerCase().includes(search.toLowerCase())).map((job) => (
              <div
                key={job.id}
                className={`firm-opportunity-card bg-white rounded-2xl p-4 relative ${job.express_60 ? "border-2 border-coral ring-2 ring-coral/30" : "border border-line"}`}
              >
                {job.express_60 ? (
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="inline-block text-white text-[10px] font-display font-bold px-2.5 py-1 rounded-full bg-coral">
                      🔥 EXPRESS 60 — PRIORITATE MAXIMĂ
                    </span>
                    {job.express_60_deadline && (
                      <span className="text-[10.5px] font-display font-bold text-coral">
                        Preluare garantată până la{" "}
                        {new Date(job.express_60_deadline).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className={`inline-block text-white text-[10px] font-display font-bold px-2.5 py-1 rounded-full mb-2 ${job.mode === "standard" ? "bg-aqua-deep" : "bg-coral"}`}>
                    {job.mode === "standard" ? "✦ STANDARD" : "⚡ EXPRESS"}
                  </span>
                )}
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
                {job.scan && job.scan.length > 0 && (
                  <div className="mb-3">
                    <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-1.5">
                      📷 Nitido Scan · {job.scan.length} {job.scan.length === 1 ? "poză" : "poze"}
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {job.scan.map((s) => (
                        <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="w-16">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={s.url}
                            alt={`Context: ${s.roomLabel}`}
                            className="w-16 h-16 rounded-lg object-cover border border-line"
                          />
                          <span className="block text-[9px] text-muted text-center mt-0.5 leading-tight">
                            {s.roomLabel}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold">
                  Valoare lucrare: {job.price_gross} lei
                </div>
                <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold mt-1">Tu încasezi</div>
                <div className="font-display font-extrabold text-lg text-aqua-deep mb-3">
                  {calcNetForFirm(job.price_gross)} lei
                </div>
                {job.mode === "standard" ? (
                  offeredJobIds.includes(job.id) ? (
                    <div className="text-center text-sm font-display font-bold text-aqua-deep bg-aqua/10 rounded-lg py-2.5">
                      ✓ Candidatură trimisă — clientul alege
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        className={`${inputClass} min-h-16 resize-y text-sm`}
                        maxLength={500}
                        placeholder="Mesaj scurt pentru client (opțional): disponibilitate, experiență…"
                        value={offerMsgs[job.id] ?? ""}
                        onChange={(e) => setOfferMsgs((m) => ({ ...m, [job.id]: e.target.value }))}
                      />
                      <Button className="w-full" onClick={() => sendOffer(job.id, offerMsgs[job.id] ?? "")}>
                        Trimite candidatura
                      </Button>
                    </div>
                  )
                ) : (
                  <Button className="w-full" onClick={() => accept(job.id)}>
                    Accept lucrarea
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>

        <FirmSummary jobs={myJobs}/></div><section id="lucrari-active">
          <h2 className="font-display font-bold text-ink mb-3">Lucrări active</h2><Link href="/firma/executie" className="v2-btn v2-btn-primary mb-4">Fotografii la sosire / final și încasare</Link>
          {activeJobs.length === 0 && (
            <p className="text-sm text-muted">Nicio lucrare activă momentan.</p>
          )}
          <div className="space-y-3">
            {activeJobs.map((job) => (
              <Card key={job.id}>
                {(() => { const hasArrival=job.proofs?.some(p=>p.type==="ARRIVAL")??false; const hasCompletion=job.proofs?.some(p=>p.type==="COMPLETION")??false; return <>
                {job.guarantee_of && <span className="inline-block bg-[#a9781f] text-white text-[10px] font-display font-bold px-2.5 py-1 rounded-full mb-2">♻ RE-CURĂȚARE ÎN GARANȚIE · gratuită</span>}
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
                {job.details&&<section className="mb-3 rounded-lg border border-line p-3"><h3 className="font-bold text-sm">Instrucțiunile clientului</h3><p className="text-sm whitespace-pre-wrap break-words">{job.details}</p></section>}
                {job.status === "accepted" && (
                  <div className="space-y-3"><div className="rounded-xl border border-line bg-mist p-4"><div className="flex justify-between gap-3 text-sm font-bold"><span>Fotografie la sosire · OBLIGATORIU</span><span className={hasArrival?"text-aqua-deep":"text-coral"}>{hasArrival?"Încărcată":"Lipsă"}</span></div><label className="mt-3 block cursor-pointer rounded-lg border border-line bg-white px-4 py-2 text-center text-sm font-bold">{uploadingProof===`${job.id}:ARRIVAL`?"Se încarcă…":"Încarcă fotografie la sosire"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={Boolean(uploadingProof)} onChange={e=>void uploadProof(job.id,"ARRIVAL",e.target.files?.[0])}/></label></div><Button disabled={!hasArrival} className="w-full disabled:cursor-not-allowed disabled:opacity-50" onClick={() => markArrived(job.id)}>Am ajuns / Începe lucrarea</Button><button onClick={() => cancelJob(job.id)} className="w-full text-xs font-display font-bold text-coral py-1">Renunță la lucrare (o repunem pentru altă firmă)</button></div>
                )}
                {job.status === "arrived" && (
                  <div className="space-y-3"><div className="rounded-xl border border-line bg-mist p-4"><div className="flex justify-between gap-3 text-sm font-bold"><span>Fotografie la finalizare · OBLIGATORIU</span><span className={hasCompletion?"text-aqua-deep":"text-coral"}>{hasCompletion?"Încărcată":"Lipsă"}</span></div><label className="mt-3 block cursor-pointer rounded-lg border border-line bg-white px-4 py-2 text-center text-sm font-bold">{uploadingProof===`${job.id}:COMPLETION`?"Se încarcă…":"Încarcă fotografia finală"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={Boolean(uploadingProof)} onChange={e=>void uploadProof(job.id,"COMPLETION",e.target.files?.[0])}/></label></div><p className="text-xs leading-5 text-muted">Plata este blocată până la finalizarea corectă a lucrării. Pentru eliberarea plății este obligatorie fotografia de finalizare.</p><Button disabled={!hasCompletion || Boolean(settlingJob)} className="w-full disabled:cursor-not-allowed disabled:opacity-50" onClick={() => markComplete(job.id)}>Finalizează lucrarea și solicită încasarea</Button></div>
                )}
                </>})()}
              </Card>
            ))}
          </div>
        </section>

        {historyJobs.some(job=>job.financial?.paymentStatus==="authorized"&&!job.guarantee_of) && <section aria-label="Plăți de confirmat" className="space-y-3">
          <h2 className="font-display font-bold text-ink">Lucrări finalizate · plăți de confirmat</h2>
          <p className="text-sm text-muted">Lucrarea este finalizată, dar încasarea nu este încă confirmată. Poți relua verificarea pentru fiecare lucrare.</p>
          {historyJobs.filter(job=>job.financial?.paymentStatus==="authorized"&&!job.guarantee_of).map(job=><Card key={job.id}><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-bold">{job.street}, {job.city}</h3><p className="text-sm text-muted">Încasare în așteptarea confirmării</p></div><Button disabled={Boolean(settlingJob)} onClick={()=>void markComplete(job.id)}>{settlingJob===job.id?"Se verifică…":"Reîncearcă încasarea"}</Button></div></Card>)}
        </section>}

        {historyJobs.length > 0 && (
          <section id="castiguri" className="grid grid-cols-2 gap-3">
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
          <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display font-bold text-ink">Încasări prin Stripe</h2><p className="mt-1 text-xs leading-5 text-muted">{process.env.NEXT_PUBLIC_STRIPE_CONNECT_ONBOARDING==="true"?"Conectează contul firmei prin onboarding-ul găzduit de Stripe. Transferurile reale rămân inactive până la aprobarea NITIDO.":"Plățile directe către firme (Stripe Connect) se activează în curând. Până atunci, încasările se fac prin NITIDO."}</p></div>{process.env.NEXT_PUBLIC_STRIPE_CONNECT_ONBOARDING==="true"?<Button variant="outline" onClick={startStripeOnboarding}>Configurează încasările</Button>:<span className="shrink-0 rounded-full bg-mist px-4 py-2 text-xs font-bold text-muted">În curând</span>}</div>
        </section>

        <AppRatingCard />

        <section><h2 className="font-display font-bold text-ink mb-3 flex items-center gap-2">Reputația firmei {quality && <span className="text-[11px] font-bold text-aqua-deep bg-aqua/10 rounded-full px-2.5 py-1" title="Rating + experiență + fiabilitate">Nitido Quality Index: {quality.score}/100</span>}</h2>{quality && <div className="mb-3 grid grid-cols-3 gap-2">{[["Rating",quality.rating,60],["Experiență",quality.experience,20],["Fiabilitate",quality.reliability,20]].map(([label,val,max])=><div key={label as string} className="bg-white border border-line rounded-xl p-3"><div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold">{label}</div><div className="font-display font-extrabold text-lg text-ink">{val}<span className="text-xs text-muted font-normal">/{max}</span></div></div>)}</div>}<Card>{trustProfile.firms[0]?<><div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1"><div><b className="text-2xl">{trustProfile.firms[0].average_rating?Number(trustProfile.firms[0].average_rating).toFixed(1):"—"} / 5</b><p className="text-xs text-muted">{trustProfile.firms[0].review_count} recenzii verificate</p></div><div><b className="text-2xl">{trustProfile.firms[0].completed_jobs}</b><p className="text-xs text-muted">lucrări finalizate</p></div><div><b className="text-sm text-aqua-deep">{trustProfile.firms[0].verified?"Firmă verificată":"Verificare în curs"}</b></div></div>{trustProfile.reviews.length?<div className="mt-5 space-y-3">{trustProfile.reviews.map(review=><article key={review.id} className="rounded-xl bg-mist p-4"><div className="flex justify-between text-sm"><b>{review.rating} / 5 · {review.reviewer}</b><span className="text-aqua-deep">{review.badge}</span></div>{review.reviewText&&<p className="mt-2 text-sm text-muted">{review.reviewText}</p>}<div className="mt-3 flex gap-2"><select aria-label="Motiv raportare" className="rounded-lg border border-line bg-white px-2 py-1 text-xs" value={reportReasons[review.id]||"alt_motiv"} onChange={e=>setReportReasons(current=>({...current,[review.id]:e.target.value}))}><option value="limbaj_abuziv">Limbaj abuziv</option><option value="date_personale">Date personale</option><option value="spam">Spam</option><option value="informatii_false">Informații false</option><option value="alt_motiv">Alt motiv</option></select><button type="button" className="text-xs font-bold text-coral" onClick={()=>void reportReview(review.id)}>Raportează</button></div></article>)}</div>:<p className="mt-4 text-sm text-muted">Încă nu există suficiente evaluări.</p>}</>:<p className="text-sm text-muted">Încă nu există suficiente evaluări.</p>}</Card></section>

        {historyJobs.some(job=>job.financial?.paymentStatus==="authorized"&&!job.guarantee_of) && <section aria-label="Plăți de confirmat" className="space-y-3">
          <h2 className="font-display font-bold text-ink">Lucrări finalizate · plăți de confirmat</h2>
          <p className="text-sm text-muted">Lucrarea este finalizată, dar încasarea nu este încă confirmată. Poți relua verificarea pentru fiecare lucrare.</p>
          {historyJobs.filter(job=>job.financial?.paymentStatus==="authorized"&&!job.guarantee_of).map(job=><Card key={job.id}><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-bold">{job.street}, {job.city}</h3><p className="text-sm text-muted">Încasare în așteptarea confirmării</p></div><Button disabled={Boolean(settlingJob)} onClick={()=>void markComplete(job.id)}>{settlingJob===job.id?"Se verifică…":"Reîncearcă încasarea"}</Button></div></Card>)}
        </section>}

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
        {!editingProfile && (
          <section id="profil" className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display font-bold text-ink">Despre firmă</h2>
              <button type="button" onClick={openProfileEditor} className={ACTION_BTN}>Editează</button>
            </div>
            {(firm?.description||firm?.services||firm?.working_hours||firm?.website)?(
              <div className="mt-3 space-y-3 text-sm">
                {firm?.description && <p className="leading-6 text-ink">{firm.description}</p>}
                <div className="grid gap-3 sm:grid-cols-2">
                  {firm?.services && <div><div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold">Servicii</div><div className="text-ink mt-0.5">{firm.services}</div></div>}
                  {firm?.working_hours && <div><div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold">Program</div><div className="text-ink mt-0.5">{firm.working_hours}</div></div>}
                  <div><div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold">Acoperire</div><div className="text-ink mt-0.5">{firm?.coverage_city}{firm?.coverage_cities_extra?` + ${firm.coverage_cities_extra}`:""}</div></div>
                  {firm?.website && <div><div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold">Website</div><a href={firm.website} target="_blank" rel="noopener noreferrer" className="text-aqua-deep font-semibold mt-0.5 inline-block break-all">{firm.website.replace(/^https?:\/\//,"")}</a></div>}
                </div>
              </div>
            ):(
              <p className="mt-3 text-sm text-muted">Profilul tău e gol. Adaugă o descriere, serviciile și programul ca să câștigi încrederea clienților. <button type="button" onClick={openProfileEditor} className="text-ink font-bold underline">Completează profilul firmei</button>.</p>
            )}
          </section>
        )}

      </main>
    </div>
  );
}
