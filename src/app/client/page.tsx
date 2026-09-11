"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Logo, Card, Field, inputClass, Button, StatusTrack, StarRating } from "@/components/ui";
import {
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

  const [street, setStreet] = useState("Str. Exemplu 12");
  const [postalCode, setPostalCode] = useState("900123");
  const [city, setCity] = useState("Constanța");
  const [floor, setFloor] = useState("3");
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
  const [ratingDone, setRatingDone] = useState(false);
  const [myJobs, setMyJobs] = useState<JobRow[]>([]);
  const [offers, setOffers] = useState<OfferView[]>([]);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [guaranteeEligible, setGuaranteeEligible] = useState(false);
  const [hasCard, setHasCard] = useState<boolean | null>(null); // null = se încarcă
  const [cardBusy, setCardBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== "client") router.replace("/login");
  }, [loading, user, router]);

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
        setHasCard(d.stripeConfigured ? Boolean(d.hasCard) : true);
      } catch {
        if (!cancelled) setHasCard(true); // în caz de eroare, nu blocăm UI-ul
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
        photoIds: photos.map((p) => p.id),
      };
      if (whenType === "scheduled") {
        if (scheduledHour === null) {
          setError("Alege un slot orar.");
          setSubmitting(false);
          return;
        }
        body.scheduledDate = scheduledDate.toISOString();
        body.scheduledHour = scheduledHour;
      }
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 402) setHasCard(false); // lipsă card — arată butonul de adăugare
      if (!res.ok) throw new Error(data.error ?? "Eroare la postare");
      setJob(data.job);
      refreshMyJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare necunoscută");
    } finally {
      setSubmitting(false);
    }
  }

  const poll = useCallback(async () => {
    if (!job) return;
    const res = await fetch(`/api/jobs/${job.id}`);
    if (!res.ok) return;
    const data = await res.json();
    setJob(data.job);
    setFirmName(data.firmName);
    // Lucrare Standard încă în așteptare → aducem ofertele primite de la firme.
    if (data.job?.status === "waiting" && data.job?.mode === "standard") {
      const oRes = await fetch(`/api/jobs/${job.id}/offers`);
      if (oRes.ok) setOffers((await oRes.json()).offers ?? []);
    }
  }, [job?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!job) return;
    if (["waiting", "accepted", "arrived"].includes(job.status)) {
      const t = setInterval(poll, 2000);
      return () => clearInterval(t);
    }
  }, [job?.status, job?.id, poll]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="min-h-screen bg-[#f4f3ee] flex max-[760px]:block">
      <aside className="w-[236px] shrink-0 bg-white border-r border-[#e3e2da] p-5 flex flex-col sticky top-0 h-screen max-[760px]:w-full max-[760px]:h-auto max-[760px]:relative max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:p-3">
        <Logo />
        <nav className="mt-10 space-y-2 text-sm font-semibold max-[760px]:mt-4 max-[760px]:flex max-[760px]:overflow-x-auto max-[760px]:space-y-0 max-[760px]:gap-2">
          <button type="button" onClick={()=>{resetToForm();window.scrollTo({top:0,behavior:"smooth"});}} className="text-left block rounded-[10px] bg-[#e9f2ec] text-[#14663a] px-4 py-3 whitespace-nowrap">Acasă</button><button type="button" onClick={()=>document.getElementById("sec-lucrari")?.scrollIntoView({behavior:"smooth"})} className="text-left block px-4 py-3 text-[#5c6660] whitespace-nowrap">Lucrările mele</button><button type="button" onClick={()=>document.getElementById("sec-mesaje")?.scrollIntoView({behavior:"smooth"})} className="text-left block px-4 py-3 text-[#5c6660] whitespace-nowrap">Mesaje</button><button type="button" onClick={()=>document.getElementById("sec-plata")?.scrollIntoView({behavior:"smooth"})} className="text-left block px-4 py-3 text-[#5c6660] whitespace-nowrap">Plăți</button><button type="button" onClick={()=>document.getElementById("sec-incredere")?.scrollIntoView({behavior:"smooth"})} className="text-left block px-4 py-3 text-[#5c6660] whitespace-nowrap">Încredere &amp; Siguranță</button><button type="button" onClick={()=>document.getElementById("sec-cont")?.scrollIntoView({behavior:"smooth"})} className="text-left block px-4 py-3 text-[#5c6660] whitespace-nowrap">Cont</button>
        </nav>
        <div id="sec-cont" className="mt-auto max-[760px]:mt-6"><div className="text-sm font-semibold">{user.name}</div><div className="text-xs text-[#6b756f] mt-1">{user.email}</div><button onClick={logout} className="text-xs text-[#5c6660] mt-4">Ieși din cont</button></div>
      </aside>
      <main className="flex-1 min-w-0 px-8 py-8 max-[760px]:px-[22px]">
        <header className="flex items-center justify-between gap-4"><div><div className="text-sm text-[#5c6660]">Bună, {user.name.split(" ")[0]}</div><h1 className="text-[26px] font-bold mt-1">Panoul tău NITIDO</h1></div><button onClick={resetToForm} className="v2-btn v2-btn-primary">Postează o lucrare</button></header>
        <section className="grid grid-cols-4 gap-4 mt-7 max-[1100px]:grid-cols-2"><Kpi value={String(myJobs.filter(j=>["accepted","arrived"].includes(j.status)).length)} label="În lucru"/><Kpi value={String(myJobs.filter(j=>j.status==="waiting").length)} label="În așteptare"/><Kpi value={String(myJobs.filter(j=>j.status==="completed").length)} label="Finalizate"/><Kpi value={String(myJobs.filter(j=>j.proofs?.some(p=>p.type==="COMPLETION")).length)} label="Dovezi finale"/></section>
        <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 mt-7 max-[1100px]:grid-cols-1">
        <div className="min-w-0">
        {myJobs.length>0&&<section id="sec-lucrari" className="v2-card p-5 mb-5"><div className="flex justify-between"><h2 className="font-bold">Lucrările mele</h2><span className="text-xs text-[#6b756f]">{myJobs.length} total</span></div><div className="mt-3 divide-y divide-[#e3e2da]">{myJobs.slice(0,5).map(item=><button key={item.id} onClick={()=>setJob(item)} className="w-full py-3 flex items-center gap-3 text-left"><span className="w-10 h-10 rounded-lg bg-[#e9f2ec] flex items-center justify-center text-[#14663a] font-bold">{item.space_type.slice(0,1).toUpperCase()}</span><span className="min-w-0 flex-1"><b className="text-sm block truncate">{item.space_type} · {item.city}</b><span className="text-xs text-[#6b756f]">{item.sqm} m² · {item.status}</span></span><b className="text-sm">{item.price_gross} lei</b></button>)}</div></section>}
        {!job && <RecurringSection defaults={{ street, postalCode, city, floor, sqm, spaceType }} />}
        {!job && <BusinessSection />}
        {!job && user?.referral_code && (
          <ReferralCard code={user.referral_code} creditBalance={creditBalance} />
        )}
        {!job && <div className="mb-5"><AppRatingCard /></div>}
        {!job && <section id="sec-mesaje" className="v2-card p-5 mb-5"><h2 className="font-bold">Mesaje &amp; suport</h2><p className="text-sm text-[#5c6660] mt-2 leading-6">Ai o întrebare despre o lucrare sau despre cont? Echipa NITIDO îți răspunde rapid.</p><div className="mt-3 flex flex-col gap-1 text-sm"><a href="tel:0341402403" className="text-[#14663a] font-semibold">📞 0341 402 403</a><a href="mailto:contact@nitido.ro" className="text-[#14663a] font-semibold">✉️ contact@nitido.ro</a></div><a href="/contact" target="_blank" rel="noopener noreferrer" className="v2-btn v2-btn-secondary mt-4 inline-flex">Deschide asistentul NITIDO</a></section>}
        {!job && <section id="sec-incredere" className="v2-card p-5 mb-5"><h2 className="font-bold">Încredere &amp; Siguranță</h2><ul className="text-sm text-[#5c6660] mt-2 leading-6 list-disc pl-5 space-y-1"><li>Firme verificate în platformă, cu CUI validat la ANAF.</li><li>Banii tăi stau în escrow și se eliberează firmei doar după ce confirmi finalizarea.</li><li>Plata cardului e procesată securizat de Stripe — NITIDO nu îți vede datele cardului.</li><li>Urmărești lucrarea în timp real și primești dovezi foto la final.</li></ul><a href="/incredere" target="_blank" rel="noopener noreferrer" className="v2-btn v2-btn-secondary mt-4 inline-flex">Vezi pagina completă</a></section>}
        {!job && (
          <Card>
            <h1 className="font-display font-extrabold text-xl text-ink mb-1">
              Postează o lucrare
            </h1>
            <p className="text-sm text-muted mb-5 leading-relaxed">
              Completează detaliile — vezi prețul instant, apoi firmele din zonă primesc alerta.
            </p>

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

            <div className="bg-mist border border-aqua rounded-xl p-3.5 my-4">
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
            </div>

            {error && <p className="text-coral text-xs mb-3">{error}</p>}

            {hasCard === false && (
              <div id="sec-plata" className="mb-3 rounded-xl border border-[#e3e2da] bg-[#f4f3ee] p-4">
                <div className="text-sm font-bold text-[#101711]">Adaugă un card pentru plată</div>
                <p className="text-xs text-[#5c6660] mt-1 leading-5">
                  Banii se rezervă abia când o firmă acceptă lucrarea și se încasează doar
                  după finalizarea confirmată. Cardul e procesat securizat de Stripe.
                </p>
                <Button className="w-full mt-3" onClick={addCard} disabled={cardBusy}>
                  {cardBusy ? "Se deschide..." : "Adaugă card"}
                </Button>
              </div>
            )}
            {hasCard === true && (
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-[#14663a]">
                <span>✓</span> Card salvat — plată securizată
              </p>
            )}

            <Button className="w-full" onClick={postJob} disabled={submitting || hasCard === false}>
              {submitting ? "Se postează..." : "Postează lucrarea"}
            </Button>
          </Card>
        )}

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
                  <div className="space-y-3">
                    <div className="text-[11px] uppercase tracking-wide text-aqua-deep font-bold">
                      {offers.length} {offers.length === 1 ? "ofertă primită" : "oferte primite"}
                    </div>
                    {offers.map((o) => (
                      <div key={o.offerId} className="rounded-xl border border-line p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="font-display font-bold text-sm text-ink truncate">{o.firmName}</div>
                              <span className="flex-shrink-0 text-[10px] font-display font-bold text-aqua-deep bg-aqua/10 rounded-full px-2 py-0.5" title="Nitido Quality Index">Scor {o.qualityScore}</span>
                            </div>
                            <div className="text-[11.5px] text-muted mt-0.5">
                              {o.ratingAvg != null ? `★ ${o.ratingAvg.toFixed(1)} (${o.ratingCount})` : "firmă nouă"} · {o.completedJobs} lucrări finalizate
                            </div>
                          </div>
                          <Button onClick={() => chooseOffer(o.offerId)} disabled={choosing !== null}>
                            {choosing === o.offerId ? "Se alege…" : "Alege"}
                          </Button>
                        </div>
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
            <ProofGallery proofs={job.proofs ?? []}/>
          </Card>
        )}

        {job && (job.status === "accepted" || job.status === "arrived") && (
          <Card>
            <h1 className="font-display font-extrabold text-xl text-ink mb-1">
              Lucrare confirmată ✅
            </h1>
            <p className="text-sm text-muted mb-2">
              Firma <b className="text-ink">{firmName ?? "..."}</b> a acceptat lucrarea ta.
            </p>
            <StatusTrack
              steps={[
                { label: "Alertă trimisă către firme", done: true },
                { label: `Acceptată de ${firmName ?? "firmă"}`, done: true },
                {
                  label: job.status === "arrived" ? "Firma a ajuns" : "Așteaptă sosirea firmei",
                  done: job.status === "arrived",
                },
              ]}
            />
            <ProofGallery proofs={job.proofs ?? []}/>
          </Card>
        )}

        {job && job.status === "completed" && !ratingDone && !job.ownReview && (
          <Card>
            <h1 className="font-display font-bold text-lg text-ink text-center mb-1">
              Cum a fost curățenia?
            </h1>
            <p className="text-sm text-muted text-center mb-2">
              {firmName ?? "Firma"} a finalizat lucrarea. Lasă un rating — plata se procesează abia
              acum.
            </p>
            <ProofGallery proofs={job.proofs ?? []}/>
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
              Lucrarea a fost anulată automat. Nu s-a reținut nicio sumă — hold-ul a fost eliberat.
            </p>
            <Button className="w-full" onClick={resetToForm}>
              Repostează lucrarea
            </Button>
          </Card>
        )}

        {job && job.status === "cancelled" && (
          <Card>
            <h1 className="font-display font-bold text-lg text-ink mb-2">Firma a renunțat — am repus lucrarea</h1>
            <p className="text-sm text-muted mb-4">
              Nu s-a reținut nicio sumă. Prin <b>Job Rescue</b> am repus automat lucrarea pentru o altă firmă — o găsești în „Lucrările mele”.
            </p>
            <Button className="w-full" onClick={resetToForm}>Înapoi la panou</Button>
          </Card>
        )}
        </div>
        <aside className="space-y-4">
          <div className="bg-[#101711] text-white rounded-[18px] p-6"><div className="text-xs text-[#8fd8ae] font-bold">LUCRAREA DE AZI</div><h2 className="text-xl font-bold mt-2">{job?`${job.space_type} · ${job.city}`:"Nicio lucrare activă"}</h2><div className="mt-6 space-y-4 text-sm">{["Firma alocată","Echipa a ajuns","Curățenie în progres","Confirmare finală"].map((x,i)=><div className="flex gap-3" key={x}><span className={`w-3 h-3 rounded-full mt-1 ${job&&i<3?"bg-[#39c97c]":"bg-[#2a332c]"}`}/><span className={i===2?"font-bold":"text-[#a8b2ac]"}>{x}</span></div>)}</div><div className="flex justify-between mt-6 text-sm"><span>Progres</span><b>66%</b></div><div className="h-2 bg-[#2a332c] rounded-full mt-2"><div className="h-full bg-[#39c97c] w-2/3 rounded-full"/></div><div className="text-xs text-[#8b958f] mt-2">6 din 9 pași</div></div>
          <div className="v2-card p-5"><div className="text-xs text-[#14663a] font-bold">ESCROW</div><div className="text-3xl font-bold mt-2">{job?.price_gross ?? 500} lei</div><p className="text-sm text-[#5c6660] mt-2">Suma rămâne rezervată până confirmi finalizarea.</p><div aria-disabled="true" className="v2-btn w-full mt-5 bg-[#edece6] text-[#9aa39d] cursor-not-allowed">Disponibilă după finalizarea lucrării</div></div>
        </aside>
        </div>
      </main>
    </div>
  );
}

