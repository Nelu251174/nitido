'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { marketingRegion } from '@/lib/adminMarketingRegions';
import { MARKETING_CATEGORIES, type MarketingCategory } from '@/lib/adminMarketingShared';
import { readMarketingResponse } from '@/lib/adminMarketingResponse';
import type { MarketingAudience, MarketingCampaign } from '@/lib/adminMarketingWorkspaceShared';

type Readiness = { enabled: boolean; providerConfigured: boolean; webhookConfigured: boolean };
async function workspace<T>(action: string, data?: unknown, id?: string): Promise<T> {
  const response = await fetch('/api/admin/marketing/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, data, id }) });
  return (await readMarketingResponse<{ result: T }>(response)).result;
}
export function AdminMarketingCampaignSend({ campaign, onChanged, onSettings, onContacts, onCreated }: {
  campaign: MarketingCampaign; onChanged: () => Promise<void>; onSettings?: () => void; onContacts?: () => void; onCreated?: (created: MarketingCampaign) => Promise<void>;
}) {
  const [all, setAll] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [confirmed, setConfirmed] = useState(false);
  const [inspection, setInspection] = useState<{ campaign: MarketingCampaign; audience: MarketingAudience; readiness: Readiness } | null>(null);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null), titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    else if (!open && dialog?.open) dialog.close();
  }, [open]);
  const lock = useRef(false), requests = useRef<Record<string, string>>({});
  const checked = inspection?.campaign.version === campaign.version ? inspection : null;
  const scope = `${marketingRegion(campaign.county)?.name || 'Toate județele'} · ${campaign.city || 'Toate localitățile'} · ${MARKETING_CATEGORIES[campaign.category as MarketingCategory] || 'Toate categoriile'}`;
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  async function inspect(prepare: boolean) {
    setOpen(true); setConfirmed(false); setInspection(null);
    let current = campaign;
    // Scope changes are explicit and saved before preview; no contact status or consent is changed.
    if (prepare && all && (campaign.variant || campaign.recipientLimit != null)) {
      current = await workspace<MarketingCampaign>('save', { ...campaign, variant: '', recipientLimit: null, name: campaign.name.replace(/ · [AB]$/, '') + ' · Audiență completă' });
      await onChanged();
    }
    const audience = await workspace<MarketingAudience>('preview', undefined, current.id);
    const response = await fetch('/api/admin/marketing/delivery', { cache: 'no-store' });
    const report = await readMarketingResponse<{ readiness: Readiness }>(response);
    setInspection({ campaign: current, audience, readiness: report.readiness });
    if (prepare && !audience.blockers.length && current.state !== 'ready') {
      current = await workspace<MarketingCampaign>('state', { id: current.id, version: current.version, state: 'ready' });
      setInspection({ campaign: current, audience, readiness: report.readiness });
      await onChanged();
    }
    if (prepare) setMessage(audience.blockers.length ? 'Campania nu este pregătită. Rezolvă punctele afișate mai jos.' : 'Campania este pregătită. Nu a fost trimis niciun email.');
  }
  async function queue(mode: 'test' | 'live') {
    if (!checked || campaign.state !== 'ready' || checked.audience.blockers.length || (mode === 'live' && (!confirmed || !checked.readiness.enabled || !checked.readiness.providerConfigured || !checked.readiness.webhookConfigured))) return;
    const key = `${campaign.id}:${campaign.version}:${mode}`;
    const requestId = requests.current[key] ??= crypto.randomUUID();
    const response = await fetch('/api/admin/marketing/delivery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'queue', data: { id: campaign.id, version: campaign.version, requestId, mode } }) });
    await readMarketingResponse(response);
    setConfirmed(false);
    setMessage(mode === 'test' ? 'Test pornit fără expediere. Vezi mesajele capturate în Expediere și rapoarte.' : 'Trimitere pornită manual. Mesajele sunt în coadă; urmărește livrările în Expediere și rapoarte.');
  }
  async function createDraft() {
    const created = await workspace<MarketingCampaign>('save', { ...campaign, id: undefined, version: 0, state: 'draft', name: campaign.name.slice(0, 165) + ' · Ciornă' });
    setMessage('Ciorna a fost creată. Campania arhivată a fost păstrată.');
    if (onCreated) await onCreated(created); else await onChanged();
  }
  const blocked = !checked || !!checked.audience.blockers.length || campaign.state !== 'ready';
  return <section className="mt-4 border-t border-line pt-4 space-y-3" aria-label={`Expediere ${campaign.name}`}>
    <p className="font-semibold">Destinatari: {scope}</p>
    {campaign.audienceMode==='public_business' && <p className="text-sm">Campanie B2B către adrese publice de firme, cu sursă și domeniu verificate. Acordurile rămân înregistrate separat; persoanele fizice și contactele dezabonate sunt excluse.</p>}
    {campaign.state === 'archived' ? <><p>Campanie arhivată. Pentru a folosi acest text, creează o ciornă nouă. Istoricul rămâne păstrat.</p><button className="v2-btn v2-btn-primary" disabled={busy} onClick={() => void run(createDraft)}>{busy ? 'Se creează ciorna…' : 'Creează ciornă din această campanie'}</button></> : <>
      <p className="text-sm text-muted">Selecție salvată: {campaign.variant ? `varianta ${campaign.variant} (împărțire A/B)` : 'fără împărțire A/B'} · {campaign.recipientLimit == null ? 'toți destinatarii eligibili' : `maximum ${campaign.recipientLimit} destinatari`}. Adresele comune sunt deduplicate.</p>
      <label className="flex gap-2 items-start"><input type="checkbox" disabled={busy} checked={all} onChange={e => { setAll(e.target.checked); setInspection(null); setConfirmed(false); }}/>Folosește acest text pentru întreaga audiență eligibilă din selecția de mai sus, fără împărțire A/B și fără plafon de destinatari.</label>
      <div className="flex flex-wrap gap-3"><button className="v2-btn v2-btn-primary" disabled={busy} onClick={() => void run(() => inspect(true))}>Pregătește campania</button><button className="v2-btn v2-btn-secondary" disabled={busy} onClick={() => void run(() => inspect(false))}>Trimite emailuri în masă</button></div>
      <p className="text-sm text-muted">Pregătirea și verificarea nu expediază emailuri. Trimiterea pornește numai după confirmarea manuală de mai jos. Pentru schimbarea selecției, bifează opțiunea și apasă „Pregătește campania”.</p>
    </>}
    {!open && error && <p role="alert" className="text-red-800">{error}</p>}{!open && message && <p role="status">{message}</p>}
    <dialog ref={dialogRef} aria-labelledby={titleId} onClose={() => setOpen(false)} onCancel={() => setOpen(false)} className="m-auto w-[calc(100%-2rem)] max-w-3xl max-h-[90dvh] overflow-y-auto rounded-2xl border border-line bg-white p-6 text-ink backdrop:bg-black/50">
      <div className="flex items-start justify-between gap-4"><div><h2 id={titleId} className="text-xl font-bold">Trimitere în masă · {campaign.name}</h2><p className="mt-2">{scope}</p></div><button className="v2-btn v2-btn-secondary" onClick={() => setOpen(false)}>Închide</button></div>
      {busy && !checked && <p role="status" className="mt-4">Se verifică destinatarii și configurarea expedierii…</p>}
      {error && <p role="alert" className="mt-4 text-red-800">{error}</p>}{message && <p role="status" className="mt-4">{message}</p>}
    {checked && <div className="rounded-xl border border-line p-4 space-y-3" role="region" aria-label="Verificare înainte de expediere">
      <p><b>{checked.audience.selected}</b> contacte în selecție · <b>{checked.audience.eligible}</b> emailuri eligibile · {checked.audience.excluded} excluse · {checked.audience.deferred} în afara variantei sau limitei salvate.</p>
      <ul className="text-sm list-disc pl-5"><li>Excluse pentru lipsa acordului: {checked.audience.reasons.noConsent}</li><li>Excluse pentru lipsa revizuirii: {checked.audience.reasons.notReviewed}</li><li>Emailuri neverificate tehnic: {checked.audience.reasons.unverifiedEmail}</li><li>Fără email: {checked.audience.reasons.noEmail}</li><li>Nu contacta / dezabonate: {checked.audience.reasons.suppressed}</li><li>Duplicate: {checked.audience.reasons.duplicate}</li></ul>
      {!!checked.audience.blockers.length && <div role="status"><b>Pregătire blocată:</b><ul className="list-disc pl-5">{checked.audience.blockers.map(reason => <li key={reason}>{reason}</li>)}</ul></div>}
      <p>Trimitere reală: <b>{checked.readiness.enabled ? 'activată' : 'oprită'}</b> · Serviciu email: {checked.readiness.providerConfigured ? 'configurat' : 'neconfigurat'} · Confirmări livrare: {checked.readiness.webhookConfigured ? 'configurate' : 'neconfigurate'}</p>
      {(!checked.readiness.enabled || !checked.readiness.providerConfigured || !checked.readiness.webhookConfigured) && <p role="status">Expedierea reală este blocată până la activarea și configurarea completă a serviciului. Pregătirea nu modifică aceste setări.</p>}
      <div className="flex flex-wrap gap-3">{onSettings && <button className="v2-btn v2-btn-secondary" onClick={onSettings}>Completează datele în Setări</button>}{onContacts && <button className="v2-btn v2-btn-secondary" onClick={onContacts}>Verifică acordurile și contactele</button>}<button className="v2-btn v2-btn-secondary" disabled={busy} onClick={() => void run(() => inspect(false))}>Reverifică destinatarii</button></div>
      <label className="flex gap-2 items-start"><input type="checkbox" disabled={blocked || !checked.readiness.enabled || !checked.readiness.providerConfigured || !checked.readiness.webhookConfigured} checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>Confirm textul campaniei „{campaign.name}” și expedierea reală către {checked.audience.eligible} emailuri eligibile din {scope}.</label>
      <div className="flex flex-wrap gap-3"><button className="v2-btn v2-btn-secondary" disabled={busy || blocked} onClick={() => void run(() => queue('test'))}>Testează fără expediere</button><button className="v2-btn v2-btn-primary" disabled={busy || blocked || !confirmed || !checked.readiness.enabled || !checked.readiness.providerConfigured || !checked.readiness.webhookConfigured} onClick={() => void run(() => queue('live'))}>Confirmă și trimite emailurile</button></div>
      <p className="text-sm text-muted">Coada păstrează întreaga selecție eligibilă. Procesarea respectă limita zilnică și bugetele; acestea nu reduc numărul total al destinatarilor. O adresă publică și verificarea tehnică nu reprezintă acord pentru Marketing.</p>
    </div>}
    </dialog>
  </section>;
}
