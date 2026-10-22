"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {useLocale} from 'next-intl';
import Link from 'next/link';
import {UiText,UiElement,UiSpaceType,UiTemplate} from './UiText';
import {Field,inputClass,Button} from './ui';
import {BathroomExtra} from './BathroomExtra';
import {SeriesChanges} from './SeriesChanges';
import {NewBadge} from './NewBadge';
import {calcServicePrice,validBathroomCount,PRICING_VERSION,SLOT_HOURS,type SpaceType} from '@/lib/pricing';
import {JOB_STATUS} from "@/lib/workspaceShared";
import {bucharestDateKey} from '@/lib/scheduling';

interface PlanView {
  bathroom_count?:number|null;
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

export function RecurringSection({ defaults }: { defaults: { street: string; postalCode: string; city: string; floor: string; sqm: number; spaceType: SpaceType } }) {
 const locale=useLocale();

  const [address, setAddress] = useState(defaults);
  const [seriesBathrooms,setSeriesBathrooms]=useState(1);
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
  const [loadError,setLoadError]=useState(false);
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [open, setOpen] = useState(false);
  const [frequency, setFrequency] = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [startDate, setStartDate] = useState(() => bucharestDateKey(new Date(Date.now() + 86_400_000)));
  const [endDate,setEndDate]=useState("");
  const [hour, setHour] = useState(10);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const creationRequest=useRef<{payload:string;id:string;quoteId?:string}|null>(null);
  const statusLock = useRef(false);
  const [statusBusy,setStatusBusy]=useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/recurring");
    if(!r.ok)throw new Error("Abonamentele nu au putut fi actualizate.");
    const data=await r.json();
    if(!Array.isArray(data.plans)||!Array.isArray(data.occurrences))throw new Error("Răspuns incomplet. Reîncearcă încărcarea rutinei.");
    setPlans(data.plans);setOccurrences(data.occurrences);setLoadError(false);
    const properties=await fetch('/api/workspace');
    if(properties.ok){const workspace=await properties.json();setSavedProperties(workspace.properties??[]);setPreviousFirms(workspace.preferredFirms??[]);}
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- încărcare inițială a abonamentelor (client-only)
    void load().catch(()=>{setLoadError(true);setMsg("Abonamentele nu au putut fi încărcate. Reîncearcă încărcarea.")});
  }, [load]);

  async function create() {
    if(statusLock.current)return;
    statusLock.current=true;setBusy(true);setMsg(null);
    try {
      if(!validBathroomCount(seriesBathrooms))throw new Error("Introdu numărul de băi, întreg între 0 și 20.");
      const input={...address,bathroomCount:seriesBathrooms,pricingVersion:PRICING_VERSION,expectedPriceGross:calcServicePrice(address.spaceType,address.sqm,0,seriesBathrooms),preferredFirmId:preferredFirm||null,propertyId:seriesPropertyId||null,details:visitDetails,frequency,hour,startDate,endDate:endDate||null};
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

  async function savePreferredFirm(planId:string,firmId:string|null){
    if(statusLock.current)return;
    statusLock.current=true;setStatusBusy(true);setMsg(null);
    try{
      const r=await fetch(`/api/recurring/${encodeURIComponent(planId)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'preferred_firm',firmId})});
      const data=await r.json();
      if(!r.ok||data.ok!==true)throw Error(data.error||'Preferința nu a fost confirmată. Reîncarcă lista.');
      await load();setMsg('Preferința a fost salvată. Firmele deja alocate rămân neschimbate.');
    }catch(e){setMsg(e instanceof Error?e.message:'Salvarea a eșuat.')}
    finally{statusLock.current=false;setStatusBusy(false)}
  }

  return (
    <section id="sec-rutina" className="v2-card p-5 mb-5" aria-label="Rutina casei mele">
      <div className="flex items-center justify-between">
        <h2 className="font-bold"><UiText text={"Rutina casei mele"}/> <NewBadge/>{" "}
          <span className="text-[11px] font-bold text-aqua-deep bg-aqua/10 rounded-full px-2 py-0.5 align-middle"><UiText text={"Nitido Repeat"}/></span>
        </h2>
        <button onClick={() => setOpen((o) => !o)} className="text-xs font-display font-bold text-aqua-deep">
          {open ? <UiText text={"Închide"}/> : <UiText text={"+ Adaugă"}/>}
        </button>
      </div>
      <p className="text-xs text-muted mt-1"><UiText text={"Vizite la interval fix, generate anticipat. Firmele pot trimite candidaturi; alegerea firmei și autorizarea cardului se deschid cu 48 de ore înainte de vizită. Deschiderea listei nu generează lucrări."}/></p>

      <button type="button" disabled={statusBusy||busy} onClick={()=>void generateVisits()} className="mt-3 text-sm font-bold text-aqua-deep disabled:opacity-50"><UiText text={"Generează rezervările viitoare"}/></button>
      {msg && <p role={loadError?"alert":"status"} className="text-sm mt-3">{msg}</p>}
      {loadError&&<button type="button" className="v2-btn my-3" onClick={()=>void load().then(()=>setMsg(null)).catch(()=>setMsg("Încărcarea nu a reușit. Reîncearcă."))}><UiText text="Reîncearcă încărcarea"/></button>}
      {plans.length > 0 && (
        <div className="mt-3 divide-y divide-[#e2e8f0]">
          {plans.map((p) => (
            <div key={p.id} className="py-3 flex flex-wrap items-center gap-3">
              <span className="w-10 h-10 rounded-lg bg-[var(--nitido-brand-soft)] flex items-center justify-center text-[var(--nitido-brand-dark)] font-bold">↻</span>
              <span className="min-w-0 flex-1">
                {p.end_date&&<span className="block text-xs text-muted"><UiText text={"Ultima zi a seriei: "}/>{p.end_date}<UiText text={" inclusiv"}/></span>}
                {p.pause_start&&p.pause_end&&<span className="block text-xs text-aqua-deep"><UiText text={"Pauză programată: "}/>{p.pause_start} – {p.pause_end}<UiText text={" inclusiv"}/><button type="button" disabled={statusBusy||busy} onClick={()=>void removePause(p)} className="block mt-2 underline disabled:opacity-50"><UiText text={"Elimină pauza programată"}/></button></span>}
                <label className="block text-xs my-2"><UiText text={"Firma preferată"}/><select className={inputClass} disabled={statusBusy||busy} value={p.preferred_firm_id??''} onChange={e=>void savePreferredFirm(p.id,e.target.value||null)}><option value=""><UiText text={"Aleg la fiecare vizită"}/></option>{previousFirms.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}{p.preferred_firm_id&&!previousFirms.some(f=>f.id===p.preferred_firm_id)&&<option value={p.preferred_firm_id}>{p.preferred_firm_name??<UiText text={'Firmă indisponibilă'}/>}</option>}</select></label>
                <b className="text-sm block truncate">{<UiText text={FREQ_LABELS[p.frequency]}/>} · <UiSpaceType value={p.space_type}/> · {p.city}</b>{p.bathroom_count!=null&&<span className="block text-xs text-muted">{p.bathroom_count}<UiText text=" băi · o bucătărie inclusă"/></span>}
                <span className="text-xs text-[#6b756f]">{p.next_visit_at?<UiTemplate text={"Următoarea vizită: {p0}"} values={[new Intl.DateTimeFormat(locale,{timeZone:'Europe/Bucharest',dateStyle:'medium',timeStyle:'short'}).format(new Date(p.next_visit_at))]}/>:p.end_date&&p.next_run_date>p.end_date?<UiText text={"Generarea seriei s-a încheiat"}/>:<UiTemplate text={"Următoarea dată de generat: {p0}"} values={[p.next_run_date]}/>} · {p.status === "active" ? <UiText text={"activ"}/> : p.status === "paused" ? <UiText text={"pe pauză"}/> : p.status}</span>
                <span className="block text-xs text-muted"><UiText text={"Ora "}/>{String(p.hour).padStart(2,"0")}<UiText text={":00 · ora României"}/></span>
              </span>
              {p.status !== "cancelled" && (
                <span className="flex flex-wrap gap-3">
                  <button type="button" disabled={statusBusy||busy} onClick={() => setEditing({plan:p,frequency:p.frequency,hour:p.hour,startDate:p.next_run_date,endDate:p.end_date??"",details:p.details??""})} className="text-xs font-bold text-aqua-deep"><UiText text={"Modifică programul"}/></button>
                  {p.status === "active" ? (
                    <button disabled={statusBusy} onClick={() => changeStatus(p.id, "paused")} className="text-xs font-bold text-muted"><UiText text={"Pauză"}/></button>
                  ) : (
                    <button disabled={statusBusy} onClick={() => changeStatus(p.id, "active")} className="text-xs font-bold text-aqua-deep"><UiText text={"Reia"}/></button>
                  )}
                  <button disabled={statusBusy} onClick={() => changeStatus(p.id, "cancelled")} className="text-xs font-bold text-coral"><UiText text={"Anulează"}/></button>
                </span>
              )}
              {!!p.upcoming_dates?.length && <details className="basis-full rounded-lg bg-aqua/5 p-3">
                <summary className="cursor-pointer text-sm font-bold"><UiText text={"Date estimate în următoarele 30 de zile"}/></summary>
                <p className="mt-2 text-xs text-muted"><UiText text={"Calendar orientativ al vizitelor încă negenerate. Disponibilitatea firmei și plata se confirmă pentru fiecare rezervare."}/></p>
                <ul className="mt-2 flex flex-wrap gap-2">{p.upcoming_dates.map(date => <li key={date} className="rounded-lg bg-white px-3 py-2 text-xs">{new Intl.DateTimeFormat(locale,{timeZone:"Europe/Bucharest",dateStyle:"medium",timeStyle:"short"}).format(new Date(date))}</li>)}</ul>
              </details>}
            </div>
          ))}
        </div>
      )}

      <SeriesChanges plans={plans} visits={occurrences} onSaved={load}/>
      {editing && <form className="mt-4 rounded-xl border border-line p-4" onSubmit={event => {event.preventDefault(); void saveSchedule();}}>
        <h3 className="font-bold"><UiText text={"Modifică programul · "}/>{editing.plan.city}</h3>
        <p className="mt-2 text-xs text-muted"><UiText text={"Se aplică doar vizitelor care nu au fost încă generate. Pentru o rezervare deja creată, deschide rezervarea din istoric. Pauzele programate rămân valabile."}/></p>
        <fieldset disabled={statusBusy||busy} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm"><UiText text={"Frecvență"}/><select className={inputClass} value={editing.frequency} onChange={event => setEditing({...editing,frequency:event.target.value as PlanView["frequency"]})}>{(["weekly","biweekly","monthly"] as const).map(value => <option key={value} value={value}>{<UiText text={FREQ_LABELS[value]}/>}</option>)}</select></label>
          <label className="text-sm"><UiText text={"Ora României"}/><select className={inputClass} value={editing.hour} onChange={event => setEditing({...editing,hour:Number(event.target.value)})}>{SLOT_HOURS.map(value => <option key={value} value={value}>{String(value).padStart(2,"0")}:00</option>)}</select></label>
          <label className="text-sm"><UiText text={"Prima dată din noul program"}/><input required type="date" className={inputClass} min={editing.plan.next_run_date} value={editing.startDate} onChange={event => setEditing({...editing,startDate:event.target.value})}/></label>
          <label className="text-sm"><UiText text={"Data de sfârșit (opțional)"}/><input type="date" className={inputClass} min={editing.startDate} value={editing.endDate} onChange={event => setEditing({...editing,endDate:event.target.value})}/></label>
          <label className="text-sm sm:col-span-2"><UiText text={"Preferințe pentru vizitele viitoare"}/><textarea className={inputClass} maxLength={500} rows={3} value={editing.details} onChange={event => setEditing({...editing,details:event.target.value})}/></label>
        </fieldset>
        <p className="mt-2 text-xs text-muted"><UiText text={"Pentru o zi lunară inexistentă se folosește ultima zi a lunii, apoi se revine la ziua inițială. Ora locală se păstrează și la schimbarea orei de vară."}/></p>
        <div className="mt-3 flex flex-wrap gap-3"><button type="submit" disabled={statusBusy||busy} className="rounded-lg bg-aqua px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{statusBusy?<UiText text={"Se salvează…"}/>:<UiText text={"Salvează programul"}/>}</button><button type="button" disabled={statusBusy} className="px-3 py-2 text-sm" onClick={() => setEditing(null)}><UiText text={"Renunță"}/></button></div>
      </form>}

      {plans.some(plan=>plan.status==="active")&&<details className="mt-4 border-t border-line pt-3">
        <summary className="cursor-pointer text-sm font-bold"><UiText text={"Programează pauză pe interval"}/></summary>
        <p className="text-xs text-muted mt-2"><UiText text={"Interval inclusiv, ora României. Înlocuiește pauza programată anterior. Vizitele deja create trebuie gestionate separat din Rezervări. Datele omise nu se recuperează retroactiv."}/></p>
        <div className="grid gap-3 mt-3 sm:grid-cols-3">
          <label className="text-sm"><UiText text={"Abonament"}/><select className="block w-full border rounded p-2" value={pausePlan} onChange={event=>setPausePlan(event.target.value)} disabled={statusBusy}><option value=""><UiText text={"Alege abonamentul"}/></option>{plans.filter(plan=>plan.status==="active").map(plan=><option key={plan.id} value={plan.id}>{plan.city} · {<UiText text={FREQ_LABELS[plan.frequency]}/>} · {plan.next_run_date}</option>)}</select></label>
          <label className="text-sm"><UiText text={"Început pauză"}/><input className="block w-full border rounded p-2" type="date" value={pauseStart} disabled={statusBusy} onChange={event=>setPauseStart(event.target.value)}/></label>
          <label className="text-sm"><UiText text={"Sfârșit pauză"}/><input className="block w-full border rounded p-2" type="date" value={pauseEnd} min={pauseStart} disabled={statusBusy} onChange={event=>setPauseEnd(event.target.value)}/></label>
        </div>
        <button type="button" className="mt-3 text-sm font-bold text-aqua-deep disabled:opacity-50" disabled={statusBusy||!pausePlan||!pauseStart||!pauseEnd} onClick={()=>void schedulePause()}><UiText text={"Verifică vizitele și continuă"}/></button>
        {pauseImpact&&pauseImpact.planId===pausePlan&&pauseImpact.start===pauseStart&&pauseImpact.end===pauseEnd&&<div className="mt-3 rounded-xl border border-line p-3"><p className="text-sm font-bold">{pauseImpact.count}<UiText text={" vizite active în interval"}/></p><p className="text-xs text-muted mt-1"><UiText text={"Sunt afișate cel mult 100 de vizite. Deschiderea rezervării nu o anulează și nu modifică plata."}/></p><ul className="divide-y divide-line">{pauseImpact.visits.map(visit=><li key={visit.job_id} className="py-2 text-sm"><span>{new Intl.DateTimeFormat(locale,{timeZone:"Europe/Bucharest",dateStyle:"medium",timeStyle:"short"}).format(new Date(visit.scheduled_at))} · {visit.city} · {JOB_STATUS[visit.status]??visit.status}</span><Link className="block underline mt-1" href={`/client?jobId=${encodeURIComponent(visit.job_id)}`}><UiText text={"Deschide rezervarea"}/></Link></li>)}</ul></div>}
      </details>}

      <details className="mt-4 border-t border-line pt-3">
        <summary className="cursor-pointer text-sm font-bold"><UiText text={"Vizitele abonamentelor"}/></summary>
        <p className="text-xs text-muted mt-2"><UiText text={"Ultimele 200 de vizite înregistrate, inclusiv din abonamente anulate. Lucrările istorice fără legătură înregistrată rămân în Rezervări."}/></p>
        {occurrences.length===0?<p className="text-sm mt-3"><UiText text={"Nicio vizită înregistrată în acest istoric."}/></p>:<ul className="divide-y divide-line">{occurrences.map(visit=><li key={visit.job_id} className="py-3 flex flex-wrap justify-between gap-3 text-sm"><span>{new Intl.DateTimeFormat(locale,{timeZone:"Europe/Bucharest",dateStyle:"medium",timeStyle:"short"}).format(new Date(visit.scheduled_at))} · {visit.city}<span className="block text-xs text-muted">{JOB_STATUS[visit.status]??visit.status}</span>{visit.preferred_firm_id&&<span className="block text-xs mt-1"><UiText text={"Firma preferată: "}/>{visit.preferred_firm_name??<UiText text={'Indisponibilă'}/>} · {visit.accepted_firm_id===visit.preferred_firm_id?<UiText text={'confirmată pentru această vizită'}/>:visit.accepted_firm_id?<UiText text={'ai selectat o altă firmă'}/>:visit.preferred_offer_status==='pending'?<UiText text={'candidatură primită; verifică disponibilitatea la selectare'}/>:visit.preferred_offer_status==='rejected'||visit.preferred_offer_status==='withdrawn'?<UiText text={'candidatură retrasă sau respinsă; poți alege altă firmă'}/>:<UiText text={'așteaptă candidatura firmei; poți vedea alternative în rezervare'}/>}</span>}</span><a className="font-bold text-aqua-deep" href={`/client?jobId=${encodeURIComponent(visit.job_id)}`}><UiText text={"Deschide rezervarea"}/></a></li>)}</ul>}
      </details>
      {open && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-sm text-muted mb-3"><UiText text={"Configurează spațiul pentru această serie de vizite."}/></p>
          <Field label="Firma preferată"><select className={inputClass} value={preferredFirm} onChange={e=>setPreferredFirm(e.target.value)}><option value=""><UiText text={"Aleg firma pentru fiecare vizită"}/></option>{previousFirms.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></Field><p className="text-xs text-muted my-2"><UiText text={"Preferința nu garantează disponibilitatea. Firma confirmă prin candidatură, iar tu alegi și confirmi plata pentru fiecare vizită. Poți selecta explicit altă firmă dacă cea preferată nu este disponibilă."}/></p>
          <Field label="Proprietate salvată (opțional)"><select className={inputClass} value={seriesPropertyId} onChange={event=>{const id=event.target.value;setSeriesPropertyId(id);const property=savedProperties.find(p=>p.id===id);if(property){setAddress({street:property.street,city:property.city,postalCode:property.postal_code??'',floor:property.floor??'',sqm:property.sqm,spaceType:property.space_type});setVisitDetails('')}}}><option value=""><UiText text={"Introdu adresa manual"}/></option>{savedProperties.map(p=><option key={p.id} value={p.id}>{p.name} · {p.city}</option>)}</select></Field>
          {seriesPropertyId&&<div className="my-3 text-sm"><p><UiText text={"Preferințe salvate — selectează și adaptează instrucțiunile pentru această serie:"}/></p><p className="whitespace-pre-wrap text-muted">{[savedProperties.find(p=>p.id===seriesPropertyId)?.notes,savedProperties.find(p=>p.id===seriesPropertyId)?.sensitive_materials,savedProperties.find(p=>p.id===seriesPropertyId)?.usual_tasks].filter(Boolean).join('\n')}</p><p className="text-xs mt-1"><UiText text={"Instrucțiunile de acces nu sunt copiate automat."}/></p></div>}
          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            <Field label="Stradă și număr"><input className={inputClass} maxLength={300} value={address.street} onChange={event=>setAddress({...address,street:event.target.value})}/></Field>
            <Field label="Oraș"><input className={inputClass} maxLength={120} value={address.city} onChange={event=>setAddress({...address,city:event.target.value})}/></Field>
            <Field label="Cod poștal"><input className={inputClass} maxLength={30} value={address.postalCode} onChange={event=>setAddress({...address,postalCode:event.target.value})}/></Field>
            <Field label="Etaj"><input className={inputClass} maxLength={100} value={address.floor} onChange={event=>setAddress({...address,floor:event.target.value})}/></Field>
            <Field label="Suprafață, m²"><input className={inputClass} type="number" min={1} max={1000} step={1} value={address.sqm} onChange={event=>setAddress({...address,sqm:Number(event.target.value)})}/></Field>
            <Field label="Tip spațiu"><select className={inputClass} value={address.spaceType} onChange={event=>setAddress({...address,spaceType:event.target.value as SpaceType})}><option value="apartament"><UiText text={"Apartament"}/></option><option value="casa"><UiText text={"Casă"}/></option><option value="birou"><UiText text={"Birou"}/></option><option value="altul"><UiText text={"Alt spațiu"}/></option></select></Field>
          </div>
          <BathroomExtra value={seriesBathrooms} onChange={setSeriesBathrooms}/>
          {Number.isSafeInteger(address.sqm)&&address.sqm>0&&validBathroomCount(seriesBathrooms)&&<p className="text-sm font-bold mb-3"><UiText text="Preț pe vizită, înainte de credit: "/>{calcServicePrice(address.spaceType,address.sqm,0,seriesBathrooms)}<UiText text=" lei. Geamurile nu sunt incluse. Plata și firma se confirmă separat pentru fiecare vizită."/></p>}
          <Field label="Preferințe pentru vizite"><UiElement as="textarea" className={inputClass} maxLength={500} rows={3} value={visitDetails} onChange={event=>setVisitDetails(event.target.value)} placeholder="Materiale sensibile, animale de companie, preferințe de curățenie…"/></Field>
          <span className="block text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-1"><UiText text={"Frecvență"}/></span>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {(["weekly", "biweekly", "monthly"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrequency(f)}
                className={`py-2 rounded-lg border text-[11px] font-display font-bold ${frequency === f ? "border-aqua bg-aqua/10 text-ink" : "border-line text-muted"}`}
              >
                {<UiText text={FREQ_LABELS[f]}/>}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prima dată">
              <input type="date" className={inputClass} min={bucharestDateKey(new Date())} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
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
          <p className="text-xs text-muted mt-2"><UiText text={"Fără dată de sfârșit, seria continuă până o oprești. Data aleasă este inclusivă, în ora României; nu se generează vizite după ea. Pentru o zi lunară inexistentă se folosește ultima zi a lunii, apoi se revine la ziua inițială."}/></p>
          <Button className="w-full mt-3" onClick={create} disabled={busy||statusBusy}>
            {busy ? <UiText text={"Se creează..."}/> : <UiText text={"Creează abonamentul"}/>}
          </Button>
        </div>
      )}
    </section>
  );
}