function Kpi({value,label}:{value:string;label:string}) { return <div className="v2-card p-5"><div className="text-[26px] font-bold">{value}</div><div className="text-sm text-[#6b756f] mt-1">{label}</div></div> }

function ProofGallery({proofs}:{proofs:NonNullable<JobRow["proofs"]>}) {
  if (!proofs.length) return null;
  return <div className="mt-4 grid grid-cols-2 gap-3">{proofs.map(proof=><a key={proof.id} href={proof.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-line bg-white"><Image src={proof.url} alt={proof.type==="ARRIVAL"?"Echipa a ajuns — fotografie de confirmare":"Lucrare finalizată — dovadă foto"} width={320} height={180} className="h-28 w-full object-cover"/><span className="block p-2 text-[11px] font-bold text-ink">{proof.type==="ARRIVAL"?"Echipa a ajuns":"Lucrare finalizată"}</span></a>)}</div>;
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
        <div className="mt-3 divide-y divide-[#e3e2da]">
          {plans.map((p) => (
            <div key={p.id} className="py-3 flex items-center gap-3">
              <span className="w-10 h-10 rounded-lg bg-[#e9f2ec] flex items-center justify-center text-[#14663a] font-bold">↻</span>
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
            <div className="divide-y divide-[#e3e2da]">
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
