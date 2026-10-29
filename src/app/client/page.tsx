"use client";
import {UiMoney,useDisplayMoney,ChargeAmount} from '@/components/UiMoney';
import {CleaningTypeChoice} from '@/components/CleaningTypeChoice';
import {CLEANING_DESCRIPTION,cleaningAssessmentUrl,validCleaningType,type CleaningType} from '@/lib/cleaningTypes';
import {RecurringSection} from '@/components/RecurringSection';
import {NewBadge} from '@/components/NewBadge';
import {PreferredFirmChoice} from '@/components/FavoriteFirms';
import type {FlexibleWindow} from "@/lib/flexibleShared";
import {validateFlexibleWindows} from "@/lib/flexibleShared";
import {FlexibleChoice} from "@/components/FlexibleChoice";
import {FlexibleClientPanel} from "@/components/FlexibleClientPanel";
import {AUTHORIZATION_NOTICE,confirmationOpensAt} from '@/lib/authorizationPolicy';
import {BOOKING_DURATION_NOTICE,BOOKING_TEAM_NOTICE} from "@/lib/bookingTerms";
import {CREDIT_POLICY_NOTICE} from "@/lib/referral";
import {calcServiceDuration,WINDOWS_RATE_LEI} from "@/lib/pricing";
import {UiSpaceType,UiText,UiElement,UiTemplate} from '@/components/UiText';
import {useLocale} from 'next-intl';
import {UiDate} from '@/components/UiDate';


import {AssistedEntry} from "@/components/AssistedJourney";
import {EntrancePicker} from "@/components/EntrancePicker";
import {validEntrance,type Entrance} from "@/lib/entrance";
import {VisitCare} from "@/components/VisitCare";

import {RescheduleVisit} from '@/components/RescheduleVisit';
import { logoutWithNativePush } from "@/lib/nativePushClient";
import {bookingCalendarDays,bookingDateKey,bucharestScheduledAt,bucharestDateKey,isBookableRomanianSlot,nextBucharestSlot} from "@/lib/scheduling";
import {BookingAddressLocation} from "@/components/BookingAddressLocation";
import {BathroomExtra} from "@/components/BathroomExtra";
import {WindowsExtra} from "@/components/WindowsExtra";
import {saveBookingDraft,takeBookingDraft,clearBookingDraft} from "@/lib/bookingDraft";
import {ClientCards,type ClientCardView} from "@/components/ClientCards";
import {EmailVerificationNotice} from "@/components/EmailVerificationNotice";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {PublishedPriceBreakdown} from "@/components/PublishedPriceBreakdown";
import {NewFeatures} from '@/components/NewFeatures';
import {ClientOverview} from "@/components/ClientOverview";
import {DesignIcon} from "@/components/DesignIcon";
import {WorkspaceNav} from "@/components/WorkspaceNav";
import {JobExecutionDetail} from "@/components/JobExecutionDetail";
import {JOB_STATUS} from "@/lib/workspaceShared";
import {OwnedHomePicker} from "@/components/OwnedHomePicker";
import {homeBookingValues} from "@/lib/homeBooking";
import {ReviewForm} from "@/components/ReviewForm";
import { Logo, Card, Field, inputClass, Button, StatusTrack } from "@/components/ui";
import {
  AUTOMATIC_MAX_SQM,
  calcGrossPrice,calcBathroomPrice,validBathroomCount,
  calcWindowsPrice,
  validWindowsSqm,
  priceExplanation,
  PRICING_VERSION,
  SLOT_HOURS,
  formatInterval,
  SpaceType,
} from "@/lib/pricing";
import { JobRow } from "@/lib/types";
import {FamilyBookingFields,FamilySharing,type BeneficiaryInput} from '@/components/FamilyBooking';
import type {BookingDraft} from '@/lib/bookingDraft';
import { useCurrentUser } from "@/lib/useCurrentUser";
import { applyCredit } from "@/lib/referral";
import { PROPERTY_TYPE_LABELS } from "@/lib/jobTypeLabels";
import { SCAN_ROOMS, scanRoomLabel } from "@/lib/nitidoScan";
import { EXPRESS_60_FEE_LEI } from "@/lib/express60";
import { AppRatingCard } from "@/components/AppRatingCard";
import { CLIENT_NAVIGATION_EVENT, isClientDashboardTarget } from "@/lib/clientNavigation";

const DAY_NAMES = ["Dum", "Lun", "Mar", "Mie", "Joi", "Vin", "Sâm"];

interface UploadedPhoto {
  id: string;
  url: string;
  room: string | null;
}

interface OfferView {
 flexible?:import("@/lib/flexibleScheduling").FlexibleProposal|null;
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
 const {text:currencyText}=useDisplayMoney();
 const locale=useLocale();

  const router = useRouter();
  const [loggingOut,setLoggingOut]=useState(false);
  const [logoutError,setLogoutError]=useState<string|null>(null);
  const logoutRunning=useRef(false);
  const { user, loading } = useCurrentUser();

