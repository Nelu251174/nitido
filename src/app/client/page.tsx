"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {PublishedPriceBreakdown} from "@/components/PublishedPriceBreakdown";
import {ClientOverview} from "@/components/ClientOverview";
import {DesignIcon} from "@/components/DesignIcon";
import {WorkspaceNav} from "@/components/WorkspaceNav";
import {JobExecutionDetail} from "@/components/JobExecutionDetail";
import {JOB_STATUS} from "@/lib/workspaceShared";
import { Logo, Card, Field, inputClass, Button, StatusTrack, StarRating } from "@/components/ui";
import {
  AUTOMATIC_MAX_SQM,
  calcGrossPrice,
  SLOT_HOURS,
  isSlotValid,
  nextValidAsapSlot,
  formatInterval,
  calcBlockedMinutes,
  SpaceType,
} from "@/lib/pricing";
import { JobRow } from "@/lib/types";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { applyCredit } from "@/lib/referral";
import { PROPERTY_TYPE_LABELS } from "@/lib/jobTypeLabels";
import { SCAN_ROOMS, scanRoomLabel } from "@/lib/nitidoScan";
import { EXPRESS_60_FEE_LEI } from "@/lib/express60";
import { AppRatingCard } from "@/components/AppRatingCard";

const DAY_NAMES = ["Dum", "Lun", "Mar", "Mie", "Joi", "Vin", "Sâm"];

interface UploadedPhoto {
  id: string;
  url: string;
  room: string | null;
}

interface OfferView {
  offerId: string;
  firmId: string;
  firmName: string;
  message: string | null;
  status: string;
  ratingAvg: number | null;
  ratingCount: number;
  completedJobs: number;
  qualityScore: number;
  createdAt: string;
}

interface PlanView {
  id: string;
  frequency: "weekly" | "biweekly" | "monthly";
  next_run_date: string;
  status: string;
  city: string;
  sqm: number;
  space_type: string;
}

const FREQ_LABELS: Record<string, string> = {
  weekly: "Săptămânal",
  biweekly: "La 2 săptămâni",
  monthly: "Lunar",
};

interface BusinessProfileView {
  isBusiness: boolean;
  companyName: string | null;
  companyCui: string | null;
  companyAddress: string | null;
}

interface ReportRow {
  jobId: string;
  completedAt: string | null;
  city: string;
  street: string;
  sqm: number;
  spaceType: string;
  priceGross: number;
  firmName: string | null;
}

