"use client";
import {EntrancePicker} from "@/components/EntrancePicker";
import {validEntrance,type Entrance} from "@/lib/entrance";
import {VisitCare} from "@/components/VisitCare";
import {SeriesChanges} from "@/components/SeriesChanges";
import {RescheduleVisit} from '@/components/RescheduleVisit';
import { logoutWithNativePush } from "@/lib/nativePushClient";
import {bookingCalendarDays,bookingDateKey,bucharestDateKey,isBookableRomanianSlot,nextBucharestSlot} from "@/lib/scheduling";
import {BookingAddressLocation} from "@/components/BookingAddressLocation";
import {WindowsExtra} from "@/components/WindowsExtra";
import {saveBookingDraft,takeBookingDraft,clearBookingDraft} from "@/lib/bookingDraft";
import {ClientCards,type ClientCardView} from "@/components/ClientCards";
import {EmailVerificationNotice} from "@/components/EmailVerificationNotice";

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
  calcWindowsPrice,
  validWindowsSqm,
  priceExplanation,
  PRICING_VERSION,
  SLOT_HOURS,
  formatInterval,
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
  preferred_firm_id?:string|null;
  preferred_firm_name?:string|null;
  next_visit_at?: string|null;
  hour: number;
  details: string | null;
  schedule_revision: string;
  upcoming_dates: string[];
  end_date?: string|null;
  pause_start?: string|null;
  pause_end?: string|null;
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
  const [hostEventId,setHostEventId]=useState<string|null>(null),[hostRevision,setHostRevision]=useState<string|null>(null);
  const [propertyId,setPropertyId]=useState<string|null>(null);
  const requestRef=useRef<{payload:string;id:string}|null>(null);
  const [showBooking,setShowBooking]=useState(false);
  const [historyFilter,setHistoryFilter]=useState("");
  const [cardConfigured,setCardConfigured]=useState(false);
  const [entrance,setEntrance]=useState<Entrance|null>(null);
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [floor, setFloor] = useState("");
  const [details,setDetails]=useState("");
  const [windowsSqm,setWindowsSqm]=useState(0);
  const [sqm, setSqm] = useState(75);
  const [spaceType, setSpaceType] = useState<SpaceType>("apartament");
  const [whenType, setWhenType] = useState<"asap" | "scheduled">("asap");
  const [mode, setMode] = useState<"express" | "standard">("standard");
  const [express60, setExpress60] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(()=>bucharestDateKey(new Date()));
  const [calendarNow,setCalendarNow]=useState(()=>new Date());
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
  const [ratingDone, setRatingDone] = useState(false);
  const [myJobs, setMyJobs] = useState<JobRow[]>([]);
  const [offers, setOffers] = useState<OfferView[]>([]);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [guaranteeEligible, setGuaranteeEligible] = useState(false);
  const [hasCard, setHasCard] = useState<boolean | null>(null); // null = se încarcă
  const [cards,setCards]=useState<ClientCardView[]>([]);
  const [selectedCardId,setSelectedCardId]=useState<string|null>(null);
  const restoredCardId=useRef<string|null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardNotice, setCardNotice] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [draftNotice,setDraftNotice]=useState<string|null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== "client") router.replace(`/login?next=${encodeURIComponent(window.location.pathname+window.location.search+window.location.hash)}`);
  }, [loading, user, router]);

  useEffect(() => {
    if(user?.role!=="client")return;
    const params=new URLSearchParams(window.location.search);
    if(['added','cancelled'].includes(params.get('card')??'')){
      let draft=null;
      try{draft=takeBookingDraft(window.sessionStorage,user.id);}catch{/* Browser storage may be unavailable. */}
      if(draft){
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restore external tab storage only after the authenticated account is known
        setEntrance(draft.entrance??null);setStreet(draft.street);setPostalCode(draft.postalCode);setCity(draft.city);setFloor(draft.floor);setDetails(draft.details);
        setWindowsSqm(draft.windowsSqm??0);setSqm(draft.sqm);setSpaceType(draft.spaceType);setWhenType(draft.whenType);setMode(draft.mode);setExpress60(draft.express60);
        setScheduledDate(draft.scheduledDate);setScheduledHour(draft.scheduledHour);
        restoredCardId.current=draft.cardId??null;
        setHostEventId(draft.hostEventId??null);setHostRevision(draft.hostRevision??null);setPropertyId(draft.propertyId);setApprovalId(draft.approvalId);setPhotos(draft.photos);setShowBooking(true);
        setDraftNotice(params.get('card')==='cancelled'?'Adăugarea cardului a fost anulată. Rezervarea ta este păstrată.':'Rezervarea ta a fost restaurată. Verifică detaliile înainte de publicare.');
      }
    }
    if(window.location.hash==="#sec-form"||params.has("propertyId")||params.has("spaceType")||params.has("mode"))setShowBooking(true);
    const type=params.get("spaceType");if(type&&["apartament","casa","birou","altul"].includes(type))setSpaceType(type as SpaceType);
    const area=Number(params.get("sqm"));if(Number.isInteger(area)&&area>0&&area<=1000)setSqm(area);
    if(params.get("mode")==="express")setMode("express");
    if(params.has("windowsSqm")&&validWindowsSqm(Number(params.get("windowsSqm"))))setWindowsSqm(Number(params.get("windowsSqm")));
    const requestedCity=params.get("city");if(requestedCity)setCity(requestedCity.slice(0,100));
    const requestedDate=params.get("date"),requestedHour=Number(params.get("hour"));
    if(requestedDate&&bookingDateKey(requestedDate)===requestedDate){setWhenType("scheduled");setScheduledDate(requestedDate);if(params.has("hour")&&(SLOT_HOURS as readonly number[]).includes(requestedHour))setScheduledHour(requestedHour)}
    const approval=params.get("approvalId");if(approval){void fetch("/api/collaboration").then(r=>r.json()).then(d=>{const a=d.approvals?.find((a:{id:string;status:string})=>a.id===approval&&a.status==='approved');if(!a||!bookingDateKey(a.date)){setError("Aprobarea nu este disponibilă sau data ei este invalidă.");return}setApprovalId(a.id);setWhenType("scheduled");setScheduledDate(bookingDateKey(a.date)!);setScheduledHour(null)}).catch(()=>setError("Aprobarea nu a putut fi încărcată."))}
    const hostEvent=params.get('hostEventId'),hostVersion=params.get('hostRevision');
    if(hostEvent&&hostVersion&&/^[a-f0-9]{64}$/.test(hostVersion)){setHostEventId(hostEvent);setHostRevision(hostVersion);setMode('standard');setExpress60(false);}
    const id=params.get("propertyId");if(id){void fetch("/api/workspace").then(r=>{if(!r.ok)throw new Error();return r.json()}).then(d=>{const p=d.properties.find((p:{id:string})=>p.id===id);if(!p){setError("Proprietatea nu este disponibilă.");return}setPropertyId(p.id);setStreet(p.street);setPostalCode(p.postal_code??"");setFloor(p.floor??"");setCity(p.city);setSqm(p.sqm);setSpaceType(p.space_type);setTimeout(()=>document.getElementById("sec-form")?.scrollIntoView({behavior:"smooth",block:"start"}),60)}).catch(()=>setError("Proprietatea nu a putut fi încărcată."))}
  },[user?.id,user?.role]);

  const refreshMyJobs = useCallback(async () => {
    const response = await fetch("/api/jobs");
    if (!response.ok) return;
    const data = await response.json();
    setMyJobs(data.jobs ?? []);
    const params = new URLSearchParams(window.location.search);
    const requestedJob = params.get("jobId");
    if (requestedJob) {
      const ownedJob = (data.jobs ?? []).find((item: JobRow) => item.id === requestedJob);
      if (ownedJob) { setJob(ownedJob); setShowBooking(false); }
      else setError("Rezervarea nu este disponibilă în contul tău.");
      params.delete("jobId");
      window.history.replaceState({}, "", `/client${params.size ? `?${params}` : ""}${window.location.hash}`);
    }
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
          const confirmation = await fetch("/api/payments/card", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: params.get("session_id") }),
          });
          const result = await confirmation.json();
          if (cancelled) return;
          if (!confirmation.ok || !result.hasCard) {
            setCardError(result.error ?? "Cardul nou nu a putut fi confirmat. Reîncarcă pagina pentru a reîncerca.");
          } else {
            setCardNotice("Cardul a fost adăugat. Poți alege cu care card plătești următoarea lucrare.");
            const currentParams = new URLSearchParams(window.location.search);
            currentParams.delete("card"); currentParams.delete("session_id");
            window.history.replaceState({}, "", `/client${currentParams.size ? `?${currentParams}` : ""}${window.location.hash}`);
          }
        } else if (params.get("card") === "cancelled") {
          if (!cancelled) setCardNotice("Adăugarea a fost anulată. Cardurile tale sunt păstrate.");
        }
        const res = await fetch("/api/payments/card");
        if (!res.ok) throw new Error();
        const d = await res.json();
        if (cancelled) return;
        setCardConfigured(Boolean(d.stripeConfigured));
        setHasCard(Boolean(d.hasCard));
        const available:ClientCardView[]=d.cards??[];
        setCards(available);
        setSelectedCardId(current=>available.find(c=>c.id===(current??restoredCardId.current))?.id??available.find(c=>c.isDefault)?.id??available[0]?.id??null);
        restoredCardId.current=null;
      } catch {
        if (!cancelled) {setHasCard(null);setCardError("Starea cardului nu a putut fi verificată. Reîncarcă pagina.");}
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.role]);

  async function manageCard(cardId:string,method:"PATCH"|"DELETE") {
    if(cardBusy||submitting||uploading)return;
    setCardBusy(true);setCardError(null);setCardNotice(null);
    try {
      const res=await fetch("/api/payments/card",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({cardId})});
      const result=await res.json();if(!res.ok)throw new Error(result.error??"Operațiunea nu a reușit.");
      const updated=await fetch("/api/payments/card");if(!updated.ok)throw new Error("Reîncarcă pagina pentru a vedea lista actualizată.");
      const data=await updated.json();const available:ClientCardView[]=data.cards??[];
      setCards(available);setHasCard(Boolean(data.hasCard));
      setSelectedCardId(current=>available.find(c=>c.id===current)?.id??available.find(c=>c.isDefault)?.id??available[0]?.id??null);
      setCardNotice(method==="PATCH"?"Cardul implicit a fost actualizat pentru rezervările noi.":"Cardul a fost eliminat din lista ta.");
    } catch(error) {setCardError(error instanceof Error?error.message:"Operațiunea nu a reușit.");}
    finally {setCardBusy(false);}
  }

  async function addCard() {
    if (cardBusy || submitting || uploading || cards.length>=3) return;
    setCardError(null);
    setCardNotice(null);
    setCardBusy(true);
    try {
      const res = await fetch("/api/payments/checkout", { method: "POST" });
      const d = await res.json();
      if (!res.ok || !d.url) {
        setCardError(d.error ?? "Nu s-a putut porni adăugarea cardului.");
        setCardBusy(false);
        return;
      }
      if(showBooking){
        let saved=false;
        try{saved=Boolean(user&&saveBookingDraft(window.sessionStorage,user.id,{street,postalCode,city,floor,details,sqm,windowsSqm,spaceType,whenType,mode,express60,scheduledDate,scheduledHour,propertyId,approvalId,hostEventId,hostRevision,photos,cardId:selectedCardId,entrance:entrance&&validEntrance(entrance,{street,city,postalCode})?entrance:undefined}));}catch{/* Storage can be blocked by the browser. */}
        if(!saved){setCardError('Rezervarea nu poate fi păstrată în această filă. Permite stocarea pentru site și încearcă din nou.');setCardBusy(false);return;}
      }else{try{clearBookingDraft(window.sessionStorage);}catch{/* No draft to preserve. */}}
      window.location.href = d.url; // redirect către pagina de card găzduită de Stripe
    } catch {
      setCardError("Nu s-a putut porni adăugarea cardului.");
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
  const windowsValid=validWindowsSqm(windowsSqm);
  const windowsPrice=windowsValid?calcWindowsPrice(windowsSqm):0;
  const price = basePrice + windowsPrice + express60Fee;

  const creditBalance = user?.credit_balance ?? 0;
  const { finalPrice, creditUsed } = applyCredit(price, creditBalance);

  useEffect(()=>{
    const refresh=()=>setCalendarNow(new Date());
    const timer=window.setInterval(refresh,30000);
    window.addEventListener('focus',refresh);
    return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[]);
  const asapSlot=useMemo(()=>nextBucharestSlot(calendarNow),[calendarNow]);
  const next14Days=useMemo(()=>bookingCalendarDays(calendarNow,hostEventId?32:14),[calendarNow,hostEventId]);
  const scheduledSlotExpired=whenType==='scheduled'&&scheduledHour!==null&&!isBookableRomanianSlot(scheduledDate,scheduledHour,calendarNow);

  async function postJob() {
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        entrance:entrance&&validEntrance(entrance,{street,city,postalCode})?entrance:undefined,
        street,
        postalCode,
        city,
        windowsSqm,
        pricingVersion:PRICING_VERSION,
        expectedPriceGross:price,
        floor,
        sqm,
        spaceType,
        whenType,
        mode: express60Active ? "express" : mode,
        express60: express60Active,
        details,
        photoIds: photos.map((p) => p.id),
        propertyId,
        hostEventId,hostRevision,
        approvalId,
        ...(cardConfigured?{cardId:selectedCardId}:{}),
      };
      if (whenType === "scheduled") {
        if (scheduledHour === null) {
          setError("Alege un slot orar.");
          setSubmitting(false);
          return;
        }
        if(!isBookableRomanianSlot(scheduledDate,scheduledHour,new Date())){
          setError("Intervalul ales nu mai poate fi rezervat. Alege o oră cu minimum o oră înainte de începere, după ora României.");
          setCalendarNow(new Date());
          return;
        }
        body.scheduledDate = scheduledDate;
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
      setDraftNotice(null);
      try{clearBookingDraft(window.sessionStorage);}catch{/* Storage can be unavailable. */}
      requestRef.current=null;setHostEventId(null);setHostRevision(null);
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

  function requestGuarantee() {
    if(job)document.getElementById(`care-${job.id}`)?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function resetToForm() {
    setJob(null);
    setFirmName(null);
    setRatingDone(false);
    setPhotos([]);
    setDetails("");
    setDraftNotice(null);
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
    try { await logoutWithNativePush(); router.push("/login"); }
    catch (error) { setError(error instanceof Error ? error.message : "Ieșirea din cont nu a reușit."); }
  }

  if (loading || !user || user.role !== "client") {
    return (
      <div className="min-h-screen bg-mist flex items-center justify-center text-muted text-sm">
        Se încarcă...
      </div>
    );
  }

  const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="approved-client min-h-screen bg-[#f7f9fc] flex max-[760px]:block">
      <aside className="w-[236px] shrink-0 bg-white border-r border-[#e2e8f0] p-5 flex flex-col sticky top-0 h-screen max-[760px]:w-full max-[760px]:h-auto max-[760px]:relative max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:p-4">
        <div className="flex items-center justify-between">
          <Logo href="/client" onClick={()=>{setJob(null);setShowBooking(false);window.scrollTo(0,0)}} />
        </div>
        <WorkspaceNav role="client" onNavigate={href=>{if(href==='/client'||href.startsWith('/client#')){setJob(null);setShowBooking(false)}}}/>
        <div className="mt-auto max-[760px]:hidden"><div className="text-sm font-semibold">{user.name}</div><div className="text-xs text-[#6b756f] mt-1">{user.email}</div><button onClick={logout} className="text-xs text-[#64748b] mt-4">Ieși din cont</button></div>
      </aside>
      <main className="flex-1 min-w-0 px-8 py-8 max-[760px]:px-[22px] max-[760px]:pb-28">
        <div className="board-topbar"><span>Spațiul tău NITIDO</span><div><Link href="/client/mesaje" aria-label="Mesaje"><DesignIcon name="bell"/></Link><button type="button" className="account-profile-link" onClick={openProfileEditor} aria-label="Deschide profilul meu"><span className="board-avatar">{user.name.slice(0,1)}</span><b>{user.name}</b></button></div></div>
        <header className="board-greeting"><div><h1>Bună, {user.name.split(" ")[0]}!</h1><p>Mulțumim că faci parte din comunitatea NITIDO.RO.</p></div><span className="board-greeting-note"><DesignIcon name="sparkles"/>Un cămin curat este începutul<br/>unei zile mai bune.</span></header>
        {!job&&!showBooking&&<ClientOverview jobs={myJobs} onSelect={setJob} onBook={goToForm}/>}
        <EmailVerificationNotice/>
        {cardNotice && <p role="status" className="mb-4 rounded-xl border border-aqua bg-mist p-4 text-sm">{cardNotice}</p>}
        {cardError && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{cardError}</p>}
        {job&&<JobExecutionDetail job={job} firmName={firmName} onBack={()=>{setJob(null);setShowBooking(false)}}/>}
        <div className={`client-content-grid ${showBooking&&!job?"with-detail":""}`}>
        <div className="min-w-0">
        {myJobs.filter(j=>j.status==="waiting"&&["requires_action","requires_confirmation"].includes(j.authorizationStatus??"")).map(j=><section key={j.id} className="v2-card p-5 mb-4"><h2 className="font-bold">Confirmarea cardului este necesară</h2><p className="text-sm text-muted mt-2">{j.city} · {j.sqm} m². Banca solicită confirmarea autorizării pentru această lucrare.</p><Link href={`/client/plata/${encodeURIComponent(j.id)}`} className="inline-block mt-3 font-bold text-aqua-deep underline">Confirmă prin bancă</Link></section>)}
        {!job&&!showBooking&&myJobs.length>0&&<section id="sec-lucrari" className="v2-card p-5 mb-5"><div className="flex justify-between"><h2 className="font-bold">Rezervările tale recente</h2><span className="text-xs text-[#6b756f]">{myJobs.length} total</span></div><input aria-label="Caută rezervări" className={`${inputClass} mt-3`} value={historyFilter} onChange={e=>setHistoryFilter(e.target.value)} placeholder="Caută rezervare sau status…"/><div className="mt-3 divide-y divide-[#e2e8f0]">{myJobs.filter(item=>`${item.city} ${item.street} ${JOB_STATUS[item.status]}`.toLowerCase().includes(historyFilter.toLowerCase())).map(item=><button key={item.id} onClick={()=>setJob(item)} className="w-full py-3 flex items-center gap-3 text-left"><span className="w-10 h-10 rounded-lg bg-[var(--nitido-brand-soft)] flex items-center justify-center text-[var(--nitido-brand-dark)] font-bold">{item.space_type.slice(0,1).toUpperCase()}</span><span className="min-w-0 flex-1"><b className="text-sm block truncate">{item.space_type} · {item.city}</b><span className="text-xs text-[#6b756f]">{item.sqm} m² · {JOB_STATUS[item.status]}</span></span><b className="text-sm">{item.price_gross} lei</b></button>)}</div></section>}
        {!job && !showBooking && <RecurringSection defaults={{ street, postalCode, city, floor, sqm, spaceType }} />}
        {!job && !showBooking && <BusinessSection />}
        {!job && !showBooking && user?.referral_code && (
          <ReferralCard code={user.referral_code} creditBalance={creditBalance} />
        )}
        {!job && !showBooking && <div className="mb-5"><AppRatingCard /></div>}
        {!job && !showBooking && <section id="sec-mesaje" className="v2-card p-5 mb-5"><h2 className="font-bold">Mesaje &amp; suport</h2><p className="text-sm text-[#64748b] mt-2 leading-6">Ai o întrebare despre o lucrare sau despre cont? Echipa NITIDO îți răspunde rapid.</p><div className="mt-3 flex flex-col gap-1 text-sm"><a href="mailto:support@nitido.ro" className="text-[var(--nitido-brand-dark)] font-semibold">✉️ support@nitido.ro</a></div><Link href="/contact#asistent-ai" className="v2-btn v2-btn-secondary mt-4 inline-flex">Deschide asistentul NITIDO</Link></section>}
        {!job && !showBooking && <section id="sec-incredere" className="v2-card p-5 mb-5"><h2 className="font-bold">Încredere &amp; Siguranță</h2><ul className="text-sm text-[#64748b] mt-2 leading-6 list-disc pl-5 space-y-1"><li>Firme verificate în platformă, cu CUI validat la ANAF.</li><li>Autorizarea cardului și încasarea sunt etape distincte. Starea plății este afișată separat de starea lucrării.</li><li>Plata cardului e procesată securizat de Stripe — NITIDO nu îți vede datele cardului.</li><li>Urmărești lucrarea în timp real și primești dovezi foto la final.</li></ul><Link href="/incredere" className="v2-btn v2-btn-secondary mt-4 inline-flex">Vezi pagina completă</Link></section>}
        {!job && !showBooking && (
          <section id="sec-cont" className="v2-card p-5 mb-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold">Contul meu</h2>
              {!editingProfile && <button type="button" onClick={openProfileEditor} className="inline-flex items-center rounded-full border border-[#d8d7d0] px-3.5 py-1.5 text-sm font-semibold text-[var(--nitido-brand-dark)] transition-colors duration-150 hover:border-[var(--nitido-brand)] hover:bg-[var(--nitido-brand-soft)]">Editează profilul</button>}
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
        {!job && !showBooking && cardConfigured && (
          <div className="mb-5"><ClientCards cards={cards} selected={selectedCardId} loading={hasCard===null} busy={cardBusy||submitting||uploading}
            onSelect={setSelectedCardId} onDefault={id=>void manageCard(id,"PATCH")} onRemove={id=>void manageCard(id,"DELETE")} onAdd={addCard}/></div>
        )}
        <div id="sec-form" />
        {!job && showBooking && (
          <Card>
            {hostEventId&&<p role="status" className="mb-4 rounded-xl border border-aqua bg-mist p-4 text-sm">Curățenie între rezervări. Proprietatea și intervalul sunt verificate din nou la publicare. <Link href="/client/host" className="underline">Înapoi la calendar</Link></p>}
            {draftNotice&&<p role="status" className="mb-4 rounded-xl border border-aqua bg-mist p-4 text-sm">{draftNotice}</p>}
            <h1 className="font-display font-extrabold text-xl text-ink mb-1">
              Postează o lucrare
            </h1>
            <p className="text-sm text-muted mb-5 leading-relaxed">
              Completează detaliile — vezi prețul instant, apoi firmele din zonă primesc alerta.
            </p>

            <Field label="Instrucțiuni speciale (opțional)"><textarea className={inputClass} rows={3} maxLength={500} value={details} onChange={e=>setDetails(e.target.value)} placeholder="Materiale sensibile, animale de companie, preferințe de curățenie…"/><small>{details.length}/500 · Vizibile firmei după alocare. Nu introduce coduri de acces sau parole.</small></Field>
            <BookingAddressLocation address={{city,street,postalCode}} onDetected={value=>{setCity(value.city);setStreet(value.street);setPostalCode(value.postalCode)}} enabled={!propertyId&&!hostEventId&&!new URLSearchParams(typeof window!=="undefined"?window.location.search:"").has("propertyId")}/><Field label="Stradă și număr">
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
            <EntrancePicker key={JSON.stringify([street,city,postalCode])} address={{street,city,postalCode}} value={entrance} onChange={setEntrance}/>
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

            <WindowsExtra value={windowsSqm} onChange={setWindowsSqm}/>
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
                Primul interval estimat, după ora României:{" "}
                <b className="text-ink">
                  {new Intl.DateTimeFormat('ro-RO',{timeZone:'Europe/Bucharest',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(asapSlot)}
                </b>
              </div>
            )}

            {whenType === "scheduled" && (
              <div className="mb-3">
                <div className="flex gap-1.5 overflow-x-auto pb-1.5 mb-2">
                  {next14Days.map((d) => (
                    <button
                      type="button"
                      key={d}
                      aria-label={new Intl.DateTimeFormat('ro-RO',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${d}T12:00:00Z`))}
                      aria-pressed={d===scheduledDate}
                      onClick={() => {
                        setScheduledDate(d);
                        setScheduledHour(null);
                      }}
                      className={`flex-shrink-0 w-12 text-center py-2 rounded-lg border text-[11px] ${
                        d === scheduledDate
                          ? "border-aqua bg-aqua/10"
                          : "border-line"
                      }`}
                    >
                      {DAY_NAMES[new Date(`${d}T12:00:00Z`).getUTCDay()]}
                      <div className="font-display font-bold text-sm">{Number(d.slice(-2))}</div>
                    </button>
                  ))}
                </div>
                <p className="text-sm text-muted mb-2">Orele sunt cele din România. Disponibilitatea firmei se confirmă la alocare.</p>
                {scheduledSlotExpired&&<p role="status" className="text-sm text-red-700 mb-2">Intervalul selectat a expirat. Alege altă oră înainte de publicare.</p>}
                <div className="grid grid-cols-3 gap-1.5">
                  {SLOT_HOURS.map((h) => {
                    const valid = isBookableRomanianSlot(scheduledDate,h,calendarNow);
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
              <p className="text-sm mb-2">{priceExplanation(spaceType,sqm)}. Camerele nu se taxează separat.</p><p className="text-sm mb-2">Curățenie: {basePrice} lei · Geamuri: {windowsSqm} m² × 8 lei = {windowsPrice} lei</p>
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

            {!needsAssessment && cardConfigured && <div className="mb-4"><ClientCards booking cards={cards} selected={selectedCardId} loading={hasCard===null}
              busy={cardBusy||uploading||submitting} onSelect={setSelectedCardId} onDefault={id=>void manageCard(id,"PATCH")}
              onRemove={id=>void manageCard(id,"DELETE")} onAdd={addCard}/></div>}

            <Button className="w-full" onClick={postJob} disabled={!windowsValid || needsAssessment || submitting || cardBusy || (cardConfigured && (hasCard !== true || !selectedCardId)) || !street.trim() || !city.trim()}>
              {submitting ? "Se postează..." : "Postează lucrarea"}
            </Button>
          </Card>
        )}

        {job && <PublishedPriceBreakdown snapshot={job.pricing_snapshot}/>}
        {job&&!job.express_60&&<RescheduleVisit key={job.id} jobId={job.id} scheduledAt={job.scheduled_at} status={job.status} role="client" onChanged={async()=>{const r=await fetch(`/api/jobs/${encodeURIComponent(job.id)}`);if(r.ok)setJob((await r.json()).job)}}/>}
        {job&&job.accepted_firm_id&&<VisitCare key={job.id} jobId={job.id}/>}
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
                        </div>
                        <div className="offer-price"><b>{job.price_gross} lei</b><span>Preț fix pentru această solicitare</span></div>
                        {o.message && (
                          <p className="text-sm text-muted mt-2 border-t border-line pt-2">{o.message}</p>
                        )}
                        <Button className="offer-select-button" onClick={() => chooseOffer(o.offerId)} disabled={choosing !== null}>
                          {choosing === o.offerId ? "Se alege…" : "Alege această firmă"}
                        </Button>
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
                    Interval rezervat: {formatInterval(new Date(job.scheduled_at), job.duration_minutes + job.buffer_minutes)}
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
                  Sesizează problema în 48h de la finalizare. Firma propune revenirea gratuită, iar tu confirmi intervalul.
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
  const [address, setAddress] = useState(defaults);
  const [visitDetails, setVisitDetails] = useState("");
  const [preferredFirm,setPreferredFirm]=useState(''),[previousFirms,setPreviousFirms]=useState<Array<{id:string;name:string}>>([]);
  const [seriesPropertyId,setSeriesPropertyId]=useState('');
  const [savedProperties,setSavedProperties]=useState<Array<{id:string;name:string;street:string;city:string;postal_code:string;floor:string;sqm:number;space_type:SpaceType;notes:string;sensitive_materials:string;usual_tasks:string}>>([]);
  const [editing, setEditing] = useState<{plan: PlanView; frequency: PlanView["frequency"]; hour: number; startDate: string; endDate: string; details: string} | null>(null);
  const [pausePlan,setPausePlan]=useState("");
  const [pauseStart,setPauseStart]=useState("");
  const [pauseEnd,setPauseEnd]=useState("");
  const [pauseImpact,setPauseImpact]=useState<{planId:string;start:string;end:string;count:number;visits:Array<{job_id:string;scheduled_at:string;status:string;city:string}>}|null>(null);
  const [occurrences,setOccurrences]=useState<Array<{plan_id:string;occurrence_date:string;job_id:string;scheduled_at:string;status:string;city:string;preferred_firm_id:string|null;preferred_firm_name:string|null;preferred_offer_status:string|null;accepted_firm_id:string|null}>>([]);
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [open, setOpen] = useState(false);
  const [frequency, setFrequency] = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [startDate, setStartDate] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [endDate,setEndDate]=useState("");
  const [hour, setHour] = useState(10);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const creationRequest=useRef<{payload:string;id:string}|null>(null);
  const statusLock = useRef(false);
  const [statusBusy,setStatusBusy]=useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/recurring");
    if(!r.ok)throw new Error("Abonamentele nu au putut fi actualizate.");
    const data=await r.json();
    setPlans(data.plans??[]);setOccurrences(data.occurrences??[]);
    const properties=await fetch('/api/workspace');
    if(properties.ok){const workspace=await properties.json();setSavedProperties(workspace.properties??[]);setPreviousFirms(workspace.preferredFirms??[]);}
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- încărcare inițială a abonamentelor (client-only)
    void load().catch(()=>setMsg("Abonamentele nu au putut fi încărcate. Reîncarcă pagina."));
  }, [load]);

  async function create() {
    if(statusLock.current)return;
    statusLock.current=true;setBusy(true);setMsg(null);
    try {
      const input={...address,preferredFirmId:preferredFirm||null,propertyId:seriesPropertyId||null,details:visitDetails,frequency,hour,startDate,endDate:endDate||null};
      const payload=JSON.stringify(input);
      if(!creationRequest.current||creationRequest.current.payload!==payload)creationRequest.current={payload,id:crypto.randomUUID()};
      const r=await fetch("/api/recurring",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...input,requestId:creationRequest.current.id})});
      const d=await r.json();
      if(!r.ok)throw new Error(typeof d.error==="string"?d.error:"Nu s-a putut crea abonamentul.");
      if(typeof d.planId!=="string"||!d.planId)throw new Error("Crearea nu a fost confirmată. Verifică abonamentele înainte de a modifica formularul.");
      creationRequest.current=null;setOpen(false);
      try{await load();setMsg("Abonamentul a fost creat.")}
      catch{setMsg("Abonamentul a fost creat, dar lista nu s-a actualizat. Reîncarcă pagina pentru verificare.")}
    } catch(error){
      setMsg(error instanceof Error&&!(error instanceof TypeError)?error.message:"Crearea nu a fost confirmată. Reîncearcă fără să modifici datele sau verifică lista abonamentelor.");
    } finally {statusLock.current=false;setBusy(false)}
  }
  async function saveSchedule() {
    if (!editing || statusLock.current) return;
    statusLock.current = true; setStatusBusy(true); setMsg(null);
    try {
      const response = await fetch(`/api/recurring/${encodeURIComponent(editing.plan.id)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({action: "update_schedule", revision: editing.plan.schedule_revision,
          frequency: editing.frequency, hour: editing.hour, startDate: editing.startDate,
          endDate: editing.endDate || null, details: editing.details}),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(result.error || "Programul nu a fost salvat.");
      setEditing(null);
      setMsg("Programul a fost salvat pentru vizitele încă negenerate. Rezervările existente își păstrează data și plata.");
      try { await load(); } catch { setMsg("Programul a fost salvat. Reîncarcă pagina pentru lista actualizată."); }
    } catch (error) { setMsg(error instanceof Error ? error.message : "Salvarea nu a fost confirmată. Reîncarcă lista înainte de a reîncerca."); }
    finally { statusLock.current = false; setStatusBusy(false); }
  }
  async function generateVisits(){
    if(statusLock.current||busy)return;
    if(!window.confirm("Generezi rezervările viitoare ale seriilor active, în orizontul configurat (implicit 30 de zile)? Fiecare va avea propria dată și propriul preț. Generarea nu alocă o firmă și nu autorizează cardul. Vizitele trecute și pauzele sunt omise."))return;
    statusLock.current=true;setStatusBusy(true);setMsg(null);
    try{
      const r=await fetch("/api/recurring",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"generate"})});
      const result=await r.json();
      if(!r.ok||result.ok!==true||!Number.isInteger(result.created)||result.created<0)throw new Error("Generarea nu a fost confirmată. Verifică istoricul înainte de reîncercare.");
      await load();
      setMsg(`${result.created} vizite create. Alocarea și plata se confirmă separat.${Array.isArray(result.blocked)&&result.blocked.length?" Serii blocate: "+result.blocked.map((item:{error:string})=>item.error).join(" "):""}`);
    }catch(cause){setMsg(cause instanceof Error?cause.message:"Generarea nu a fost confirmată. Verifică istoricul.")}
    finally{statusLock.current=false;setStatusBusy(false)}
  }
  async function schedulePause(){
    if(statusLock.current||!pausePlan||!pauseStart||!pauseEnd)return;
    statusLock.current=true;setStatusBusy(true);setMsg(null);setPauseImpact(null);
    try{
      const url=`/api/recurring/${encodeURIComponent(pausePlan)}`;
      const dates={startDate:pauseStart,endDate:pauseEnd};
      const preview=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"preview_pause",...dates})});
      const impact=await preview.json();
      if(!preview.ok||impact.ok!==true)throw new Error(impact.error||"Vizitele afectate nu au putut fi verificate.");
      if(impact.count>0){
        setPauseImpact({planId:pausePlan,start:pauseStart,end:pauseEnd,count:impact.count,visits:impact.visits});
        setMsg("Pauza nu a fost salvată. Gestionează vizitele active de mai jos, apoi verifică din nou intervalul.");return;
      }
      if(!window.confirm(`Nu există vizite active create în intervalul ${pauseStart} – ${pauseEnd}, inclusiv, ora României. Confirmi pauza? Înlocuiește intervalul anterior. Nu modifică plăți și nu recuperează retroactiv date omise. Situația este reverificată la salvare.`))return;
      const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"pause_interval",...dates})});
      const result=await response.json();
      if(!response.ok||result.ok!==true)throw new Error(result.error||"Pauza nu a fost confirmată.");
      setPausePlan("");setMsg("Intervalul de pauză a fost salvat. Seria continuă automat după interval.");
      try{await load()}catch{setMsg("Pauza a fost salvată, dar lista nu s-a reîncărcat. Reîncarcă pagina.")}
    }catch(error){setMsg(error instanceof Error?error.message:"Pauza nu a fost confirmată.")}
    finally{statusLock.current=false;setStatusBusy(false)}
  }
  async function removePause(plan: PlanView) {
    if(statusLock.current||busy||!plan.pause_start||!plan.pause_end)return;
    if(!window.confirm(`Elimini pauza ${plan.pause_start} – ${plan.pause_end}? Vizitele și plățile existente nu se modifică. Datele deja omise nu se recreează. Dacă abonamentul este pe pauză generală, trebuie să apeși separat Reia.`))return;
    statusLock.current=true;setStatusBusy(true);setMsg(null);
    try{
      const response=await fetch(`/api/recurring/${encodeURIComponent(plan.id)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"remove_pause",startDate:plan.pause_start,endDate:plan.pause_end})});
      const result=await response.json();
      if(!response.ok||result.ok!==true)throw new Error(result.error||"Eliminarea pauzei nu a fost confirmată.");
      setMsg("Pauza programată a fost eliminată. Nu au fost modificate vizite sau plăți și nu au fost recreate date omise.");
      try{await load()}catch{setMsg("Pauza a fost eliminată, dar lista nu s-a reîncărcat. Reîncarcă pagina pentru starea curentă.")}
    }catch(error){setMsg(error instanceof Error?error.message:"Eliminarea nu a fost confirmată. Reîncarcă lista înainte de a reîncerca.")}
    finally{statusLock.current=false;setStatusBusy(false)}
  }
  async function changeStatus(id: string, status: string) {
    if(statusLock.current)return;
    const explanation=status==="cancelled"
      ? "Anulezi definitiv abonamentul? Nu se vor mai genera vizite. Vizitele deja create rămân active și se gestionează separat din Rezervări. Această acțiune nu anulează plăți."
      : "Pui abonamentul pe pauză? Nu se vor genera vizite cât timp este pe pauză. Vizitele deja create rămân active și se gestionează separat din Rezervări.";
    if(status!=="active"&&!window.confirm(explanation))return;
    statusLock.current=true;setStatusBusy(true);setMsg(null);
    try{
      const response=await fetch(`/api/recurring/${id}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});
      const result=await response.json();
      if(!response.ok||result.ok!==true)throw new Error(typeof result.error==="string"?result.error:"Modificarea nu a fost confirmată.");
      await load();
      setMsg(status==="active"?"Abonamentul a fost reluat.":status==="paused"?"Abonamentul este pe pauză. Verifică separat vizitele deja create în Rezervări.":"Abonamentul a fost anulat. Verifică separat vizitele deja create în Rezervări.");
    }catch(cause){setMsg(cause instanceof Error?cause.message:"Nu am putut actualiza abonamentul. Încearcă din nou.")}
    finally{statusLock.current=false;setStatusBusy(false)}
  }

  return (
    <div className="v2-card p-5 mb-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">
          Rezervări recurente{" "}
          <span className="text-[11px] font-bold text-aqua-deep bg-aqua/10 rounded-full px-2 py-0.5 align-middle">Nitido Repeat</span>
        </h2>
        <button onClick={() => setOpen((o) => !o)} className="text-xs font-display font-bold text-aqua-deep">
          {open ? "Închide" : "+ Adaugă"}
        </button>
      </div>
      <p className="text-xs text-muted mt-1">Vizite la interval fix, generate anticipat. Firmele pot trimite candidaturi; alegerea firmei și autorizarea cardului se deschid cu 48 de ore înainte de vizită. Deschiderea listei nu generează lucrări.</p>

      <button type="button" disabled={statusBusy||busy} onClick={()=>void generateVisits()} className="mt-3 text-sm font-bold text-aqua-deep disabled:opacity-50">Generează rezervările viitoare</button>
      {msg && <p role="status" className="text-sm mt-3">{msg}</p>}
      {plans.length > 0 && (
        <div className="mt-3 divide-y divide-[#e2e8f0]">
          {plans.map((p) => (
            <div key={p.id} className="py-3 flex flex-wrap items-center gap-3">
              <span className="w-10 h-10 rounded-lg bg-[var(--nitido-brand-soft)] flex items-center justify-center text-[var(--nitido-brand-dark)] font-bold">↻</span>
              <span className="min-w-0 flex-1">
                {p.end_date&&<span className="block text-xs text-muted">Ultima zi a seriei: {p.end_date} inclusiv</span>}
                {p.pause_start&&p.pause_end&&<span className="block text-xs text-aqua-deep">Pauză programată: {p.pause_start} – {p.pause_end} inclusiv<button type="button" disabled={statusBusy||busy} onClick={()=>void removePause(p)} className="block mt-2 underline disabled:opacity-50">Elimină pauza programată</button></span>}
                <label className="block text-xs my-2">Firma preferată<select className={inputClass} disabled={statusBusy||busy} value={p.preferred_firm_id??''} onChange={async e=>{const firmId=e.target.value||null;setStatusBusy(true);try{const r=await fetch(`/api/recurring/${encodeURIComponent(p.id)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'preferred_firm',firmId})});const d=await r.json();if(!r.ok)throw Error(d.error);await load();setMsg('Preferința a fost salvată. Firmele deja alocate rămân neschimbate.')}catch(e){setMsg(e instanceof Error?e.message:'Salvarea a eșuat.')}finally{setStatusBusy(false)}}}><option value="">Aleg la fiecare vizită</option>{previousFirms.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}{p.preferred_firm_id&&!previousFirms.some(f=>f.id===p.preferred_firm_id)&&<option value={p.preferred_firm_id}>{p.preferred_firm_name??'Firmă indisponibilă'}</option>}</select></label>
                <b className="text-sm block truncate">{FREQ_LABELS[p.frequency]} · {p.space_type} · {p.city}</b>
                <span className="text-xs text-[#6b756f]">{p.next_visit_at?`Următoarea vizită: ${new Intl.DateTimeFormat('ro-RO',{timeZone:'Europe/Bucharest',dateStyle:'medium',timeStyle:'short'}).format(new Date(p.next_visit_at))}`:p.end_date&&p.next_run_date>p.end_date?"Generarea seriei s-a încheiat":`Următoarea dată de generat: ${p.next_run_date}`} · {p.status === "active" ? "activ" : p.status === "paused" ? "pe pauză" : p.status}</span>
                <span className="block text-xs text-muted">Ora {String(p.hour).padStart(2,"0")}:00 · ora României</span>
              </span>
              {p.status !== "cancelled" && (
                <span className="flex flex-wrap gap-3">
                  <button type="button" disabled={statusBusy||busy} onClick={() => setEditing({plan:p,frequency:p.frequency,hour:p.hour,startDate:p.next_run_date,endDate:p.end_date??"",details:p.details??""})} className="text-xs font-bold text-aqua-deep">Modifică programul</button>
                  {p.status === "active" ? (
                    <button disabled={statusBusy} onClick={() => changeStatus(p.id, "paused")} className="text-xs font-bold text-muted">Pauză</button>
                  ) : (
                    <button disabled={statusBusy} onClick={() => changeStatus(p.id, "active")} className="text-xs font-bold text-aqua-deep">Reia</button>
                  )}
                  <button disabled={statusBusy} onClick={() => changeStatus(p.id, "cancelled")} className="text-xs font-bold text-coral">Anulează</button>
                </span>
              )}
              {!!p.upcoming_dates?.length && <details className="basis-full rounded-lg bg-aqua/5 p-3">
                <summary className="cursor-pointer text-sm font-bold">Date estimate în următoarele 30 de zile</summary>
                <p className="mt-2 text-xs text-muted">Calendar orientativ al vizitelor încă negenerate. Disponibilitatea firmei și plata se confirmă pentru fiecare rezervare.</p>
                <ul className="mt-2 flex flex-wrap gap-2">{p.upcoming_dates.map(date => <li key={date} className="rounded-lg bg-white px-3 py-2 text-xs">{new Intl.DateTimeFormat("ro-RO",{timeZone:"Europe/Bucharest",dateStyle:"medium",timeStyle:"short"}).format(new Date(date))}</li>)}</ul>
              </details>}
            </div>
          ))}
        </div>
      )}

      <SeriesChanges plans={plans} visits={occurrences} onSaved={load}/>
      {editing && <form className="mt-4 rounded-xl border border-line p-4" onSubmit={event => {event.preventDefault(); void saveSchedule();}}>
        <h3 className="font-bold">Modifică programul · {editing.plan.city}</h3>
        <p className="mt-2 text-xs text-muted">Se aplică doar vizitelor care nu au fost încă generate. Pentru o rezervare deja creată, deschide rezervarea din istoric. Pauzele programate rămân valabile.</p>
        <fieldset disabled={statusBusy||busy} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Frecvență<select className={inputClass} value={editing.frequency} onChange={event => setEditing({...editing,frequency:event.target.value as PlanView["frequency"]})}>{(["weekly","biweekly","monthly"] as const).map(value => <option key={value} value={value}>{FREQ_LABELS[value]}</option>)}</select></label>
          <label className="text-sm">Ora României<select className={inputClass} value={editing.hour} onChange={event => setEditing({...editing,hour:Number(event.target.value)})}>{SLOT_HOURS.map(value => <option key={value} value={value}>{String(value).padStart(2,"0")}:00</option>)}</select></label>
          <label className="text-sm">Prima dată din noul program<input required type="date" className={inputClass} min={editing.plan.next_run_date} value={editing.startDate} onChange={event => setEditing({...editing,startDate:event.target.value})}/></label>
          <label className="text-sm">Data de sfârșit (opțional)<input type="date" className={inputClass} min={editing.startDate} value={editing.endDate} onChange={event => setEditing({...editing,endDate:event.target.value})}/></label>
          <label className="text-sm sm:col-span-2">Preferințe pentru vizitele viitoare<textarea className={inputClass} maxLength={500} rows={3} value={editing.details} onChange={event => setEditing({...editing,details:event.target.value})}/></label>
        </fieldset>
        <p className="mt-2 text-xs text-muted">Pentru o zi lunară inexistentă se folosește ultima zi a lunii, apoi se revine la ziua inițială. Ora locală se păstrează și la schimbarea orei de vară.</p>
        <div className="mt-3 flex flex-wrap gap-3"><button type="submit" disabled={statusBusy||busy} className="rounded-lg bg-aqua px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{statusBusy?"Se salvează…":"Salvează programul"}</button><button type="button" disabled={statusBusy} className="px-3 py-2 text-sm" onClick={() => setEditing(null)}>Renunță</button></div>
      </form>}

      {plans.some(plan=>plan.status==="active")&&<details className="mt-4 border-t border-line pt-3">
        <summary className="cursor-pointer text-sm font-bold">Programează pauză pe interval</summary>
        <p className="text-xs text-muted mt-2">Interval inclusiv, ora României. Înlocuiește pauza programată anterior. Vizitele deja create trebuie gestionate separat din Rezervări. Datele omise nu se recuperează retroactiv.</p>
        <div className="grid gap-3 mt-3 sm:grid-cols-3">
          <label className="text-sm">Abonament<select className="block w-full border rounded p-2" value={pausePlan} onChange={event=>setPausePlan(event.target.value)} disabled={statusBusy}><option value="">Alege abonamentul</option>{plans.filter(plan=>plan.status==="active").map(plan=><option key={plan.id} value={plan.id}>{plan.city} · {FREQ_LABELS[plan.frequency]} · {plan.next_run_date}</option>)}</select></label>
          <label className="text-sm">Început pauză<input className="block w-full border rounded p-2" type="date" value={pauseStart} disabled={statusBusy} onChange={event=>setPauseStart(event.target.value)}/></label>
          <label className="text-sm">Sfârșit pauză<input className="block w-full border rounded p-2" type="date" value={pauseEnd} min={pauseStart} disabled={statusBusy} onChange={event=>setPauseEnd(event.target.value)}/></label>
        </div>
        <button type="button" className="mt-3 text-sm font-bold text-aqua-deep disabled:opacity-50" disabled={statusBusy||!pausePlan||!pauseStart||!pauseEnd} onClick={()=>void schedulePause()}>Verifică vizitele și continuă</button>
        {pauseImpact&&pauseImpact.planId===pausePlan&&pauseImpact.start===pauseStart&&pauseImpact.end===pauseEnd&&<div className="mt-3 rounded-xl border border-line p-3"><p className="text-sm font-bold">{pauseImpact.count} vizite active în interval</p><p className="text-xs text-muted mt-1">Sunt afișate cel mult 100 de vizite. Deschiderea rezervării nu o anulează și nu modifică plata.</p><ul className="divide-y divide-line">{pauseImpact.visits.map(visit=><li key={visit.job_id} className="py-2 text-sm"><span>{new Intl.DateTimeFormat("ro-RO",{timeZone:"Europe/Bucharest",dateStyle:"medium",timeStyle:"short"}).format(new Date(visit.scheduled_at))} · {visit.city} · {JOB_STATUS[visit.status]??visit.status}</span><Link className="block underline mt-1" href={`/client?jobId=${encodeURIComponent(visit.job_id)}`}>Deschide rezervarea</Link></li>)}</ul></div>}
      </details>}

      <details className="mt-4 border-t border-line pt-3">
        <summary className="cursor-pointer text-sm font-bold">Vizitele abonamentelor</summary>
        <p className="text-xs text-muted mt-2">Ultimele 200 de vizite înregistrate, inclusiv din abonamente anulate. Lucrările istorice fără legătură înregistrată rămân în Rezervări.</p>
        {occurrences.length===0?<p className="text-sm mt-3">Nicio vizită înregistrată în acest istoric.</p>:<ul className="divide-y divide-line">{occurrences.map(visit=><li key={visit.job_id} className="py-3 flex flex-wrap justify-between gap-3 text-sm"><span>{new Intl.DateTimeFormat("ro-RO",{timeZone:"Europe/Bucharest",dateStyle:"medium",timeStyle:"short"}).format(new Date(visit.scheduled_at))} · {visit.city}<span className="block text-xs text-muted">{JOB_STATUS[visit.status]??visit.status}</span>{visit.preferred_firm_id&&<span className="block text-xs mt-1">Firma preferată: {visit.preferred_firm_name??'Indisponibilă'} · {visit.accepted_firm_id===visit.preferred_firm_id?'confirmată pentru această vizită':visit.accepted_firm_id?'ai selectat o altă firmă':visit.preferred_offer_status==='pending'?'candidatură primită; verifică disponibilitatea la selectare':visit.preferred_offer_status==='rejected'||visit.preferred_offer_status==='withdrawn'?'candidatură retrasă sau respinsă; poți alege altă firmă':'așteaptă candidatura firmei; poți vedea alternative în rezervare'}</span>}</span><a className="font-bold text-aqua-deep" href={`/client?jobId=${encodeURIComponent(visit.job_id)}`}>Deschide rezervarea</a></li>)}</ul>}
      </details>
      {open && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-sm text-muted mb-3">Configurează spațiul pentru această serie de vizite.</p>
          <Field label="Firma preferată"><select className={inputClass} value={preferredFirm} onChange={e=>setPreferredFirm(e.target.value)}><option value="">Aleg firma pentru fiecare vizită</option>{previousFirms.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></Field><p className="text-xs text-muted my-2">Preferința nu garantează disponibilitatea. Firma confirmă prin candidatură, iar tu alegi și confirmi plata pentru fiecare vizită. Poți selecta explicit altă firmă dacă cea preferată nu este disponibilă.</p>
          <Field label="Proprietate salvată (opțional)"><select className={inputClass} value={seriesPropertyId} onChange={event=>{const id=event.target.value;setSeriesPropertyId(id);const property=savedProperties.find(p=>p.id===id);if(property){setAddress({street:property.street,city:property.city,postalCode:property.postal_code??'',floor:property.floor??'',sqm:property.sqm,spaceType:property.space_type});setVisitDetails('')}}}><option value="">Introdu adresa manual</option>{savedProperties.map(p=><option key={p.id} value={p.id}>{p.name} · {p.city}</option>)}</select></Field>
          {seriesPropertyId&&<div className="my-3 text-sm"><p>Preferințe salvate — selectează și adaptează instrucțiunile pentru această serie:</p><p className="whitespace-pre-wrap text-muted">{[savedProperties.find(p=>p.id===seriesPropertyId)?.notes,savedProperties.find(p=>p.id===seriesPropertyId)?.sensitive_materials,savedProperties.find(p=>p.id===seriesPropertyId)?.usual_tasks].filter(Boolean).join('\n')}</p><p className="text-xs mt-1">Instrucțiunile de acces nu sunt copiate automat.</p></div>}
          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            <Field label="Stradă și număr"><input className={inputClass} maxLength={300} value={address.street} onChange={event=>setAddress({...address,street:event.target.value})}/></Field>
            <Field label="Oraș"><input className={inputClass} maxLength={120} value={address.city} onChange={event=>setAddress({...address,city:event.target.value})}/></Field>
            <Field label="Cod poștal"><input className={inputClass} maxLength={30} value={address.postalCode} onChange={event=>setAddress({...address,postalCode:event.target.value})}/></Field>
            <Field label="Etaj"><input className={inputClass} maxLength={100} value={address.floor} onChange={event=>setAddress({...address,floor:event.target.value})}/></Field>
            <Field label="Suprafață, m²"><input className={inputClass} type="number" min={1} max={1000} step={1} value={address.sqm} onChange={event=>setAddress({...address,sqm:Number(event.target.value)})}/></Field>
            <Field label="Tip spațiu"><select className={inputClass} value={address.spaceType} onChange={event=>setAddress({...address,spaceType:event.target.value as SpaceType})}><option value="apartament">Apartament</option><option value="casa">Casă</option><option value="birou">Birou</option><option value="altul">Alt spațiu</option></select></Field>
          </div>
          <Field label="Preferințe pentru vizite"><textarea className={inputClass} maxLength={500} rows={3} value={visitDetails} onChange={event=>setVisitDetails(event.target.value)} placeholder="Materiale sensibile, animale de companie, preferințe de curățenie…"/></Field>
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
          
          <Field label="Data de sfârșit (opțional)">
            <input type="date" className={inputClass} min={startDate} value={endDate} onChange={event=>setEndDate(event.target.value)} />
          </Field>
          <p className="text-xs text-muted mt-2">Fără dată de sfârșit, seria continuă până o oprești. Data aleasă este inclusivă, în ora României; nu se generează vizite după ea. Pentru o zi lunară inexistentă se folosește ultima zi a lunii, apoi se revine la ziua inițială.</p>
          <Button className="w-full mt-3" onClick={create} disabled={busy||statusBusy}>
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