  const [beneficiary,setBeneficiary]=useState<BeneficiaryInput|null>(null);
  const [weekSlot,setWeekSlot]=useState<BookingDraft['weekSlot']>(null);
  const [photoDraftId,setPhotoDraftId]=useState<string|null>(null);
  const [featureLoading,setFeatureLoading]=useState(false);
  const [approvalId,setApprovalId]=useState<string|null>(null);
  const [hostEventId,setHostEventId]=useState<string|null>(null),[hostRevision,setHostRevision]=useState<string|null>(null);
  const [propertyId,setPropertyId]=useState<string|null>(null);
  const requestRef=useRef<{payload:string;id:string;quoteId?:string}|null>(null);
  const [showBooking,setShowBooking]=useState(false);
  const [historyFilter,setHistoryFilter]=useState("");
  const [pendingNavigation,setPendingNavigation]=useState<{target:string}|null>(null);
  const [cardConfigured,setCardConfigured]=useState(false);
  const [entrance,setEntrance]=useState<Entrance|null>(null);
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [floor, setFloor] = useState("");
  const [alertBatchId,setAlertBatchId]=useState<string|null>(null);
  const [preferredFirmId,setPreferredFirmId]=useState<string|null>(null);
  const [repeatJobId,setRepeatJobId]=useState<string|null>(null);
  const [details,setDetails]=useState("");
  const [cleaningType,setCleaningType]=useState<CleaningType>('general');
  const [bathroomCount,setBathroomCount]=useState(1);
  const [windowsSqm,setWindowsSqm]=useState(0);
  const [sqm, setSqm] = useState(75);
  const [spaceType, setSpaceType] = useState<SpaceType>("apartament");
  const [flexibleWindows,setFlexibleWindows]=useState<FlexibleWindow[]|null>(null);
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
  const [confirmedOffer,setConfirmedOffer]=useState<{payload:string;id:string;expiresAt:string;pricing:{grossBani:number;creditBani:number;clientTotalBani:number;lines:{code:string;amountBani:number}[]}}|null>(null);
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
    function navigate(target: string) {
      if (!isClientDashboardTarget(target)) return;
      setJob(null);
      setFirmName(null);
      setShowBooking(false);
      setPendingNavigation({target});
    }
    const fromLocation = () => navigate(window.location.hash.slice(1));
    const fromTab = (event: Event) => {
      const target = (event as CustomEvent<unknown>).detail;
      if (typeof target === "string") navigate(target);
    };
    // A deep link can arrive before authentication has finished loading.
    fromLocation();
    window.addEventListener(CLIENT_NAVIGATION_EVENT, fromTab);
    window.addEventListener("hashchange", fromLocation);
    window.addEventListener("popstate", fromLocation);
    return () => {
      window.removeEventListener(CLIENT_NAVIGATION_EVENT, fromTab);
      window.removeEventListener("hashchange", fromLocation);
      window.removeEventListener("popstate", fromLocation);
    };
  }, []);

  useEffect(() => {
    if (!pendingNavigation || loading || user?.role !== "client") return;
    // Wait for React to mount sections hidden by a booking form or job detail.
    const frame = window.requestAnimationFrame(() => {
      if (pendingNavigation.target) {
        document.getElementById(pendingNavigation.target)?.scrollIntoView({behavior:"instant",block:"start"});
      } else {
        window.scrollTo({top:0,behavior:"instant"});
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingNavigation, loading, user?.role]);

  useEffect(() => {
    if(user?.role!=="client")return;
    const params=new URLSearchParams(window.location.search);
    if(['added','cancelled'].includes(params.get('card')??'')){
      let draft=null;
      try{draft=takeBookingDraft(window.sessionStorage,user.id);}catch{/* Browser storage may be unavailable. */}
      if(draft){
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restore external tab storage only after the authenticated account is known
        setEntrance(draft.entrance??null);setStreet(draft.street);setPostalCode(draft.postalCode);setCity(draft.city);setFloor(draft.floor);setDetails(draft.details);
        setCleaningType(draft.cleaningType??'general');setBathroomCount(draft.bathroomCount??1);setWindowsSqm(draft.windowsSqm??0);setSqm(draft.sqm);setSpaceType(draft.spaceType);setWhenType(draft.whenType);setMode(draft.mode);setExpress60(draft.express60);
        setAlertBatchId(draft.alertBatchId??null);setPreferredFirmId(draft.preferredFirmId??null);setRepeatJobId(draft.repeatJobId??null);setBeneficiary(draft.beneficiary??null);setWeekSlot(draft.weekSlot??null);setPhotoDraftId(draft.photoDraftId??null);setFlexibleWindows(draft.flexibleWindows??null);setScheduledDate(draft.scheduledDate);setScheduledHour(draft.scheduledHour);
        restoredCardId.current=draft.cardId??null;
        setHostEventId(draft.hostEventId??null);setHostRevision(draft.hostRevision??null);setPropertyId(draft.propertyId);setApprovalId(draft.approvalId);setPhotos(draft.photos);setShowBooking(true);
        setDraftNotice(params.get('card')==='cancelled'?'Adăugarea cardului a fost anulată. Rezervarea ta este păstrată.':'Rezervarea ta a fost restaurată. Verifică detaliile înainte de publicare.');
        return;
      }
    }
    if(params.get('forFamily')==='1')setBeneficiary({name:'',email:'',consent:false});
    if(params.has('photoDraftId')){setFeatureLoading(true);void fetch('/api/photo-scope/drafts/'+encodeURIComponent(params.get('photoDraftId')!)).then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error);setPhotoDraftId(b.draft.id);setDetails(b.draft.description);setPhotos(b.draft.photos)}).catch(e=>setError(e.message)).finally(()=>setFeatureLoading(false));}
    if(params.has('slotId')){setFeatureLoading(true);void fetch('/api/availability/week?'+params.toString()).then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error);const v=b.selection;setWeekSlot({slotId:v.slotId,revision:v.revision,startsAt:v.startsAt,firmName:v.firmName});setWhenType('scheduled');setMode('standard');setExpress60(false);setFlexibleWindows(null);setScheduledDate(bucharestDateKey(new Date(v.startsAt)));setScheduledHour(Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Bucharest',hour:'2-digit',hourCycle:'h23'}).format(new Date(v.startsAt))))}).catch(e=>setError(e.message)).finally(()=>setFeatureLoading(false));}
    if(window.location.hash==="#sec-form"||params.has("propertyId")||params.has("spaceType")||params.has("mode")||params.has("forFamily")||params.has("photoDraftId")||params.has("slotId"))setShowBooking(true);
    const selectedCleaning=params.get('cleaningType');if(selectedCleaning==='renovation'){router.replace(cleaningAssessmentUrl(params.get('city')??'',params.get('sqm')??''));return;}if(validCleaningType(selectedCleaning))setCleaningType(selectedCleaning);
    const type=params.get("spaceType");if(type&&["apartament","casa","birou","altul"].includes(type))setSpaceType(type as SpaceType);
    const area=Number(params.get("sqm"));if(Number.isInteger(area)&&area>0&&area<=1000)setSqm(area);
    if(params.get("mode")==="express")setMode("express");
    if(params.has("bathroomCount")&&validBathroomCount(Number(params.get("bathroomCount"))))setBathroomCount(Number(params.get("bathroomCount")));
    if(params.has("windowsSqm")&&validWindowsSqm(Number(params.get("windowsSqm"))))setWindowsSqm(Number(params.get("windowsSqm")));
    const requestedCity=params.get("city");if(requestedCity)setCity(requestedCity.slice(0,100));
    const requestedDate=params.get("date"),requestedHour=Number(params.get("hour"));
    if(requestedDate&&bookingDateKey(requestedDate)===requestedDate){setWhenType("scheduled");setScheduledDate(requestedDate);if(params.has("hour")&&(SLOT_HOURS as readonly number[]).includes(requestedHour))setScheduledHour(requestedHour)}
    if(params.get("flexibleWindows")){try{setFlexibleWindows(validateFlexibleWindows(JSON.parse(params.get("flexibleWindows")!)));setMode("standard");setExpress60(false);}catch{setError("Intervalele flexibile nu mai sunt valide. Alege alte intervale.");}}
    const approval=params.get("approvalId");if(approval){void fetch("/api/collaboration").then(r=>r.json()).then(d=>{const a=d.approvals?.find((a:{id:string;status:string})=>a.id===approval&&a.status==='approved');if(!a||!bookingDateKey(a.date)){setError("Aprobarea nu este disponibilă sau data ei este invalidă.");return}setApprovalId(a.id);setWhenType("scheduled");setScheduledDate(bookingDateKey(a.date)!);setScheduledHour(null)}).catch(()=>setError("Aprobarea nu a putut fi încărcată."))}
    const hostEvent=params.get('hostEventId'),hostVersion=params.get('hostRevision');
    if(hostEvent&&hostVersion&&/^[a-f0-9]{64}$/.test(hostVersion)){setHostEventId(hostEvent);setHostRevision(hostVersion);setMode('standard');setExpress60(false);}
    const id=params.get("propertyId");if(id){void fetch(hostEvent||approval?"/api/workspace":"/api/workspace?view=homes").then(r=>{if(!r.ok)throw new Error();return r.json()}).then(d=>{const p=d.properties.find((p:{id:string})=>p.id===id);if(!p){setError("Proprietatea nu este disponibilă.");return}const v=homeBookingValues(p,Object.fromEntries(params));setPropertyId(p.id);setStreet(v.street);setPostalCode(v.postalCode);setFloor(v.floor);setCity(v.city);setSqm(v.sqm);setSpaceType(v.spaceType);setBathroomCount(v.bathroomCount);setDetails(v.details);setTimeout(()=>document.getElementById("sec-form")?.scrollIntoView({behavior:"smooth",block:"start"}),60)}).catch(()=>setError("Proprietatea nu a putut fi încărcată."))}
  },[user?.id,user?.role,router]);

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
        try{saved=Boolean(user&&saveBookingDraft(window.sessionStorage,user.id,{cleaningType:cleaningType==='renovation'?undefined:cleaningType,alertBatchId,preferredFirmId,repeatJobId,beneficiary,weekSlot,photoDraftId,flexibleWindows,street,postalCode,city,floor,details,sqm,windowsSqm,bathroomCount,spaceType,whenType,mode,express60,scheduledDate,scheduledHour,propertyId,approvalId,hostEventId,hostRevision,photos,cardId:selectedCardId,entrance:entrance&&validEntrance(entrance,{street,city,postalCode})?entrance:undefined}));}catch{/* Storage can be blocked by the browser. */}
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

  const needsAssessment=cleaningType==='renovation'||sqm>AUTOMATIC_MAX_SQM;
  const basePrice = useMemo(() => {
    try {
      return cleaningType==='renovation'?0:calcGrossPrice(spaceType, sqm,cleaningType);
    } catch {
      return 0;
    }
  }, [spaceType, sqm,cleaningType]);

  // Express 60 adaugă suplimentul premium la prețul brut (doar pentru „asap").
  const express60Active = express60 && whenType === "asap";
  const express60Fee = express60Active ? EXPRESS_60_FEE_LEI : 0;
  const windowsValid=validWindowsSqm(windowsSqm);
  const windowsPrice=windowsValid?calcWindowsPrice(windowsSqm):0;
  const bathroomPrice=validBathroomCount(bathroomCount)?calcBathroomPrice(bathroomCount):0;
  const price = basePrice + windowsPrice + bathroomPrice + express60Fee;

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
    if(needsAssessment){setError('Tipul curățeniei necesită evaluare.');return;}
    if(!validBathroomCount(bathroomCount)){setError("Introdu numărul de băi, întreg între 0 și 20.");return;}
    if(featureLoading){setError('Așteaptă încărcarea detaliilor selectate.');return;}
    if(beneficiary&&(!beneficiary.name.trim()||!/^\S+@\S+\.\S+$/.test(beneficiary.email)||!beneficiary.consent)){setError('Completează numele, emailul și acordul beneficiarului.');return;}
    if(weekSlot&&(mode!=='standard'||express60||flexibleWindows||whenType!=='scheduled'||scheduledHour===null||bookingDateKey(scheduledDate)!==scheduledDate||bucharestScheduledAt(scheduledDate,scheduledHour).toISOString()!==weekSlot.startsAt)){setError('Programul ales diferă de intervalul firmei. Revino la intervalul selectat sau renunță la el înainte de publicare.');return;}
    setSubmitting(true);
    try {
      if(flexibleWindows)validateFlexibleWindows(flexibleWindows);
      const body: Record<string, unknown> = {
        alertBatchId,preferredFirmId,repeatJobId,beneficiary,weekSlot,photoDraftId,
        entrance:entrance&&validEntrance(entrance,{street,city,postalCode})?entrance:undefined,
        street,
        postalCode,
        city,
        windowsSqm,bathroomCount,flexibleWindows,cleaningType,
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
      const offerPayload=JSON.stringify(body);
      const retry=requestRef.current?.payload===offerPayload?requestRef.current:null;
      if(!retry&&(!confirmedOffer||confirmedOffer.payload!==offerPayload||Date.parse(confirmedOffer.expiresAt)<=Date.now())){
        const quoteResponse=await fetch('/api/jobs/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        const quoteData=await quoteResponse.json();
        if(!quoteResponse.ok){setConfirmedOffer(null);throw new Error(quoteData.error??'Oferta nu poate fi calculată.');}
        if(quoteData.managed){
          setConfirmedOffer({payload:offerPayload,id:quoteData.quote.id,expiresAt:quoteData.quote.expiresAt,pricing:quoteData.quote.pricing});
          setError('Verifică oferta de mai jos și apasă Confirmă oferta și postează.');
          return;
        }
        setConfirmedOffer(null);
      }
      if(confirmedOffer&&confirmedOffer.payload===offerPayload&&Date.parse(confirmedOffer.expiresAt)>Date.now())body.quoteId=confirmedOffer.id;
      if(retry?.quoteId)body.quoteId=retry.quoteId;
      const payload=offerPayload;
      if(requestRef.current?.payload!==payload)requestRef.current={payload,id:crypto.randomUUID(),quoteId:typeof body.quoteId==='string'?body.quoteId:undefined};
      body.clientRequestId=requestRef.current.id;
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": requestRef.current.id },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 402) setHasCard(false); // lipsă card — arată butonul de adăugare
      if (!res.ok) {if(res.status>=400&&res.status<500)requestRef.current=null;if(res.status===409)setConfirmedOffer(null);throw new Error(data.error ?? "Eroare la postare");}
      setConfirmedOffer(null);
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
  useEffect(()=>{
    if(!selectedJobId)return;
    const frame=window.requestAnimationFrame(()=>{
      const heading=document.querySelector<HTMLElement>('.execution-heading h1');
      heading?.focus({preventScroll:true});
      heading?.scrollIntoView({block:'start',behavior:'instant'});
    });
    return()=>window.cancelAnimationFrame(frame);
  },[selectedJobId]);
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

  async function chooseOffer(offerId: string,proposalId?:string) {
    if (!job) return;
    setError(null);
    setChoosing(offerId);
    try {
      const res = await fetch(`/api/jobs/${job.id}/offers/${offerId}`, { method: "POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({proposalId}) });
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
    const result=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(result.error||"Evaluarea nu a fost salvată. Reîncearcă.");
    setRatingDone(true);
    await poll(new AbortController().signal);
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
    if(logoutRunning.current)return;
    logoutRunning.current=true;setLoggingOut(true);setLogoutError(null);
    try { await logoutWithNativePush(); window.location.replace("/login"); }
    catch (error) { setLogoutError(error instanceof Error ? error.message : "Ieșirea din cont nu a reușit."); }
    finally {logoutRunning.current=false;setLoggingOut(false);}
  }

  if (loading || !user || user.role !== "client") {
    return (
      <div className="min-h-screen bg-mist flex items-center justify-center text-muted text-sm"><UiText text={"Se încarcă..."}/></div>
    );
  }

  return (
    <div className="approved-client min-h-screen bg-[#f7f9fc] flex max-[760px]:block">
      <aside className="w-[236px] shrink-0 bg-white border-r border-[#e2e8f0] p-5 flex flex-col sticky top-0 h-screen max-[760px]:w-full max-[760px]:h-auto max-[760px]:relative max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:p-4">
        <div className="flex items-center justify-between">
          <Logo />
        </div>
        <WorkspaceNav role="client" onNavigate={href=>{if(href==='/client'||href.startsWith('/client#')){setJob(null);setShowBooking(false)}}}/>
        <div className="mt-auto max-[760px]:hidden"><div className="text-sm font-semibold">{user.name}</div><div className="text-xs text-[#6b756f] mt-1">{user.email}</div><button type="button" onClick={logout} disabled={loggingOut} aria-busy={loggingOut} className="text-xs text-[#64748b] mt-4"><UiText text={loggingOut?"Se verifică…":"Ieși din cont"}/></button>{logoutError&&<p role="alert" className="mt-2 text-sm text-coral"><UiText text={logoutError}/></p>}</div>
      </aside>
      <main className="flex-1 min-w-0 px-8 py-8 max-[760px]:px-[22px] max-[760px]:pb-28">
        <div className="board-topbar"><span><UiText text={"Spațiul tău NITIDO"}/></span><div><UiElement as={Link} href="/client/mesaje" aria-label="Mesaje"><DesignIcon name="bell"/></UiElement><UiElement as="button" type="button" className="account-profile-link" onClick={openProfileEditor} aria-label="Deschide profilul meu"><span className="board-avatar">{user.name.slice(0,1)}</span><b>{user.name}</b></UiElement></div></div>
        {!job&&<header className="board-greeting"><div><h1><UiText text={"Bună, "}/>{user.name.split(" ")[0]}!</h1><p><UiText text={"Mulțumim că faci parte din comunitatea NITIDO.RO."}/></p></div><span className="board-greeting-note"><DesignIcon name="sparkles"/><UiText text={"Un cămin curat este începutul"}/><br/><UiText text={"unei zile mai bune."}/></span></header>}
        {!job&&!showBooking&&<NewFeatures compact/>}
        {!job&&!showBooking&&<AssistedEntry/>}
        {!job&&!showBooking&&<ClientOverview jobs={myJobs} onSelect={setJob} onBook={goToForm}/>}
        <EmailVerificationNotice/>
        {cardNotice && <p role="status" className="mb-4 rounded-xl border border-aqua bg-mist p-4 text-sm">{cardNotice}</p>}
        {cardError && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{cardError}</p>}
        {job&&<JobExecutionDetail job={job} firmName={firmName} onBack={()=>{setJob(null);setShowBooking(false);setPendingNavigation({target:"sec-lucrari"})}}/>}
        <div className={`client-content-grid ${showBooking&&!job?"with-detail":""}`}>
        <div className="min-w-0">
        {myJobs.filter(j=>j.status==="waiting"&&["requires_action","requires_confirmation"].includes(j.authorizationStatus??"")).map(j=><section key={j.id} className="v2-card p-5 mb-4"><h2 className="font-bold"><UiText text={"Confirmarea cardului este necesară"}/></h2><p className="text-sm text-muted mt-2">{j.city} · {j.sqm}<UiText text={" m². Banca solicită confirmarea autorizării pentru această lucrare."}/></p><Link href={`/client/plata/${encodeURIComponent(j.id)}`} className="inline-block mt-3 font-bold text-aqua-deep underline"><UiText text={"Confirmă prin bancă"}/></Link></section>)}
        {!job&&!showBooking&&<section id="sec-lucrari" className="v2-card p-5 mb-5"><div className="flex justify-between"><h2 className="font-bold"><UiText text={"Rezervările tale recente"}/></h2><span className="text-xs text-[#6b756f]">{myJobs.length}<UiText text={" total"}/></span></div>{myJobs.length===0?<div className="mt-4"><p className="text-sm text-muted"><UiText text={"Nu ai rezervări încă."}/></p><button type="button" className="v2-btn v2-btn-primary mt-4" onClick={goToForm}><UiText text={"Configurează o rezervare"}/></button></div>:<><UiElement as="input" aria-label="Caută rezervări" className={`${inputClass} mt-3`} value={historyFilter} onChange={e=>setHistoryFilter(e.target.value)} placeholder="Caută rezervare sau status…"/><div className="mt-3 divide-y divide-[#e2e8f0]">{myJobs.filter(item=>`${item.city} ${item.street} ${JOB_STATUS[item.status]}`.toLowerCase().includes(historyFilter.toLowerCase())).map(item=><div key={item.id}><button onClick={()=>setJob(item)} className="w-full py-3 flex items-center gap-3 text-left"><span className="w-10 h-10 rounded-lg bg-[var(--nitido-brand-soft)] flex items-center justify-center text-[var(--nitido-brand-dark)] font-bold">{item.space_type.slice(0,1).toUpperCase()}</span><span className="min-w-0 flex-1"><b className="text-sm block truncate"><UiSpaceType value={item.space_type}/> · {item.city}</b><span className="text-xs text-[#6b756f]">{item.sqm}<UiText text={" m² · "}/>{<UiText text={JOB_STATUS[item.status]}/>}</span></span><b className="text-sm"><UiMoney ron={item.price_gross}/></b></button>{item.status==="completed"&&<a className="inline-flex items-center gap-2 underline font-semibold min-h-11" href={"/client?repeatJobId="+encodeURIComponent(item.id)+"#sec-form"}><UiText text={"Rezervă din nou "}/><NewBadge/></a>}</div>)}</div></>}</section>}
        {!job && !showBooking && <RecurringSection defaults={{ street, postalCode, city, floor, sqm, spaceType }} />}
        {!job && !showBooking && <BusinessSection />}
        {!job && !showBooking && user?.referral_code && (
          <ReferralCard code={user.referral_code} creditBalance={creditBalance} />
        )}
        {!job && !showBooking && <div className="mb-5"><AppRatingCard /></div>}
        {!job && !showBooking && <section id="sec-mesaje" className="v2-card p-5 mb-5"><h2 className="font-bold"><UiText text={"Mesaje &amp; suport"}/></h2><p className="text-sm text-[#64748b] mt-2 leading-6"><UiText text={"Ai o întrebare despre o lucrare sau despre cont? Echipa NITIDO îți răspunde rapid."}/></p><div className="mt-3 flex flex-col gap-1 text-sm"><a href="mailto:support@nitido.ro" className="text-[var(--nitido-brand-dark)] font-semibold"><UiText text={"✉️ support@nitido.ro"}/></a></div><Link href="/contact#asistent-ai" className="v2-btn v2-btn-secondary mt-4 inline-flex"><UiText text={"Deschide asistentul NITIDO"}/></Link></section>}
        {!job && !showBooking && <section id="sec-incredere" className="v2-card p-5 mb-5"><h2 className="font-bold"><UiText text={"Încredere &amp; Siguranță"}/></h2><ul className="text-sm text-[#64748b] mt-2 leading-6 list-disc pl-5 space-y-1"><li><UiText text={"Firme verificate în platformă, cu CUI validat la ANAF."}/></li><li><UiText text={"Autorizarea cardului și încasarea sunt etape distincte. Starea plății este afișată separat de starea lucrării."}/></li><li><UiText text={"Plata cardului e procesată securizat de Stripe — NITIDO nu îți vede datele cardului."}/></li><li><UiText text={"Urmărești lucrarea în timp real și primești dovezi foto la final."}/></li></ul><Link href="/incredere" className="v2-btn v2-btn-secondary mt-4 inline-flex"><UiText text={"Vezi pagina completă"}/></Link></section>}
        {!job && !showBooking && (
          <section id="sec-cont" className="v2-card p-5 mb-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold"><UiText text={"Contul meu"}/></h2>
              {!editingProfile && <button type="button" onClick={openProfileEditor} className="inline-flex items-center rounded-full border border-[#d8d7d0] px-3.5 py-1.5 text-sm font-semibold text-[var(--nitido-brand-dark)] transition-colors duration-150 hover:border-[var(--nitido-brand)] hover:bg-[var(--nitido-brand-soft)]"><UiText text={"Editează profilul"}/></button>}
            </div>
            {!editingProfile ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
                <div><div className="text-[10.5px] uppercase tracking-wide text-[#6b756f] font-semibold"><UiText text={"Nume"}/></div><div className="text-ink mt-0.5">{user.name}</div></div>
                <div><div className="text-[10.5px] uppercase tracking-wide text-[#6b756f] font-semibold"><UiText text={"Email"}/></div><div className="text-ink mt-0.5 break-all">{user.email}</div></div>
                <div className="sm:col-span-2"><button type="button" onClick={logout} disabled={loggingOut} aria-busy={loggingOut} className="inline-flex items-center rounded-full border border-[#d8d7d0] px-3.5 py-1.5 text-sm font-semibold text-[#c0392b] transition-colors duration-150 hover:border-[#c0392b] hover:bg-[#fbeaea]"><UiText text={loggingOut?"Se verifică…":"Ieși din cont"}/></button>{logoutError&&<p role="alert" className="mt-2 text-sm text-coral"><UiText text={logoutError}/></p>}</div>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <label className="block text-sm"><span className="text-[#6b756f]"><UiText text={"Nume"}/></span><input className={inputClass} value={profileForm.name} onChange={(e)=>setProfileForm(f=>({...f,name:e.target.value}))} /></label>
                <label className="block text-sm"><span className="text-[#6b756f]"><UiText text={"Email"}/></span><input className={inputClass} value={profileForm.email} onChange={(e)=>setProfileForm(f=>({...f,email:e.target.value}))} /></label>
                <label className="block text-sm"><span className="text-[#6b756f]"><UiText text={"Telefon"}/></span><UiElement as="input" className={inputClass} value={profileForm.phone} onChange={(e)=>setProfileForm(f=>({...f,phone:e.target.value}))} placeholder="07xx xxx xxx" /></label>
                <p className="text-xs text-[#6b756f]"><UiText text={"Parola se schimbă din pagina „Am uitat parola”."}/></p>
                <div className="flex gap-2 pt-1">
                  <Button onClick={saveProfile} disabled={savingProfile}>{savingProfile?<UiText text={"Se salvează..."}/>:<UiText text={"Salvează"}/>}</Button>
                  <Button variant="outline" onClick={()=>setEditingProfile(false)} disabled={savingProfile}><UiText text={"Renunță"}/></Button>
                </div>
              </div>
            )}
            <Link href="/stergere-cont" className="mt-4 inline-flex text-sm underline"><UiText text={"Solicită ștergerea contului"}/></Link>
          </section>
        )}
        {!job && !showBooking && cardConfigured && (
          <div className="mb-5"><ClientCards cards={cards} selected={selectedCardId} loading={hasCard===null} busy={cardBusy||submitting||uploading}
            onSelect={setSelectedCardId} onDefault={id=>void manageCard(id,"PATCH")} onRemove={id=>void manageCard(id,"DELETE")} onAdd={addCard}/></div>
        )}
        <div id="sec-form" />
        {!job && showBooking && (
          <Card>
            {hostEventId&&<p role="status" className="mb-4 rounded-xl border border-aqua bg-mist p-4 text-sm"><UiText text={"Curățenie între rezervări. Proprietatea și intervalul sunt verificate din nou la publicare. "}/><Link href="/client/host" className="underline"><UiText text={"Înapoi la calendar"}/></Link></p>}
            {draftNotice&&<p role="status" className="mb-4 rounded-xl border border-aqua bg-mist p-4 text-sm">{draftNotice}</p>}
            <h1 className="font-display font-extrabold text-xl text-ink mb-1"><UiText text={"Postează o lucrare"}/></h1>
            <p className="text-sm text-muted mb-5 leading-relaxed"><UiText text={"Completează detaliile — vezi prețul înainte de publicare."}/></p><p className="text-sm text-muted mb-3"><UiText text={BOOKING_DURATION_NOTICE}/></p>{Number.isFinite(Number(sqm))&&Number(sqm)>0&&validWindowsSqm(windowsSqm)&&<p className="text-sm text-muted mb-3"><UiText text={"Intervenție programată la locație: "}/>{calcServiceDuration(Number(sqm),windowsSqm)}<UiText text={" minute, plus buffer separat."}/></p>}<p className="text-sm text-muted mb-3"><UiText text={BOOKING_TEAM_NOTICE}/></p><p className="text-sm text-muted mb-3"><UiText text={AUTHORIZATION_NOTICE}/></p><p className="text-sm text-muted mb-3"><UiText text={CREDIT_POLICY_NOTICE}/></p>

            {repeatJobId&&<p className="text-sm my-4"><UiText text={"Alegi un program nou și confirmi prețul actual înainte de publicare."}/></p>}
            <PreferredFirmChoice value={preferredFirmId} onChange={setPreferredFirmId}/>
            <FamilyBookingFields value={beneficiary} onChange={setBeneficiary}/>
            {featureLoading&&<p role="status"><UiText text={"Se încarcă detaliile selectate…"}/></p>}
            {photoDraftId&&<p className="rounded border p-3"><UiText text={"Descrierea și pozele au fost aduse din ciorna ta privată. Le poți corecta mai jos înainte de publicare."}/></p>}
            {weekSlot&&<div className="rounded border p-4 my-4"><b><UiText text={"Interval solicitat la "}/>{weekSlot.firmName}</b><p>{new Date(weekSlot.startsAt).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest'})}<UiText text={" · ora României. Cererea va fi adresată acestei firme, care trebuie să trimită candidatura. Alegerea ei rămâne la tine."}/></p><button type="button" className="underline min-h-11" onClick={()=>setWeekSlot(null)}><UiText text={"Renunță la interval și continuă cu o cerere obișnuită"}/></button></div>}
            <Field label="Instrucțiuni speciale (opțional)"><UiElement as="textarea" className={inputClass} rows={3} maxLength={propertyId?4000:500} value={details} onChange={e=>setDetails(e.target.value)} placeholder="Materiale sensibile, animale de companie, preferințe de curățenie…"/><small>{details.length}<UiText text={(propertyId?"/4000":"/500")+" · Vizibile firmei după alocare. Nu introduce coduri de acces sau parole."}/></small></Field>
            {!hostEventId&&!approvalId&&<OwnedHomePicker value={propertyId??''} onSelect={p=>{setPropertyId(p?.id??null);if(!p){setStreet('');setPostalCode('');setFloor('');setDetails('');return;}const v=homeBookingValues(p);setStreet(v.street);setPostalCode(v.postalCode);setFloor(v.floor);setCity(v.city);setSqm(v.sqm);setSpaceType(v.spaceType);setBathroomCount(v.bathroomCount);setDetails(v.details);}}/>}<BookingAddressLocation address={{city,street,postalCode}} onDetected={value=>{setCity(value.city);setStreet(value.street);setPostalCode(value.postalCode)}} enabled={!propertyId&&!hostEventId&&!new URLSearchParams(typeof window!=="undefined"?window.location.search:"").has("propertyId")}/><Field label="Stradă și număr">
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
            <CleaningTypeChoice value={cleaningType} onChange={value=>{if(value==='renovation')router.push(cleaningAssessmentUrl(city,sqm));else setCleaningType(value)}}/><Field label="Tip spațiu">
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

            <BathroomExtra value={bathroomCount} onChange={setBathroomCount}/>
            <WindowsExtra value={windowsSqm} onChange={setWindowsSqm}/>
            <span className="block text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-1"><UiText text={"Cum vrei să alegi firma?"}/></span>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setMode("standard")}
                className={`text-left p-3 rounded-xl border ${mode === "standard" ? "border-aqua bg-aqua/10" : "border-line"}`}
              >
                <span className="block font-display font-bold text-xs text-ink"><UiText text={"✦ Primesc oferte"}/></span>
                <span className="block text-[11px] text-muted mt-0.5 leading-tight"><UiText text={"Mai multe firme, aleg eu pe calitate. Recomandat."}/></span>
              </button>
              <button
                type="button"
                onClick={() => setMode("express")}
                className={`text-left p-3 rounded-xl border ${mode === "express" ? "border-coral bg-coral/10" : "border-line"}`}
              >
                <span className="block font-display font-bold text-xs text-ink"><UiText text={"⚡ Express (urgent)"}/></span>
                <span className="block text-[11px] text-muted mt-0.5 leading-tight"><UiText text={"Preluare de o firmă eligibilă, în funcție de disponibilitate și de acceptarea validă."}/></span>
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
                  <span className="font-display font-bold text-xs text-ink"><UiText text={"🔥 Express 60 · preluare în 60 min"}/></span>
                  <span className="font-display font-bold text-xs text-coral shrink-0">+<UiMoney ron={EXPRESS_60_FEE_LEI}/></span>
                </span>
                <span className="block text-[11px] text-muted mt-0.5 leading-tight"><UiText text={"Garantat: o firmă preia în 60 de minute, prioritate maximă. Dacă nu, nu plătești suplimentul."}/></span>
              </span>
            </button>
            {express60 && whenType !== "asap" && (
              <div className="text-[11px] text-coral bg-coral/5 rounded-lg px-3 py-2 mb-3"><UiText text={"Express 60 e disponibil doar pentru „Cât mai curând”. Alege-l mai jos."}/></div>
            )}

            {!hostEventId&&!approvalId&&<FlexibleChoice city={city} value={flexibleWindows} onChange={w=>{setFlexibleWindows(w);if(w){setMode('standard');setExpress60(false);setWhenType('scheduled');setScheduledDate(w[0].date);setScheduledHour(w[0].from);}}}/>}
            <span className="block text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-1"><UiText text={"Când?"}/></span>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => {setFlexibleWindows(null);setWhenType("asap");}}
                className={`flex-1 py-2.5 rounded-lg border font-display font-bold text-xs ${
                  whenType === "asap" ? "border-aqua bg-aqua/10 text-ink" : "border-line text-muted"
                }`}
              ><UiText text={"Cât mai curând"}/></button>
              <button
                type="button"
                onClick={() => {setFlexibleWindows(null);setWhenType("scheduled");}}
                className={`flex-1 py-2.5 rounded-lg border font-display font-bold text-xs ${
                  whenType === "scheduled" ? "border-aqua bg-aqua/10 text-ink" : "border-line text-muted"
                }`}
              ><UiText text={"Aleg data"}/></button>
            </div>

            {whenType === "asap" && asapSlot && (
              <div className="text-xs text-muted bg-mist rounded-lg px-3 py-2.5 mb-3"><UiText text={"Primul interval estimat, după ora României:"}/>{" "}
                <b className="text-ink">
                  {new Intl.DateTimeFormat(locale,{timeZone:'Europe/Bucharest',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(asapSlot)}
                </b>
              </div>
            )}

            {whenType === "scheduled" && !flexibleWindows && (
              <div className="mb-3">
                <div className="flex gap-1.5 overflow-x-auto pb-1.5 mb-2">
                  {next14Days.map((d) => (
                    <UiElement as="button"
                      type="button"
                      key={d}
                      aria-label={new Intl.DateTimeFormat(locale,{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${d}T12:00:00Z`))}
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
                      {<UiText text={DAY_NAMES[new Date(`${d}T12:00:00Z`).getUTCDay()]}/>}
                      <div className="font-display font-bold text-sm">{Number(d.slice(-2))}</div>
                    </UiElement>
                  ))}
                </div>
                <p className="text-sm text-muted mb-2"><UiText text={"Orele sunt cele din România. Disponibilitatea firmei se confirmă la alocare."}/></p>
                {scheduledSlotExpired&&<p role="status" className="text-sm text-red-700 mb-2"><UiText text={"Intervalul selectat a expirat. Alege altă oră înainte de publicare."}/></p>}
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
                <span className="font-display font-semibold text-xs"><UiText text={"📷 Nitido Scan (opțional)"}/></span>
                <span className="text-[10.5px] text-muted">{photos.length}<UiText text={"/5 poze"}/></span>
              </div>
              <p className="text-[10.5px] text-muted mt-0.5 mb-2.5"><UiText text={"Fă câte o poză pe încăpere. Firma vede contextul clar și estimează mai bine."}/></p>
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
                    <span>{<UiText text={r.label}/>}</span>
                  </label>
                ))}
              </div>
              {uploading && <div className="text-[10.5px] text-muted mt-2"><UiText text={"Se încarcă…"}/></div>}
              {photos.length > 0 && (
                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {photos.map((p) => (
                    <div key={p.id} className="relative w-14">
                              <UiElement as="img"
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

            {needsAssessment?<section className="design-panel"><h2><UiText text={"Este necesară o evaluare"}/></h2><p><UiText text={cleaningType==='renovation'?CLEANING_DESCRIPTION.renovation:'Suprafața depășește limita calculatorului automat.'}/></p><Link className="design-button" href={`/client/evaluari?${new URLSearchParams({category:cleaningType,city,sqm:String(sqm)})}`}><UiText text={"Trimite spre evaluare"}/></Link></section>:confirmedOffer?null:<div className="bg-mist border border-aqua rounded-xl p-3.5 my-4">
              <p className="text-sm mb-2">{currencyText(priceExplanation(spaceType,sqm,cleaningType))}<UiText text={". Camerele nu se taxează separat."}/></p><p className="text-sm mb-2"><UiText text={"Curățenie: "}/><UiMoney ron={basePrice}/><UiText text={' · Supliment băi: '}/><UiMoney ron={bathroomPrice}/><UiText text={' · Geamuri: '}/>{windowsSqm}<UiTemplate text=" m² × {p0} lei = " values={[WINDOWS_RATE_LEI]}/><UiMoney ron={windowsPrice}/></p>
              {express60Active && (
                <div className="flex justify-between items-center text-[11.5px] text-muted mb-1.5 pb-1.5 border-b border-line/60">
                  <span><UiText text={"Curățenie "}/><UiMoney ron={basePrice}/><UiText text={' · 🔥 Express 60 +'}/><UiMoney ron={express60Fee}/></span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-[11.5px] text-muted">
                  {creditUsed > 0 ? <UiText text={"Preț (după credit)"}/> : <UiText text={"Preț estimat"}/>}
                </span>
                <span className="flex items-baseline gap-2">
                  {creditUsed > 0 && (
                    <span className="text-xs text-muted line-through"><UiMoney ron={price}/></span>
                  )}
                  <span className="font-display font-extrabold text-xl text-aqua-deep">
                    <UiMoney ron={finalPrice}/></span>
                </span>
              </div>
              {creditUsed > 0 && (
                <p className="text-[11px] text-aqua-deep font-semibold mt-1"><UiText text={"Ai folosit "}/><UiMoney ron={creditUsed}/><UiText text={' din creditul de recomandare'}/></p>
              )}
            </div>}

            {confirmedOffer&&<UiElement as="section" className="design-panel" aria-label="Oferta pentru confirmare"><h2><UiText text={"Confirmă prețul rezervării"}/></h2><ul>{confirmedOffer.pricing.lines.filter(line=>line.amountBani!==0).map(line=><li key={line.code}>{<UiText text={{cleaning:'Curățenie',windows:'Geamuri',express60:'Express 60',platform_credit:'Credit aplicat'}[line.code]??line.code}/>}: <UiMoney ron={Number((line.amountBani/100).toFixed(2))}/></li>)}</ul><p><UiText text={"Servicii și suplimente: "}/><UiMoney ron={Number((confirmedOffer.pricing.grossBani/100).toFixed(2))}/><UiText text={'. Credit aplicat: '}/><UiMoney ron={Number((confirmedOffer.pricing.creditBani/100).toFixed(2))}/><UiText text={'.'}/></p><p><strong><UiText text={"Total de plată: "}/><UiMoney ron={Number((confirmedOffer.pricing.clientTotalBani/100).toFixed(2))}/><ChargeAmount ron={confirmedOffer.pricing.clientTotalBani/100}/><UiText text={'.'}/></strong></p><p><UiText text={"Oferta este valabilă până la "}/>{<UiDate value={new Date(confirmedOffer.expiresAt)} kind="time" options={{timeZone:'Europe/Bucharest'}}/>}<UiText text={", ora României. Dacă modifici datele lucrării sau oferta expiră, vei primi o ofertă nouă pentru confirmare."}/></p></UiElement>}
            {error && <p role="alert" className="text-coral text-xs mb-3">{<UiText text={error}/>}</p>}

            {!needsAssessment && cardConfigured && <div className="mb-4"><ClientCards booking cards={cards} selected={selectedCardId} loading={hasCard===null}
              busy={cardBusy||uploading||submitting} onSelect={setSelectedCardId} onDefault={id=>void manageCard(id,"PATCH")}
              onRemove={id=>void manageCard(id,"DELETE")} onAdd={addCard}/></div>}

            <Button className="w-full" onClick={postJob} disabled={!windowsValid || needsAssessment || submitting || cardBusy || (cardConfigured && (hasCard !== true || !selectedCardId)) || !street.trim() || !city.trim()}>
              {submitting ? <UiText text={"Se verifică..."}/> : confirmedOffer ? <UiText text={"Confirmă oferta și postează"}/> : <UiText text={"Postează lucrarea"}/>}
            </Button>
          </Card>
        )}

        {job && <PublishedPriceBreakdown snapshot={job.pricing_snapshot}/>}
        {job?.for_family&&<FamilySharing key={job.id} jobId={job.id}/>}{job?.week_slot&&job.status==="waiting"&&<p className="design-panel"><UiText text={"Cerere adresată firmei intervalului ales. Confirmarea depinde de candidatura firmei și de reverificarea calendarului. Pentru alt interval, anulează cererea și configurează una nouă."}/></p>}
        {job&&!job.express_60&&!(job.week_slot&&job.status==="waiting")&&!(job.flexible&&job.status==="waiting")&&<RescheduleVisit key={job.id} jobId={job.id} scheduledAt={job.scheduled_at} status={job.status} role="client" onChanged={async()=>{const r=await fetch(`/api/jobs/${encodeURIComponent(job.id)}`);if(r.ok)setJob((await r.json()).job)}}/>}
        {job&&job.accepted_firm_id&&<VisitCare key={job.id} jobId={job.id}/>}
        {job?.details && <section className="design-panel"><h2><UiText text={"Instrucțiunile tale"}/></h2><p className="whitespace-pre-wrap break-words">{job.details}</p></section>}
        {job && job.status === "waiting" && (
          <Card>
            <h1 className="font-display font-extrabold text-xl text-ink mb-1"><UiText text={"Lucrare postată!"}/></h1>
            {job.mode === "standard" ? (
              <>
                <p className="text-sm text-muted mb-3"><UiText text={AUTHORIZATION_NOTICE}/></p><p className="text-sm text-muted mb-3"><UiText text={"Firmele verificate din zonă trimit oferte. Alege firma care îți place — pe calitate, nu pe noroc."}/></p>
                {offers.length === 0 ? (
                  <div className="rounded-xl border border-line bg-mist p-4 text-sm text-muted"><UiText text={"Așteptăm primele oferte… firmele din zonă au fost notificate."}/></div>
                ) : (
                  <div className="offer-comparison">
                    <div className="offer-comparison-heading">
                      {offers.length} {offers.length === 1 ? <UiText text={"ofertă primită"}/> : <UiText text={"oferte primite"}/>}
                    </div>
                    {offers.map((o) => (
                      <div key={o.offerId} className="offer-comparison-card">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="offer-avatar">{o.firmName.slice(0,1)}</span><div className="font-display font-bold text-sm text-ink truncate">{o.firmName}</div>
                              <span className="eyebrow-pill"><UiText text={"Candidatură"}/></span>
                            </div>
                            <div className="text-[11.5px] text-muted mt-0.5">
                              {o.ratingAvg != null ? `★ ${o.ratingAvg.toFixed(1)} (${o.ratingCount})` : <UiText text={"firmă nouă"}/>} · {o.completedJobs}<UiText text={" lucrări finalizate"}/></div>
                          </div>
                        </div>
                        <div className="offer-price"><b><UiMoney ron={job.price_gross}/></b><span><UiText text={"Preț fix pentru această solicitare"}/></span></div>
                        {o.flexible&&<p className="my-3 text-sm"><UiText text={"Propunere: "}/>{new Date(o.flexible.starts_at).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest'})}<UiText text={" · ora României. Valabilă până la "}/>{new Date(o.flexible.expires_at).toLocaleTimeString('ro-RO',{timeZone:'Europe/Bucharest'})}<UiText text={". Firma și prețul de mai sus se confirmă numai după acceptarea validă."}/></p>}
                        {o.message && (
                          <p className="text-sm text-muted mt-2 border-t border-line pt-2">{o.message}</p>
                        )}
                        <Button className="offer-select-button" onClick={() => chooseOffer(o.offerId,o.flexible?.proposal_id)} disabled={choosing !== null||(confirmationOpensAt(job)!==null&&calendarNow.getTime()<confirmationOpensAt(job)!)}>
                          {choosing === o.offerId ? <UiText text={"Se alege…"}/> : <UiText text={o.flexible?"Confirmă programarea":"Alege această firmă"}/>}
                        </Button>
                        {o.flexible&&<button type="button" className="mt-2 min-h-11 underline" disabled={choosing!==null} onClick={async()=>{try{const r=await fetch(`/api/jobs/${job.id}/flexible`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reject',offerId:o.offerId})});const b=await r.json();if(!r.ok)throw new Error(b.error);await poll(new AbortController().signal);}catch(e){setError(e instanceof Error?e.message:'Propunerea nu a fost refuzată.');}}}><UiText text={"Refuză propunerea"}/></button>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {job.express_60 ? (
                  <div className="rounded-xl border border-coral bg-coral/10 p-3 mb-3">
                    <div className="font-display font-bold text-sm text-ink"><UiText text={"🔥 Express 60 activ"}/></div>
                    <p className="text-[12px] text-muted mt-0.5"><UiText text={"Preluare garantată"}/>{job.express_60_deadline ? (
                        <><UiText text={" până la "}/><b className="text-ink">{<UiDate value={new Date(job.express_60_deadline)} kind="time" options={{ hour: "2-digit", minute: "2-digit" }}/>}</b></>
                      ) : <UiText text={" în 60 de minute"}/>}<UiText text={". Dacă nicio firmă nu preia la timp, suplimentul nu se percepe."}/></p>
                  </div>
                ) : null}
                <p className="text-sm text-muted mb-2"><UiText text={"Firmele din zonă au primit alerta acum. Așteptăm acceptare."}/></p>
                {job.scheduled_at && (
                  <p className="text-xs text-muted"><UiText text={"Interval rezervat: "}/>{formatInterval(new Date(job.scheduled_at), job.duration_minutes + job.buffer_minutes)}
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

        {job?.flexible&&job.status==="waiting"&&<FlexibleClientPanel jobId={job.id} windows={job.flexible.windows} onSaved={()=>poll(new AbortController().signal)}/>}
        {job && job.status === "completed" && !ratingDone && !job.ownReview && (
          <Card>
            <h1 className="font-display font-bold text-lg text-ink text-center mb-1"><UiText text={"Cum a fost curățenia?"}/></h1>
            <p className="text-sm text-muted text-center mb-2">
              {firmName ?? <UiText text={"Firma"}/>}<UiText text={" a finalizat lucrarea. Poți lăsa o recenzie. Starea plății este afișată separat."}/></p>
            <RatingBlock key={job.id} onSubmit={submitRating} />
          </Card>
        )}

        {job && job.status === "completed" && (ratingDone || job.ownReview) && (
          <Card>
            <h1 className="font-display font-bold text-lg text-ink mb-2"><UiText text={"Mulțumim!"}/></h1>
            <p className="text-sm text-muted mb-4">{job.ownReview?`${job.ownReview.rating} / 5 · ${job.ownReview.badge}${job.ownReview.reviewText?` — ${job.ownReview.reviewText}`:""}`:<UiText text={"Rating-ul tău a fost înregistrat."}/>}</p>
            {guaranteeEligible && (
              <div className="mb-4 rounded-xl border border-line bg-mist p-3.5">
                <div className="text-sm font-bold text-ink flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[#a9781f] bg-[#f7efdd] rounded-full px-2 py-0.5"><UiText text={"Nitido Guaranteed"}/></span><UiText text={"Nu ești mulțumit?"}/></div>
                <p className="text-[11.5px] text-muted mt-1 leading-relaxed"><UiText text={"Sesizează problema în 48h de la finalizare. Firma propune revenirea gratuită, iar tu confirmi intervalul."}/></p>
                <Button variant="outline" className="w-full mt-2.5" onClick={requestGuarantee}><UiText text={"Cere re-curățare gratuită"}/></Button>
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={resetToForm}><UiText text={"Postează o nouă lucrare"}/></Button>
            <div className="mt-4">
              <AppRatingCard compact />
            </div>
          </Card>
        )}

        {job && job.status === "no_show" && (
          <Card>
            <h1 className="font-display font-bold text-lg text-coral mb-2"><UiText text={"Firma nu a confirmat prezența"}/></h1>
            <p className="text-sm text-muted mb-4"><UiText text={"Lucrarea a fost anulată automat. Verifică starea anulării autorizării în detaliile plății."}/></p>
            <Button className="w-full" onClick={resetToForm}><UiText text={"Repostează lucrarea"}/></Button>
          </Card>
        )}

        {job && job.status === "cancelled" && (
          <Card>
            <h1 className="font-display font-bold text-lg text-ink mb-2"><UiText text={"Lucrarea este anulată"}/></h1>
            <p className="text-sm text-muted mb-4"><UiText text={"Consultă istoricul rezervărilor pentru o eventuală repostare și starea separată a plății."}/></p>
            <Button className="w-full" onClick={resetToForm}><UiText text={"Înapoi la panou"}/></Button>
          </Card>
        )}
        </div>
        {(!job&&showBooking)&&<aside className="space-y-4"><div className="v2-card p-6"><h2 className="text-xl font-bold"><UiText text={"Pregătește rezervarea"}/></h2><p className="text-sm text-muted leading-6 mt-3"><UiText text={"Completează spațiul, adresa și programul. Verifică prețul înainte de publicare."}/></p></div><Link href="/client/proprietati" className="v2-card p-5 block"><b><UiText text={"Proprietățile tale"}/></b><p className="text-sm text-muted mt-2"><UiText text={"Salvează adresele pentru rezervările viitoare."}/></p></Link></aside>}
        </div>
      </main>
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
          <div className="font-display font-bold text-sm text-ink"><UiText text={"Recomandă Nitido unui prieten"}/></div>
          <div className="text-[11.5px] text-muted mt-0.5"><UiText text={"Amândoi primiți 20 lei credit — codul tău:"}/>{" "}
            <span className="font-mono font-bold text-ink">{code}</span>
          </div>
        </div>
        <button
          onClick={copyCode}
          className="flex-shrink-0 text-xs font-display font-bold text-aqua-deep border border-aqua rounded-lg px-3 py-2 bg-white hover:bg-aqua/10"
        >
          {copied ? <UiText text={"Copiat!"}/> : <UiText text={"Copiază"}/>}
        </button>
      </div>
      {creditBalance > 0 && (
        <div className="text-[11.5px] text-aqua-deep font-semibold mt-2"><UiText text={"Ai "}/><UiMoney ron={creditBalance}/><UiText text={' credit disponibil — se aplică automat la următoarea lucrare.'}/></div>
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
        <h2 className="font-bold"><UiText text={"Cont business"}/>{" "}
          <span className="text-[11px] font-bold text-[#3a4650] bg-[#eef1f0] rounded-full px-2 py-0.5 align-middle"><UiText text={"Nitido Office"}/></span>
        </h2>
        <button onClick={() => setOpen((o) => !o)} className="text-xs font-display font-bold text-aqua-deep">
          {open ? <UiText text={"Închide"}/> : profile?.isBusiness ? <UiText text={"Editează"}/> : <UiText text={"+ Activează"}/>}
        </button>
      </div>
      <p className="text-xs text-muted mt-1"><UiText text={"Pentru birouri și firme: date de facturare + raport de execuție."}/></p>

      {profile?.isBusiness && !open && (
        <div className="mt-3 text-sm">
          <b>{profile.companyName}</b>
          <div className="text-xs text-[#6b756f]"><UiText text={"CUI: "}/>{profile.companyCui}{profile.companyAddress ? ` · ${profile.companyAddress}` : ""}</div>
          <Button variant="outline" className="w-full mt-3" onClick={loadReport}><UiText text={"Vezi raportul de execuție"}/></Button>
        </div>
      )}

      {open && (
        <div className="mt-4 border-t border-line pt-4">
          <Field label="Nume firmă">
            <UiElement as="input" className={inputClass} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="ACME SRL" />
          </Field>
          <Field label="CUI">
            <UiElement as="input" className={inputClass} value={companyCui} onChange={(e) => setCompanyCui(e.target.value)} placeholder="RO12345678" />
          </Field>
          <Field label="Adresă firmă (opțional)">
            <input className={inputClass} value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} />
          </Field>
          {msg && <p className="text-coral text-xs mt-1">{msg}</p>}
          <Button className="w-full mt-2" onClick={save} disabled={busy}>{busy ? <UiText text={"Se salvează..."}/> : <UiText text={"Salvează contul business"}/>}</Button>
        </div>
      )}

      {showReport && report && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex justify-between items-center mb-2">
            <b className="text-sm"><UiText text={"Raport de execuție"}/></b>
            <button onClick={() => setShowReport(false)} className="text-xs text-muted"><UiText text={"Închide"}/></button>
          </div>
          <div className="flex gap-3 mb-3">
            <div className="flex-1 bg-mist rounded-lg p-3"><div className="text-lg font-bold">{report.totalJobs}</div><div className="text-[11px] text-muted"><UiText text={"lucrări"}/></div></div>
            <div className="flex-1 bg-mist rounded-lg p-3"><div className="text-lg font-bold"><UiMoney ron={report.totalAmount}/></div><div className="text-[11px] text-muted"><UiText text={"total"}/></div></div>
          </div>
          {report.rows.length === 0 ? (
            <p className="text-xs text-muted"><UiText text={"Nicio lucrare finalizată încă."}/></p>
          ) : (
            <div className="divide-y divide-[#e2e8f0]">
              {report.rows.map((row) => (
                <div key={row.jobId} className="py-2 flex justify-between gap-2 text-xs">
                  <span className="min-w-0">
                    <b className="block truncate">{row.spaceType} · {row.city}</b>
                    <span className="text-[#6b756f]">{row.completedAt ? row.completedAt.slice(0, 10) : ""} · {row.firmName ?? "—"}</span>
                  </span>
                  <b className="flex-shrink-0"><UiMoney ron={row.priceGross}/></b>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RatingBlock({onSubmit}:{onSubmit:(stars:number,reviewText:string)=>Promise<void>}) {return <ReviewForm onSubmit={onSubmit}/>;}
