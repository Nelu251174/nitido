"use client";
import {UiDate} from '@/components/UiDate';

import {UiText,UiTemplate} from '@/components/UiText';
import { useState } from "react";
import { CHECKLISTS, SERVICES } from "@/lib/pro/shared";

type Template = { photoRulesAvailable?:boolean;photoRules?:{arrivalMin:number;completionMin:number}; service: string; revision: number; items: string[]; reason: string; actor: string | null; created_at: string | null };
type History = { rows: (Omit<Template, "service">)[]; next: number | null };
export default function PropertyChecklists({ propertyId, configuration, run }: {
  propertyId: string;
  configuration: { available: boolean; templates: Template[] };
  run: (path: string, body: Record<string, unknown>) => Promise<unknown>;
}) {
  const [service, setService] = useState("cleaning_turnover");
  const template = configuration.templates.find(t => t.service === service)!;
  return <section className="pro-card mt-4">
    <h2><UiText text={"Checklisturi pentru această proprietate"}/></h2>
    <p className="mt-3"><UiText text={"Definește punctele de verificare pentru fiecare serviciu: încăperi, echipamente și cerințe specifice proprietății. Lista publicată se aplică lucrărilor create ulterior, inclusiv celor generate din programări recurente. Lucrările deja create și remedierile lor păstrează lista inițială."}/></p>
    <p className="mt-3"><UiText text={"Nu include parole, coduri de acces sau date personale în aceste puncte. Prestatorul alocat va primi lista în fișa lucrării."}/></p>
    <label className="pro-field mt-3"><UiText text={"Serviciul configurat"}/><select value={service} onChange={e => setService(e.target.value)}>
        {Object.entries(SERVICES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </label>
    {configuration.available ? <Editor key={`${propertyId}:${service}:${template.revision}`} propertyId={propertyId} template={template} run={run} /> : <p role="status" className="mt-3"><UiText text={"Configurarea personalizată nu este încă disponibilă. Lucrările continuă să folosească listele standard."}/></p>}
  </section>;
}
function Editor({ propertyId, template, run }: { propertyId: string; template: Template; run: (path: string, body: Record<string, unknown>) => Promise<unknown> }) {
  const [items, setItems] = useState(template.items.join("\n"));
  const [photos,setPhotos]=useState(template.photoRules??{arrivalMin:0,completionMin:1});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<History | null>(null);
  async function loadHistory(before?: number) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/pro/properties/${encodeURIComponent(propertyId)}/checklist-history?service=${encodeURIComponent(template.service)}${before ? `&before=${before}` : ""}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setHistory(result);
    } catch (e) { setError(e instanceof Error ? e.message : "Istoricul nu a putut fi încărcat."); }
    finally { setBusy(false); }
  }
  return <>
    <p className="mt-3">{template.revision ? <UiTemplate text={"Versiunea publicată: {p0}"} values={[template.revision]}/> : <UiText text={"Listă standard, încă nepersonalizată"}/>}</p>
    {template.created_at && <p><UiText text={"Publicată la "}/>{<UiDate value={new Date(template.created_at)} kind="dateTime"/>} · {template.reason}</p>}
    <form className="mt-3" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError("");
      try {
        await run(`properties/${propertyId}/checklist`, { service: template.service, revision: template.revision, items: items.split("\n").map(s => s.trim()).filter(Boolean), reason,...(template.photoRulesAvailable?{photoRules:photos}:{}) });
        setSaved(true);
      } catch (e) { setError(e instanceof Error ? e.message : "Publicarea nu a fost confirmată."); }
      finally { setBusy(false); }
    }}>
      <label className="pro-field"><UiText text={"Puncte obligatorii, câte unul pe rând"}/><textarea value={items} onChange={e => setItems(e.target.value)} rows={10} maxLength={12040} required disabled={saved} aria-describedby="property-checklist-help" />
      </label>
      <p id="property-checklist-help"><UiText text={"Între 1 și 40 de puncte distincte, maximum 300 de caractere fiecare. Pentru finalizarea lucrării, prestatorul va trebui să confirme fiecare punct."}/></p>
      {template.photoRulesAvailable&&<fieldset className="mt-3"><legend><UiText text={"Fotografii pentru proprietate și serviciu"}/></legend><label className="pro-field"><UiText text={"Minimum înainte de execuție · 0 dacă nu sunt necesare"}/><input type="number" min={0} max={20} required disabled={busy||saved} value={photos.arrivalMin} onChange={e=>setPhotos({...photos,arrivalMin:Number(e.target.value)})}/></label><label className="pro-field"><UiText text={"Minimum la finalizare"}/><input type="number" min={1} max={20} required disabled={busy||saved} value={photos.completionMin} onChange={e=>setPhotos({...photos,completionMin:Number(e.target.value)})}/></label><p><UiText text={"Maximum 20 de fotografii obligatorii în total. Cerințele rămân salvate în lucrare. O remediere cere dovezi noi; fotografiile din execuția anterioară nu sunt reutilizate."}/></p></fieldset>}
      <label className="pro-field mt-3"><UiText text={"Motivul modificării"}/><textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} required disabled={saved} />
      </label>
      <div className="pro-actions">
        <button className="v2-btn v2-btn-primary" disabled={busy || saved}>{busy ? <UiText text={"Se procesează…"}/> : <UiText text={"Publică lista pentru lucrările viitoare"}/>}</button>
        <button type="button" className="v2-btn v2-btn-secondary" disabled={busy || saved} onClick={() => setItems(CHECKLISTS[template.service].join("\n"))}><UiText text={"Preia punctele standard"}/></button>
      </div>
    </form>
    {saved && <p role="status"><UiText text={"Lista a fost publicată. Datele proprietății se actualizează."}/></p>}
    {error && <p role="alert" className="pro-error">{<UiText text={error}/>}</p>}
    <button type="button" className="v2-btn v2-btn-secondary mt-3" disabled={busy} onClick={() => loadHistory()}><UiText text={"Vezi istoricul acestui serviciu"}/></button>
    {history && <div className="mt-3">
      {!history.rows.length && <p><UiText text={"Nu există încă versiuni personalizate publicate."}/></p>}
      {history.rows.map(row => <details key={row.revision} className="mt-3">
        <summary><UiText text={"Versiunea "}/>{row.revision} · {<UiDate value={new Date(row.created_at!)} kind="dateTime"/>}</summary>
        <p>{row.reason}</p><p><UiText text={"Autor: "}/>{row.actor}</p>
        {row.photoRules && <p><UiText text={"Fotografii minime: "}/>{row.photoRules.arrivalMin}<UiText text={" înainte și "}/>{row.photoRules.completionMin}<UiText text={" la finalizare."}/></p>}
        <ol className="list-decimal pl-5">{row.items.map((item, i) => <li key={i}>{item}</li>)}</ol>
      </details>)}
      {history.next && <button type="button" className="v2-btn v2-btn-secondary mt-3" disabled={busy} onClick={() => loadHistory(history.next!)}><UiText text={"Versiuni mai vechi"}/></button>}
    </div>}
  </>;
}