export default function ClientPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  const [approvalId,setApprovalId]=useState<string|null>(null);
  const [propertyId,setPropertyId]=useState<string|null>(null);
  const requestRef=useRef<{payload:string;id:string}|null>(null);
  const [showBooking,setShowBooking]=useState(false);
  const [historyFilter,setHistoryFilter]=useState("");
  const [cardConfigured,setCardConfigured]=useState(false);
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [floor, setFloor] = useState("");
  const [details,setDetails]=useState("");
  const [sqm, setSqm] = useState(75);
  const [spaceType, setSpaceType] = useState<SpaceType>("apartament");
  const [whenType, setWhenType] = useState<"asap" | "scheduled">("asap");
  const [mode, setMode] = useState<"express" | "standard">("standard");
  const [express60, setExpress60] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date>(new Date());
  const [scheduledHour, setScheduledHour] = useState<number | null>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);

  const [job, setJob] = useState<JobRow | null>(null);
  const [firmName, setFirmName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", email: "", phone: "" });
  const [menuOpen, setMenuOpen] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);
  const [myJobs, setMyJobs] = useState<JobRow[]>([]);
  const [offers, setOffers] = useState<OfferView[]>([]);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [guaranteeEligible, setGuaranteeEligible] = useState(false);
  const [hasCard, setHasCard] = useState<boolean | null>(null); // null = se încarcă
  const [cardBusy, setCardBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== "client") router.replace(`/login?next=${encodeURIComponent(window.location.pathname+window.location.search+window.location.hash)}`);
  }, [loading, user, router]);

  useEffect(() => {
    if(user?.role!=="client")return;
    const params=new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialize form from navigation parameters after authentication
    if(window.location.hash==="#sec-form"||params.has("propertyId")||params.has("spaceType")||params.has("mode"))setShowBooking(true);
    const type=params.get("spaceType");if(type&&["apartament","casa","birou","altul"].includes(type))setSpaceType(type as SpaceType);
    const area=Number(params.get("sqm"));if(Number.isInteger(area)&&area>0&&area<=1000)setSqm(area);
    if(params.get("mode")==="express")setMode("express");
    const requestedCity=params.get("city");if(requestedCity)setCity(requestedCity.slice(0,100));
    const requestedDate=params.get("date"),requestedHour=Number(params.get("hour"));
    if(requestedDate&&/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)&&!Number.isNaN(new Date(`${requestedDate}T12:00:00`).getTime())){setWhenType("scheduled");setScheduledDate(new Date(`${requestedDate}T12:00:00`));if(params.has("hour")&&(SLOT_HOURS as readonly number[]).includes(requestedHour))setScheduledHour(requestedHour)}
    const approval=params.get("approvalId");if(approval){void fetch("/api/collaboration").then(r=>r.json()).then(d=>{const a=d.approvals?.find((a:{id:string;status:string})=>a.id===approval&&a.status==='approved');if(!a){setError("Aprobarea nu este disponibilă.");return}setApprovalId(a.id);setWhenType("scheduled");setScheduledDate(new Date(`${a.date}T12:00:00`));setScheduledHour(null)}).catch(()=>setError("Aprobarea nu a putut fi încărcată."))}
    const id=params.get("propertyId");if(id){void fetch("/api/workspace").then(r=>{if(!r.ok)throw new Error();return r.json()}).then(d=>{const p=d.properties.find((p:{id:string})=>p.id===id);if(!p){setError("Proprietatea nu este disponibilă.");return}setPropertyId(p.id);setStreet(p.street);setCity(p.city);setSqm(p.sqm);setSpaceType(p.space_type)}).catch(()=>setError("Proprietatea nu a putut fi încărcată."))}
  },[user?.id,user?.role]);

  const refreshMyJobs = useCallback(async () => {
    const response = await fetch("/api/jobs");
    if (!response.ok) return;
    const data = await response.json();
    setMyJobs(data.jobs ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- istoric încărcat după autentificare
    if (user?.role === "client") refreshMyJobs();
  }, [user?.id, user?.role, refreshMyJobs]);

  // Starea cardului: dacă tocmai s-a întors din Stripe (?card=added), sincronizează,
  // apoi citește dacă are card salvat. Dacă Stripe nu e activat, nu blocăm postarea.
  useEffect(() => {
    if (user?.role !== "client") return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get("card") === "added") {
          await fetch("/api/payments/card", { method: "POST" });
          window.history.replaceState({}, "", "/client");
        }
        const res = await fetch("/api/payments/card");
        if (!res.ok || cancelled) return;
        const d = await res.json();
        setCardConfigured(Boolean(d.stripeConfigured));
        setHasCard(Boolean(d.hasCard));
      } catch {
        if (!cancelled) {setHasCard(null);setError("Starea cardului nu a putut fi verificată.");}
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.role]);

  async function addCard() {
    setError(null);
    setCardBusy(true);
    try {
      const res = await fetch("/api/payments/checkout", { method: "POST" });
      const d = await res.json();
      if (!res.ok || !d.url) {
        setError(d.error ?? "Nu s-a putut porni adăugarea cardului.");
        setCardBusy(false);
        return;
      }
      window.location.href = d.url; // redirect către pagina de card găzduită de Stripe
    } catch {
      setError("Nu s-a putut porni adăugarea cardului.");
      setCardBusy(false);
    }
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>, room: string | null) {
    const files = Array.from(e.target.files ?? []).slice(0, 5 - photos.length);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        if (room) formData.append("room", room);
        const res = await fetch("/api/uploads", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          setPhotos((prev) => [...prev, { id: data.id, url: data.url, room: data.room ?? room }]);
        }
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const needsAssessment=sqm>AUTOMATIC_MAX_SQM;
  const basePrice = useMemo(() => {
    try {
      return calcGrossPrice(spaceType, sqm);
    } catch {
      return 0;
    }
  }, [spaceType, sqm]);

  // Express 60 adaugă suplimentul premium la prețul brut (doar pentru „asap").
  const express60Active = express60 && whenType === "asap";
  const express60Fee = express60Active ? EXPRESS_60_FEE_LEI : 0;
  const price = basePrice + express60Fee;

  const creditBalance = user?.credit_balance ?? 0;
  const { finalPrice, creditUsed } = applyCredit(price, creditBalance);

  const asapSlot = useMemo(() => nextValidAsapSlot(), []);

  const next14Days = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  async function postJob() {
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        street,
        postalCode,
        city,
        floor,
        sqm,
        spaceType,
        whenType,
        mode: express60Active ? "express" : mode,
        express60: express60Active,
        details,
        photoIds: photos.map((p) => p.id),
        propertyId,
        approvalId,
      };
      if (whenType === "scheduled") {
        if (scheduledHour === null) {
          setError("Alege un slot orar.");
          setSubmitting(false);
          return;
        }
        body.scheduledDate = `${scheduledDate.getFullYear()}-${String(scheduledDate.getMonth()+1).padStart(2,"0")}-${String(scheduledDate.getDate()).padStart(2,"0")}`;
        body.scheduledHour = scheduledHour;
      }
      const payload=JSON.stringify(body);
      if(requestRef.current?.payload!==payload)requestRef.current={payload,id:crypto.randomUUID()};
      body.clientRequestId=requestRef.current.id;
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": requestRef.current.id },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 402) setHasCard(false); // lipsă card — arată butonul de adăugare
      if (!res.ok) throw new Error(data.error ?? "Eroare la postare");
      setJob(data.job);
      requestRef.current=null;
      setShowBooking(false);
      refreshMyJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare necunoscută");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedJobId=job?.id;
  const poll = useCallback(async (signal:AbortSignal) => {
    if (!selectedJobId) return;
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(selectedJobId)}`,{signal});
      if (!res.ok) throw new Error("Detaliile lucrării nu au putut fi actualizate.");
      const data = await res.json();
      if(signal.aborted)return;
      setJob(data.job);
      setFirmName(data.firmName??null);
      if (data.job?.status === "waiting" && data.job?.mode === "standard") {
        const oRes = await fetch(`/api/jobs/${encodeURIComponent(selectedJobId)}/offers`,{signal});
        if (oRes.ok) {const offersData=await oRes.json();if(!signal.aborted)setOffers(offersData.offers??[])}
      }
    } catch(cause) {if(!signal.aborted)setError(cause instanceof Error?cause.message:"Eroare de conexiune.")}
  }, [selectedJobId]);

  async function chooseOffer(offerId: string) {
    if (!job) return;
    setError(null);
    setChoosing(offerId);
    try {
      const res = await fetch(`/api/jobs/${job.id}/offers/${offerId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Nu s-a putut alege oferta");
        return;
      }
      setJob(data.job);
      refreshMyJobs();
    } finally {
      setChoosing(null);
    }
  }

  useEffect(() => {
    if (!selectedJobId) return;
    const controller=new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial authenticated remote fetch, cancelled when the selected reservation changes
    void poll(controller.signal);
    const timer=["waiting","accepted","arrived"].includes(job?.status??"")?setInterval(()=>void poll(controller.signal),5000):null;
    return()=>{controller.abort();if(timer)clearInterval(timer)};
  }, [job?.status,selectedJobId,poll]);

  useEffect(() => {
    const c = job?.completed_at;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- eligibilitate garanție calculată la schimbarea lucrării
    setGuaranteeEligible(!!c && Date.now() - new Date(c).getTime() <= 48 * 3600 * 1000);
  }, [job?.id, job?.status, job?.completed_at]);

  async function submitRating(stars: number, reviewText: string) {
    if (!job) return;
    const res = await fetch(`/api/jobs/${job.id}/rating`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stars, reviewText }),
    });
    if (res.ok) setRatingDone(true);
  }

  async function requestGuarantee() {
    if (!job) return;
    setError(null);
    const res = await fetch(`/api/jobs/${job.id}/reclean`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Nu s-a putut cere re-curățarea");
      return;
    }
    setJob(data.job); // urmărim de acum lucrarea de re-curățare
    refreshMyJobs();
  }

  function resetToForm() {
    setJob(null);
    setFirmName(null);
    setRatingDone(false);
    setPhotos([]);
    setDetails("");
  }

  // „Postează o lucrare" — resetează la formular ȘI derulează direct la el, ca
  // utilizatorul să ajungă imediat unde completează, nu doar să vadă un mesaj.
  function goToForm() {
    setShowBooking(true);
    resetToForm();
    setTimeout(() => {
      document.getElementById("sec-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  async function openProfileEditor() {
    setJob(null); setShowBooking(false);
    setError(null);
    try {
      const res = await fetch("/api/account/client");
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Nu s-a putut încărca profilul"); return; }
      setProfileForm({ name: d.name ?? "", email: d.email ?? "", phone: d.phone ?? "" });
      setEditingProfile(true);
      setTimeout(() => document.getElementById("sec-cont")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    } catch { setError("Nu s-a putut încărca profilul"); }
  }

  async function saveProfile() {
    setSavingProfile(true); setError(null);
    try {
      const res = await fetch("/api/account/client", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profileForm) });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Nu s-au putut salva modificările"); setSavingProfile(false); return; }
      window.location.reload();
    } catch { setError("Nu s-au putut salva modificările"); setSavingProfile(false); }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (loading || !user || user.role !== "client") {
    return (
      <div className="min-h-screen bg-mist flex items-center justify-center text-muted text-sm">
        Se încarcă...
      </div>
    );
  }

  const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const navItems: { label: string; onSelect: () => void }[] = [
    { label: "Acasă", onSelect: () => { setShowBooking(false); resetToForm(); window.scrollTo({ top: 0, behavior: "smooth" }); } },
    { label: "Lucrările mele", onSelect: () => scrollToId("sec-lucrari") },
    { label: "Mesaje", onSelect: () => router.push("/client/mesaje") },
    { label: "Plăți", onSelect: () => scrollToId("sec-plata") },
    { label: "Încredere & Siguranță", onSelect: () => scrollToId("sec-incredere") },
    { label: "Cont", onSelect: () => scrollToId("sec-cont") },
  ];

  return (
    <div className="approved-client min-h-screen bg-[#f7f9fc] flex max-[760px]:block">
      <aside className="w-[236px] shrink-0 bg-white border-r border-[#e2e8f0] p-5 flex flex-col sticky top-0 h-screen max-[760px]:w-full max-[760px]:h-auto max-[760px]:relative max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:p-4">
        <div className="flex items-center justify-between">
          <Logo href="/client" onClick={()=>{setJob(null);setShowBooking(false);window.scrollTo(0,0)}} />
          <button type="button" onClick={()=>setMenuOpen(o=>!o)} aria-expanded={menuOpen} aria-label="Meniu" className="hidden max-[760px]:inline-flex items-center gap-2 rounded-full border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-semibold text-[#3e4842]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{menuOpen?<path d="M6 6l12 12M18 6 6 18"/>:<><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>}</svg>
            Meniu
          </button>
        </div>
        <WorkspaceNav role="client" onNavigate={href=>{if(href==='/client'||href.startsWith('/client#')){setJob(null);setShowBooking(false)}}}/>
        {menuOpen && (
          <nav className="hidden max-[760px]:flex flex-col mt-3 rounded-2xl border border-[#e2e8f0] bg-white overflow-hidden text-sm font-semibold">
            {navItems.map((it,i)=><button key={it.label} type="button" onClick={()=>{it.onSelect();setMenuOpen(false);}} className={`text-left px-4 py-3.5 text-[#3e4842] active:bg-[#e8f5f2] ${i>0?"border-t border-[#ecebe4]":""}`}>{it.label}</button>)}
            <button type="button" onClick={()=>{setMenuOpen(false);logout();}} className="text-left px-4 py-3.5 text-[#c0392b] border-t border-[#ecebe4]">Ieși din cont</button>
          </nav>
        )}
        <div className="mt-auto max-[760px]:hidden"><div className="text-sm font-semibold">{user.name}</div><div className="text-xs text-[#6b756f] mt-1">{user.email}</div><button onClick={logout} className="text-xs text-[#64748b] mt-4">Ieși din cont</button></div>
      </aside>
      <main className="flex-1 min-w-0 px-8 py-8 max-[760px]:px-[22px] max-[760px]:pb-28">
        <div className="board-topbar"><span>Spațiul tău NITIDO</span><div><Link href="/client/mesaje" aria-label="Mesaje"><DesignIcon name="bell"/></Link><button type="button" className="account-profile-link" onClick={openProfileEditor} aria-label="Deschide profilul meu"><span className="board-avatar">{user.name.slice(0,1)}</span><b>{user.name}</b></button></div></div>
        <header className="board-greeting"><div><h1>Bună, {user.name.split(" ")[0]}!</h1><p>Mulțumim că faci parte din comunitatea NITIDO.RO.</p></div><span className="board-greeting-note"><DesignIcon name="sparkles"/>Un cămin curat este începutul<br/>unei zile mai bune.</span></header>
        {!job&&!showBooking&&<ClientOverview jobs={myJobs} onSelect={setJob} onBook={goToForm}/>}
        {job&&<JobExecutionDetail job={job} firmName={firmName} onBack={()=>{setJob(null);setShowBooking(false)}}/>}
        <div className={`client-content-grid ${showBooking&&!job?"with-detail":""}`}>
        <div className="min-w-0">
        {myJobs.filter(j=>j.status==="waiting"&&["requires_action","requires_confirmation"].includes(j.authorizationStatus??"")).map(j=><section key={j.id} className="v2-card p-5 mb-4"><h2 className="font-bold">Confirmarea cardului este necesară</h2><p className="text-sm text-muted mt-2">{j.city} · {j.sqm} m². Banca solicită confirmarea autorizării pentru această lucrare.</p><Link href={`/client/plata/${encodeURIComponent(j.id)}`} className="inline-block mt-3 font-bold text-aqua-deep underline">Confirmă prin bancă</Link></section>)}
        {!job&&!showBooking&&myJobs.length>0&&<section id="sec-lucrari" className="v2-card p-5 mb-5"><div className="flex justify-between"><h2 className="font-bold">Rezervările tale recente</h2><span className="text-xs text-[#6b756f]">{myJobs.length} total</span></div><input aria-label="Caută rezervări" className={`${inputClass} mt-3`} value={historyFilter} onChange={e=>setHistoryFilter(e.target.value)} placeholder="Caută rezervare sau status…"/><div className="mt-3 divide-y divide-[#e2e8f0]">{myJobs.filter(item=>`${item.city} ${item.street} ${JOB_STATUS[item.status]}`.toLowerCase().includes(historyFilter.toLowerCase())).map(item=><button key={item.id} onClick={()=>setJob(item)} className="w-full py-3 flex items-center gap-3 text-left"><span className="w-10 h-10 rounded-lg bg-[#e8f5f2] flex items-center justify-center text-[#115e59] font-bold">{item.space_type.slice(0,1).toUpperCase()}</span><span className="min-w-0 flex-1"><b className="text-sm block truncate">{item.space_type} · {item.city}</b><span className="text-xs text-[#6b756f]">{item.sqm} m² · {JOB_STATUS[item.status]}</span></span><b className="text-sm">{item.price_gross} lei</b></button>)}</div></section>}
        {!job && !showBooking && <RecurringSection defaults={{ street, postalCode, city, floor, sqm, spaceType }} />}
        {!job && !showBooking && <BusinessSection />}
        {!job && !showBooking && user?.referral_code && (
          <ReferralCard code={user.referral_code} creditBalance={creditBalance} />
        )}
        {!job && !showBooking && <div className="mb-5"><AppRatingCard /></div>}
        {!job && !showBooking && <section id="sec-mesaje" className="v2-card p-5 mb-5"><h2 className="font-bold">Mesaje &amp; suport</h2><p className="text-sm text-[#64748b] mt-2 leading-6">Ai o întrebare despre o lucrare sau despre cont? Echipa NITIDO îți răspunde rapid.</p><div className="mt-3 flex flex-col gap-1 text-sm"><a href="tel:0341402403" className="text-[#115e59] font-semibold">📞 0341 402 403</a><a href="mailto:contact@nitido.ro" className="text-[#115e59] font-semibold">✉️ contact@nitido.ro</a></div><Link href="/contact#asistent-ai" className="v2-btn v2-btn-secondary mt-4 inline-flex">Deschide asistentul NITIDO</Link></section>}
        {!job && !showBooking && <section id="sec-incredere" className="v2-card p-5 mb-5"><h2 className="font-bold">Încredere &amp; Siguranță</h2><ul className="text-sm text-[#64748b] mt-2 leading-6 list-disc pl-5 space-y-1"><li>Firme verificate în platformă, cu CUI validat la ANAF.</li><li>Autorizarea cardului și încasarea sunt etape distincte. Starea plății este afișată separat de starea lucrării.</li><li>Plata cardului e procesată securizat de Stripe — NITIDO nu îți vede datele cardului.</li><li>Urmărești lucrarea în timp real și primești dovezi foto la final.</li></ul><Link href="/incredere" className="v2-btn v2-btn-secondary mt-4 inline-flex">Vezi pagina completă</Link></section>}
        {!job && !showBooking && (
          <section id="sec-cont" className="v2-card p-5 mb-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold">Contul meu</h2>
              {!editingProfile && <button type="button" onClick={openProfileEditor} className="inline-flex items-center rounded-full border border-[#d8d7d0] px-3.5 py-1.5 text-sm font-semibold text-[#115e59] transition-colors duration-150 hover:border-[#0f766e] hover:bg-[#e8f5f2]">Editează profilul</button>}
            </div>
            {!editingProfile ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
                <div><div className="text-[10.5px] uppercase tracking-wide text-[#6b756f] font-semibold">Nume</div><div className="text-ink mt-0.5">{user.name}</div></div>
                <div><div className="text-[10.5px] uppercase tracking-wide text-[#6b756f] font-semibold">Email</div><div className="text-ink mt-0.5 break-all">{user.email}</div></div>
                <div className="sm:col-span-2"><button onClick={logout} className="inline-flex items-center rounded-full border border-[#d8d7d0] px-3.5 py-1.5 text-sm font-semibold text-[#c0392b] transition-colors duration-150 hover:border-[#c0392b] hover:bg-[#fbeaea]">Ieși din cont</button></div>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <label className="block text-sm"><span className="text-[#6b756f]">Nume</span><input className={inputClass} value={profileForm.name} onChange={(e)=>setProfileForm(f=>({...f,name:e.target.value}))} /></label>
                <label className="block text-sm"><span className="text-[#6b756f]">Email</span><input className={inputClass} value={profileForm.email} onChange={(e)=>setProfileForm(f=>({...f,email:e.target.value}))} /></label>
                <label className="block text-sm"><span className="text-[#6b756f]">Telefon</span><input className={inputClass} value={profileForm.phone} onChange={(e)=>setProfileForm(f=>({...f,phone:e.target.value}))} placeholder="07xx xxx xxx" /></label>
                <p className="text-xs text-[#6b756f]">Parola se schimbă din pagina „Am uitat parola”.</p>
                <div className="flex gap-2 pt-1">
                  <Button onClick={saveProfile} disabled={savingProfile}>{savingProfile?"Se salvează...":"Salvează"}</Button>
                  <Button variant="outline" onClick={()=>setEditingProfile(false)} disabled={savingProfile}>Renunță</Button>
                </div>
              </div>
            )}
          </section>
        )}
        <div id="sec-form" />
        {!job && showBooking && (
          <Card>
            <h1 className="font-display font-extrabold text-xl text-ink mb-1">
              Postează o lucrare
            </h1>
            <p className="text-sm text-muted mb-5 leading-relaxed">
              Completează detaliile — vezi prețul instant, apoi firmele din zonă primesc alerta.
            </p>

            <Field label="Instrucțiuni speciale (opțional)"><textarea className={inputClass} rows={3} maxLength={500} value={details} onChange={e=>setDetails(e.target.value)} placeholder="Materiale sensibile, animale de companie, preferințe de curățenie…"/><small>{details.length}/500 · Vizibile firmei după alocare. Nu introduce coduri de acces sau parole.</small></Field>
            <Field label="Stradă și număr">
              <input className={inputClass} value={street} onChange={(e) => setStreet(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cod poștal">
                <input className={inputClass} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              </Field>
              <Field label="Oraș">
                <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Etaj">
                <input className={inputClass} value={floor} onChange={(e) => setFloor(e.target.value)} />
              </Field>
              <Field label="Suprafață (mp)">
                <input
                  type="number"
                  className={inputClass}
                  value={sqm}
                  onChange={(e) => setSqm(Number(e.target.value) || 0)}
                />
              </Field>
            </div>
            <Field label="Tip spațiu">
              <select
                className={inputClass}
                value={spaceType}
                onChange={(e) => setSpaceType(e.target.value as SpaceType)}
              >
                {Object.entries(PROPERTY_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>

            <span className="block text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-1">
              Cum vrei să alegi firma?
            </span>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setMode("standard")}
                className={`text-left p-3 rounded-xl border ${mode === "standard" ? "border-aqua bg-aqua/10" : "border-line"}`}
              >
                <span className="block font-display font-bold text-xs text-ink">✦ Primesc oferte</span>
                <span className="block text-[11px] text-muted mt-0.5 leading-tight">Mai multe firme, aleg eu pe calitate. Recomandat.</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("express")}
                className={`text-left p-3 rounded-xl border ${mode === "express" ? "border-coral bg-coral/10" : "border-line"}`}
              >
                <span className="block font-display font-bold text-xs text-ink">⚡ Express (urgent)</span>
                <span className="block text-[11px] text-muted mt-0.5 leading-tight">Prima firmă disponibilă preia imediat.</span>
              </button>
            </div>

            {/* Express 60 — tier premium: preluare garantată în 60 de minute. */}
            <button
              type="button"
              onClick={() => {
                const next = !express60;
                setExpress60(next);
                if (next) setWhenType("asap");
              }}
              className={`w-full text-left p-3 rounded-xl border mb-3 flex items-start gap-2.5 ${
                express60Active ? "border-coral bg-coral/10" : "border-line"
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                  express60Active ? "border-coral bg-coral text-white" : "border-line text-transparent"
                }`}
                aria-hidden="true"
              >
                ✓
              </span>
              <span className="flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display font-bold text-xs text-ink">🔥 Express 60 · preluare în 60 min</span>
                  <span className="font-display font-bold text-xs text-coral shrink-0">+{EXPRESS_60_FEE_LEI} lei</span>
                </span>
                <span className="block text-[11px] text-muted mt-0.5 leading-tight">
                  Garantat: o firmă preia în 60 de minute, prioritate maximă. Dacă nu, nu plătești suplimentul.
                </span>
              </span>
            </button>
            {express60 && whenType !== "asap" && (
              <div className="text-[11px] text-coral bg-coral/5 rounded-lg px-3 py-2 mb-3">
                Express 60 e disponibil doar pentru „Cât mai curând”. Alege-l mai jos.
              </div>
            )}

            <span className="block text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-1">
              Când?
            </span>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setWhenType("asap")}
                className={`flex-1 py-2.5 rounded-lg border font-display font-bold text-xs ${
                  whenType === "asap" ? "border-aqua bg-aqua/10 text-ink" : "border-line text-muted"
                }`}
              >
                Cât mai curând
              </button>
              <button
                type="button"
                onClick={() => setWhenType("scheduled")}
                className={`flex-1 py-2.5 rounded-lg border font-display font-bold text-xs ${
                  whenType === "scheduled" ? "border-aqua bg-aqua/10 text-ink" : "border-line text-muted"
                }`}
              >
                Aleg data
              </button>
            </div>

            {whenType === "asap" && asapSlot && (
              <div className="text-xs text-muted bg-mist rounded-lg px-3 py-2.5 mb-3">
                Cel mai apropiat slot disponibil:{" "}
                <b className="text-ink">
                  {asapSlot.date.toDateString() === new Date().toDateString() ? "azi" : "mâine"},{" "}
                  {String(asapSlot.hour).padStart(2, "0")}:00
                </b>
              </div>
            )}

            {whenType === "scheduled" && (
              <div className="mb-3">
                <div className="flex gap-1.5 overflow-x-auto pb-1.5 mb-2">
                  {next14Days.map((d, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => {
                        setScheduledDate(d);
                        setScheduledHour(null);
                      }}
                      className={`flex-shrink-0 w-12 text-center py-2 rounded-lg border text-[11px] ${
                        d.toDateString() === scheduledDate.toDateString()
                          ? "border-aqua bg-aqua/10"
                          : "border-line"
                      }`}
                    >
                      {DAY_NAMES[d.getDay()]}
                      <div className="font-display font-bold text-sm">{d.getDate()}</div>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {SLOT_HOURS.map((h) => {
                    const valid = isSlotValid(scheduledDate, h);
                    return (
                      <button
                        type="button"
                        key={h}
                        disabled={!valid}
                        onClick={() => setScheduledHour(h)}
                        className={`py-2 rounded-lg border text-xs ${
                          !valid
                            ? "opacity-30 line-through cursor-not-allowed border-line"
                            : scheduledHour === h
                            ? "border-aqua bg-aqua/10 font-bold"
                            : "border-line"
                        }`}
                      >
                        {String(h).padStart(2, "0")}:00
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="border border-line rounded-xl p-3.5 mb-2 bg-white">
              <div className="flex items-center justify-between">
                <span className="font-display font-semibold text-xs">📷 Nitido Scan (opțional)</span>
                <span className="text-[10.5px] text-muted">{photos.length}/5 poze</span>
              </div>
              <p className="text-[10.5px] text-muted mt-0.5 mb-2.5">
                Fă câte o poză pe încăpere. Firma vede contextul clar și estimează mai bine.
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {SCAN_ROOMS.map((r) => (
                  <label
                    key={r.key}
                    className={`flex flex-col items-center justify-center gap-0.5 border border-dashed border-line rounded-lg py-2 text-center text-[10.5px] font-semibold ${
                      photos.length >= 5 || uploading
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer hover:border-aqua"
                    }`}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={photos.length >= 5 || uploading}
                      onChange={(e) => handlePhotoSelect(e, r.key)}
                    />
                    <span className="text-base leading-none">＋</span>
                    <span>{r.label}</span>
                  </label>
                ))}
              </div>
              {uploading && <div className="text-[10.5px] text-muted mt-2">Se încarcă…</div>}
              {photos.length > 0 && (
                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {photos.map((p) => (
                    <div key={p.id} className="relative w-14">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt={`Poză ${scanRoomLabel(p.room)}`}
                        className="w-14 h-14 rounded-lg object-cover border border-line"
                      />
                      <span className="block text-[9px] text-muted text-center mt-0.5 leading-tight">
                        {scanRoomLabel(p.room)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {needsAssessment?<section className="design-panel"><h2>Este necesară o evaluare</h2><p>Suprafața depășește limita calculatorului automat.</p><Link className="design-button" href={`/client/evaluari?${new URLSearchParams({city,sqm:String(sqm)})}`}>Trimite spre evaluare</Link></section>:<div className="bg-mist border border-aqua rounded-xl p-3.5 my-4">
              {express60Active && (
                <div className="flex justify-between items-center text-[11.5px] text-muted mb-1.5 pb-1.5 border-b border-line/60">
                  <span>Curățenie {basePrice} lei · 🔥 Express 60 +{express60Fee} lei</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-[11.5px] text-muted">
                  {creditUsed > 0 ? "Preț (după credit)" : "Preț estimat"}
                </span>
                <span className="flex items-baseline gap-2">
                  {creditUsed > 0 && (
                    <span className="text-xs text-muted line-through">{price} lei</span>
                  )}
                  <span className="font-display font-extrabold text-xl text-aqua-deep">
                    {finalPrice} lei
                  </span>
                </span>
              </div>
              {creditUsed > 0 && (
                <p className="text-[11px] text-aqua-deep font-semibold mt-1">
                  Ai folosit {creditUsed} lei din creditul de recomandare
                </p>
              )}
            </div>}

            {error && <p className="text-coral text-xs mb-3">{error}</p>}

            {!needsAssessment && cardConfigured && hasCard === false && (
              <div id="sec-plata" className="mb-3 rounded-xl border border-[#e2e8f0] bg-[#f7f9fc] p-4">
                <div className="text-sm font-bold text-[#111827]">Adaugă un card pentru plată</div>
                <p className="text-xs text-[#64748b] mt-1 leading-5">
                  Banii se rezervă abia când o firmă acceptă lucrarea și se încasează doar
                  după finalizarea confirmată. Cardul e procesat securizat de Stripe.
                </p>
                <Button className="w-full mt-3" onClick={addCard} disabled={cardBusy}>
                  {cardBusy ? "Se deschide..." : "Adaugă card"}
                </Button>
              </div>
            )}
            {!needsAssessment && cardConfigured && hasCard === true && (
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-[#115e59]">
                <span>✓</span> Card salvat — plată securizată
              </p>
            )}

            <Button className="w-full" onClick={postJob} disabled={needsAssessment || submitting || (cardConfigured && hasCard !== true) || !street.trim() || !city.trim()}>
              {submitting ? "Se postează..." : "Postează lucrarea"}
            </Button>
          </Card>
        )}

        {job && <PublishedPriceBreakdown snapshot={job.pricing_snapshot}/>}
        {job?.details && <section className="design-panel"><h2>Instrucțiunile tale</h2><p className="whitespace-pre-wrap break-words">{job.details}</p></section>}
        {job && job.status === "waiting" && (
          <Card>
            <h1 className="font-display font-extrabold text-xl text-ink mb-1">Lucrare postată!</h1>
            {job.mode === "standard" ? (
              <>
                <p className="text-sm text-muted mb-3">
                  Firmele verificate din zonă trimit oferte. Alege firma care îți place — pe calitate, nu pe noroc.
                </p>
                {offers.length === 0 ? (
                  <div className="rounded-xl border border-line bg-mist p-4 text-sm text-muted">
                    Așteptăm primele oferte… firmele din zonă au fost notificate.
                  </div>
                ) : (
                  <div className="offer-comparison">
                    <div className="offer-comparison-heading">
                      {offers.length} {offers.length === 1 ? "ofertă primită" : "oferte primite"}
                    </div>
                    {offers.map((o) => (
                      <div key={o.offerId} className="offer-comparison-card">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="offer-avatar">{o.firmName.slice(0,1)}</span><div className="font-display font-bold text-sm text-ink truncate">{o.firmName}</div>
                              <span className="eyebrow-pill">Candidatură</span>
                            </div>
                            <div className="text-[11.5px] text-muted mt-0.5">
                              {o.ratingAvg != null ? `★ ${o.ratingAvg.toFixed(1)} (${o.ratingCount})` : "firmă nouă"} · {o.completedJobs} lucrări finalizate
                            </div>
                          </div>
                          <Button onClick={() => chooseOffer(o.offerId)} disabled={choosing !== null}>
                            {choosing === o.offerId ? "Se alege…" : "Alege această firmă"}
                          </Button>
                        </div>
                        <div className="offer-price"><b>{job.price_gross} lei</b><span>Preț fix pentru această solicitare</span></div>
                        {o.message && (
                          <p className="text-sm text-muted mt-2 border-t border-line pt-2">{o.message}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {job.express_60 ? (
                  <div className="rounded-xl border border-coral bg-coral/10 p-3 mb-3">
                    <div className="font-display font-bold text-sm text-ink">🔥 Express 60 activ</div>
                    <p className="text-[12px] text-muted mt-0.5">
                      Preluare garantată{job.express_60_deadline ? (
                        <> până la <b className="text-ink">{new Date(job.express_60_deadline).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}</b></>
                      ) : " în 60 de minute"}. Dacă nicio firmă nu preia la timp, suplimentul nu se percepe.
                    </p>
                  </div>
                ) : null}
                <p className="text-sm text-muted mb-2">
                  Firmele din zonă au primit alerta acum. Așteptăm acceptare.
                </p>
                {job.scheduled_at && (
                  <p className="text-xs text-muted">
                    Interval rezervat: {formatInterval(new Date(job.scheduled_at), calcBlockedMinutes(job.sqm))}
                  </p>
                )}
                <StatusTrack
                  steps={[
                    { label: "Alertă trimisă către firme", done: true },
                    { label: "Așteaptă acceptare...", done: false },
                    { label: "Confirmată", done: false },
                  ]}
                />
              </>
            )}
          </Card>
        )}

        {job && job.status === "completed" && !ratingDone && !job.ownReview && (
          <Card>
            <h1 className="font-display font-bold text-lg text-ink text-center mb-1">
              Cum a fost curățenia?
            </h1>
            <p className="text-sm text-muted text-center mb-2">
              {firmName ?? "Firma"} a finalizat lucrarea. Poți lăsa o recenzie. Starea plății este afișată separat.
            </p>
            <RatingBlock onSubmit={submitRating} />
          </Card>
        )}

        {job && job.status === "completed" && (ratingDone || job.ownReview) && (
          <Card>
            <h1 className="font-display font-bold text-lg text-ink mb-2">Mulțumim!</h1>
            <p className="text-sm text-muted mb-4">{job.ownReview?`${job.ownReview.rating} / 5 · ${job.ownReview.badge}${job.ownReview.reviewText?` — ${job.ownReview.reviewText}`:""}`:"Rating-ul tău a fost înregistrat."}</p>
            {guaranteeEligible && (
              <div className="mb-4 rounded-xl border border-line bg-mist p-3.5">
                <div className="text-sm font-bold text-ink flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[#a9781f] bg-[#f7efdd] rounded-full px-2 py-0.5">Nitido Guaranteed</span>
                  Nu ești mulțumit?
                </div>
                <p className="text-[11.5px] text-muted mt-1 leading-relaxed">
                  Ai garanție: trimitem gratuit aceeași echipă înapoi. Valabil 48h de la finalizare.
                </p>
                <Button variant="outline" className="w-full mt-2.5" onClick={requestGuarantee}>
                  Cere re-curățare gratuită
                </Button>
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={resetToForm}>
              Postează o nouă lucrare
            </Button>
            <div className="mt-4">
              <AppRatingCard compact />
            </div>
          </Card>
        )}

        {job && job.status === "no_show" && (
          <Card>
            <h1 className="font-display font-bold text-lg text-coral mb-2">
              Firma nu a confirmat prezența
            </h1>
            <p className="text-sm text-muted mb-4">
              Lucrarea a fost anulată automat. Verifică starea anulării autorizării în detaliile plății.
            </p>
            <Button className="w-full" onClick={resetToForm}>
              Repostează lucrarea
            </Button>
          </Card>
        )}

        {job && job.status === "cancelled" && (
          <Card>
            <h1 className="font-display font-bold text-lg text-ink mb-2">Lucrarea este anulată</h1>
            <p className="text-sm text-muted mb-4">
              Consultă istoricul rezervărilor pentru o eventuală repostare și starea separată a plății.
            </p>
            <Button className="w-full" onClick={resetToForm}>Înapoi la panou</Button>
          </Card>
        )}
        </div>
        {(!job&&showBooking)&&<aside className="space-y-4"><div className="v2-card p-6"><h2 className="text-xl font-bold">Pregătește rezervarea</h2><p className="text-sm text-muted leading-6 mt-3">Completează spațiul, adresa și programul. Verifică prețul înainte de publicare.</p></div><Link href="/client/proprietati" className="v2-card p-5 block"><b>Proprietățile tale</b><p className="text-sm text-muted mt-2">Salvează adresele pentru rezervările viitoare.</p></Link></aside>}
        </div>
      </main>
      <nav className="mobile-workspace-nav" aria-label="Navigare rapidă"><button onClick={()=>{setShowBooking(false);resetToForm();window.scrollTo(0,0)}}>Acasă</button><button onClick={()=>scrollToId("sec-lucrari")}>Rezervări</button><Link href="/client/mesaje">Mesaje</Link><button onClick={()=>scrollToId("sec-cont")}>Cont</button></nav>
    </div>
  );
}

function ReferralCard({ code, creditBalance }: { code: string; creditBalance: number }) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="bg-aqua/10 border border-aqua rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-display font-bold text-sm text-ink">
            Recomandă Nitido unui prieten
          </div>
          <div className="text-[11.5px] text-muted mt-0.5">
            Amândoi primiți 20 lei credit — codul tău:{" "}
            <span className="font-mono font-bold text-ink">{code}</span>
          </div>
        </div>
        <button
          onClick={copyCode}
          className="flex-shrink-0 text-xs font-display font-bold text-aqua-deep border border-aqua rounded-lg px-3 py-2 bg-white hover:bg-aqua/10"
        >
          {copied ? "Copiat!" : "Copiază"}
        </button>
      </div>
      {creditBalance > 0 && (
        <div className="text-[11.5px] text-aqua-deep font-semibold mt-2">
          Ai {creditBalance} lei credit disponibil — se aplică automat la următoarea lucrare.
        </div>
      )}
    </div>
  );
}

function RecurringSection({ defaults }: { defaults: { street: string; postalCode: string; city: string; floor: string; sqm: number; spaceType: SpaceType } }) {
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [open, setOpen] = useState(false);
  const [frequency, setFrequency] = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [startDate, setStartDate] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [hour, setHour] = useState(10);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/recurring");
    if (r.ok) setPlans((await r.json()).plans ?? []);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- încărcare inițială a abonamentelor (client-only)
    void load();
  }, [load]);

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...defaults, frequency, hour, startDate }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg(d.error ?? "Nu s-a putut crea abonamentul");
        return;
      }
      setOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus(id: string, status: string) {
    await fetch(`/api/recurring/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  return (
    <div className="v2-card p-5 mb-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">
          Abonament recurent{" "}
          <span className="text-[11px] font-bold text-aqua-deep bg-aqua/10 rounded-full px-2 py-0.5 align-middle">Nitido Repeat</span>
        </h2>
        <button onClick={() => setOpen((o) => !o)} className="text-xs font-display font-bold text-aqua-deep">
          {open ? "Închide" : "+ Adaugă"}
        </button>
      </div>
      <p className="text-xs text-muted mt-1">Aceeași echipă, la interval fix. Se creează automat următoarea lucrare.</p>

      {plans.length > 0 && (
        <div className="mt-3 divide-y divide-[#e2e8f0]">
          {plans.map((p) => (
            <div key={p.id} className="py-3 flex items-center gap-3">
              <span className="w-10 h-10 rounded-lg bg-[#e8f5f2] flex items-center justify-center text-[#115e59] font-bold">↻</span>
              <span className="min-w-0 flex-1">
                <b className="text-sm block truncate">{FREQ_LABELS[p.frequency]} · {p.space_type} · {p.city}</b>
                <span className="text-xs text-[#6b756f]">Următoarea: {p.next_run_date} · {p.status === "active" ? "activ" : p.status === "paused" ? "pe pauză" : p.status}</span>
              </span>
              {p.status !== "cancelled" && (
                <span className="flex gap-2 flex-shrink-0">
                  {p.status === "active" ? (
                    <button onClick={() => changeStatus(p.id, "paused")} className="text-xs font-bold text-muted">Pauză</button>
                  ) : (
                    <button onClick={() => changeStatus(p.id, "active")} className="text-xs font-bold text-aqua-deep">Reia</button>
                  )}
                  <button onClick={() => changeStatus(p.id, "cancelled")} className="text-xs font-bold text-coral">Anulează</button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-[11px] text-muted mb-2">
            Se folosește adresa și spațiul din formularul de mai jos: <b>{defaults.spaceType}</b> · {defaults.sqm} m² · {defaults.city}.
          </p>
          <span className="block text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-1">Frecvență</span>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {(["weekly", "biweekly", "monthly"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrequency(f)}
                className={`py-2 rounded-lg border text-[11px] font-display font-bold ${frequency === f ? "border-aqua bg-aqua/10 text-ink" : "border-line text-muted"}`}
              >
                {FREQ_LABELS[f]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prima dată">
              <input type="date" className={inputClass} min={new Date().toISOString().slice(0, 10)} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Ora">
              <select className={inputClass} value={hour} onChange={(e) => setHour(Number(e.target.value))}>
                {SLOT_HOURS.map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
            </Field>
          </div>
          {msg && <p className="text-coral text-xs mt-1">{msg}</p>}
          <Button className="w-full mt-3" onClick={create} disabled={busy}>
            {busy ? "Se creează..." : "Creează abonamentul"}
          </Button>
        </div>
      )}
    </div>
  );
}

function BusinessSection() {
  const [profile, setProfile] = useState<BusinessProfileView | null>(null);
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyCui, setCompanyCui] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [report, setReport] = useState<{ rows: ReportRow[]; totalJobs: number; totalAmount: number } | null>(null);
  const [showReport, setShowReport] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/account/business");
    if (r.ok) {
      const p = (await r.json()).profile as BusinessProfileView;
      setProfile(p);
      setCompanyName(p.companyName ?? "");
      setCompanyCui(p.companyCui ?? "");
      setCompanyAddress(p.companyAddress ?? "");
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- încărcare inițială profil business (client-only)
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/account/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, companyCui, companyAddress }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg(d.error ?? "Nu s-a putut salva");
        return;
      }
      setProfile(d.profile);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }
  async function loadReport() {
    const r = await fetch("/api/reports/execution");
    if (r.ok) {
      setReport((await r.json()).report);
      setShowReport(true);
    }
  }

  return (
    <div className="v2-card p-5 mb-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">
          Cont business{" "}
          <span className="text-[11px] font-bold text-[#3a4650] bg-[#eef1f0] rounded-full px-2 py-0.5 align-middle">Nitido Office</span>
        </h2>
        <button onClick={() => setOpen((o) => !o)} className="text-xs font-display font-bold text-aqua-deep">
          {open ? "Închide" : profile?.isBusiness ? "Editează" : "+ Activează"}
        </button>
      </div>
      <p className="text-xs text-muted mt-1">Pentru birouri și firme: date de facturare + raport de execuție.</p>

      {profile?.isBusiness && !open && (
        <div className="mt-3 text-sm">
          <b>{profile.companyName}</b>
          <div className="text-xs text-[#6b756f]">CUI: {profile.companyCui}{profile.companyAddress ? ` · ${profile.companyAddress}` : ""}</div>
          <Button variant="outline" className="w-full mt-3" onClick={loadReport}>Vezi raportul de execuție</Button>
        </div>
      )}

      {open && (
        <div className="mt-4 border-t border-line pt-4">
          <Field label="Nume firmă">
            <input className={inputClass} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="ACME SRL" />
          </Field>
          <Field label="CUI">
            <input className={inputClass} value={companyCui} onChange={(e) => setCompanyCui(e.target.value)} placeholder="RO12345678" />
          </Field>
          <Field label="Adresă firmă (opțional)">
            <input className={inputClass} value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} />
          </Field>
          {msg && <p className="text-coral text-xs mt-1">{msg}</p>}
          <Button className="w-full mt-2" onClick={save} disabled={busy}>{busy ? "Se salvează..." : "Salvează contul business"}</Button>
        </div>
      )}

      {showReport && report && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex justify-between items-center mb-2">
            <b className="text-sm">Raport de execuție</b>
            <button onClick={() => setShowReport(false)} className="text-xs text-muted">Închide</button>
          </div>
          <div className="flex gap-3 mb-3">
            <div className="flex-1 bg-mist rounded-lg p-3"><div className="text-lg font-bold">{report.totalJobs}</div><div className="text-[11px] text-muted">lucrări</div></div>
            <div className="flex-1 bg-mist rounded-lg p-3"><div className="text-lg font-bold">{report.totalAmount} lei</div><div className="text-[11px] text-muted">total</div></div>
          </div>
          {report.rows.length === 0 ? (
            <p className="text-xs text-muted">Nicio lucrare finalizată încă.</p>
          ) : (
            <div className="divide-y divide-[#e2e8f0]">
              {report.rows.map((row) => (
                <div key={row.jobId} className="py-2 flex justify-between gap-2 text-xs">
                  <span className="min-w-0">
                    <b className="block truncate">{row.spaceType} · {row.city}</b>
                    <span className="text-[#6b756f]">{row.completedAt ? row.completedAt.slice(0, 10) : ""} · {row.firmName ?? "—"}</span>
                  </span>
                  <b className="flex-shrink-0">{row.priceGross} lei</b>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RatingBlock({ onSubmit }: { onSubmit: (stars: number, reviewText: string) => void }) {
  const [stars, setStars] = useState(0);
  const [reviewText, setReviewText] = useState("");
  return (
    <div className="space-y-3">
      <StarRating value={stars} onChange={setStars} />
      <label className="block text-sm font-bold text-ink">Recenzie opțională<textarea className={`${inputClass} mt-2 min-h-24 resize-y`} maxLength={2000} value={reviewText} onChange={event=>setReviewText(event.target.value)} placeholder="Spune pe scurt cum a fost experiența."/></label>
      <Button className="w-full" disabled={stars === 0} onClick={() => onSubmit(stars,reviewText)}>
        Trimite recenzia verificată
      </Button>
    </div>
  );
}
