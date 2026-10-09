'use client';
import { useEffect, useState } from 'react';
import { QUALIFICATION_BASIS, QUALIFICATION_OUTCOMES } from '@/lib/assessmentQualificationShared';
import type { AssessmentQualification, QualificationReport } from '@/lib/assessmentQualification';
import { CATALOG_CATEGORIES } from '@/lib/serviceCatalog';
const endpoint = '/api/admin/assessment-qualification';
const date = (value: string) => new Date(value).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' });
async function request(url: string, body?: unknown) {
  const response = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  const data = await response.json(); if (!response.ok) throw Error(data.error || 'Verificare neconfirmată.'); return data;
}
export function AdminAssessmentQualification({ id }: { id: string }) {
  const [state, setState] = useState<AssessmentQualification | null>(null), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const url = endpoint + '?id=' + encodeURIComponent(id);
  async function load() { setState(await request(url)); }
  useEffect(() => { let live = true; request(url).then(data => { if (live) setState(data); }).catch(error => { if (live) setError(error.message); }); return () => { live = false; }; }, [url]);
  async function verify() {
    if (!state || busy) return; setBusy(true); setError('');
    try { await request(endpoint, { id, assessmentVersion: state.assessmentVersion, revision: state.revision, reason }); await load(); setReason(''); }
    catch (error) { setError(error instanceof Error ? error.message : 'Verificare neconfirmată.'); }
    finally { setBusy(false); }
  }
  return <section className="design-panel admin-qualification my-3 space-y-3" style={{ background: '#f7f3ec', minWidth: 0 }}>
    <h3 className="font-bold">Pregătire operațională pentru plan</h3><p>{QUALIFICATION_BASIS}</p>
    {error && <p role="alert">{error}</p>}
    <button type="button" className="v2-btn v2-btn-secondary" disabled={busy} onClick={() => void load().then(() => setError('')).catch(error => setError(error.message))}>Actualizează verificarea</button>
    {state && <><p><b>{QUALIFICATION_OUTCOMES[state.state]}</b>{state.stale && ' · verificarea anterioară nu mai corespunde datelor curente'}</p>
      {state.observation && <ul>{state.observation.snapshot.checks.map(check => <li key={check}>{check}</li>)}</ul>}
      {state.tracked ? <form className="space-y-2" onSubmit={event => { event.preventDefault(); void verify(); }}><label className="block">Motivul verificării interne<textarea className="w-full rounded-xl border p-3" maxLength={2000} required value={reason} onChange={event => setReason(event.target.value)} disabled={busy} /></label><button className="v2-btn v2-btn-primary" disabled={busy || !reason.trim()}>Reverifică planul, capacitatea și dovezile</button></form> : <p>Cererea precedă jurnalul prospectiv. Nu reconstruim calificarea istorică din starea de astăzi; fluxurile sale existente rămân disponibile.</p>}
      <details><summary>Istoric: maximum 50 de evenimente pe pagină</summary>{state.history.map(event => <p key={event.revision}>Revizia {event.revision} · {QUALIFICATION_OUTCOMES[event.outcome]} · {date(event.created_at)} · autor {event.actor_id} · {event.reason}</p>)}{state.hasMore && <button type="button" className="v2-btn v2-btn-secondary" onClick={() => void request(url + '&before=' + state.history[state.history.length - 1].revision).then(page => setState(current => current ? { ...current, history: page.history, hasMore: page.hasMore } : current)).catch(error => setError(error.message))}>Evenimente mai vechi</button>}</details>
    </>}
  </section>;
}
export function AdminQualificationReport() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const today = ['year', 'month', 'day'].map(key => parts.find(part => part.type === key)!.value).join('-');
  const [from, setFrom] = useState(today.slice(0, 8) + '01'), [to, setTo] = useState(today), [city, setCity] = useState(''), [category, setCategory] = useState(''), [client, setClient] = useState('');
  const [report, setReport] = useState<QualificationReport | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function load() { setBusy(true); setError(''); try { setReport(await request(endpoint + '?' + new URLSearchParams({ from, to, city, category, client }))); } catch (error) { setReport(null); setError(error instanceof Error ? error.message : 'Raport neconfirmat.'); } finally { setBusy(false); } }
  return <section className="design-panel admin-qualification my-4 space-y-3" style={{ background: '#f7f3ec', minWidth: 0 }}>
    <h3 className="font-bold">Cohorta cererilor și pregătirea planurilor</h3><p>{QUALIFICATION_BASIS}</p>
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); void load(); }}><label>De la (România)<input className="w-full rounded-xl border p-3" type="date" required value={from} onChange={event => setFrom(event.target.value)} /></label><label>Până la (România)<input className="w-full rounded-xl border p-3" type="date" required value={to} onChange={event => setTo(event.target.value)} /></label><label>Localitate exactă<input className="w-full rounded-xl border p-3" maxLength={100} value={city} onChange={event => setCity(event.target.value)} /></label><label>Serviciu<select className="w-full rounded-xl border p-3" value={category} onChange={event => setCategory(event.target.value)}><option value="">Toate</option>{CATALOG_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Identificator client<input className="w-full rounded-xl border p-3" maxLength={100} value={client} onChange={event => setClient(event.target.value)} /></label><button className="v2-btn v2-btn-primary" disabled={busy}>Calculează cohorta completă</button></form>
    {error && <p role="alert">{error}</p>}
    {report && <><p>{report.cohort}</p><dl className="grid gap-3 sm:grid-cols-2"><div><dt>Total cereri</dt><dd>{report.counts.total}</dd></div><div><dt>Pregătire confirmată pentru plan</dt><dd>{report.counts.ready}</dd></div><div><dt>Capacitate indisponibilă în intervalul verificat</dt><dd>{report.counts.unavailable}</dd></div><div><dt>Pregătire încă neverificată/incompletă</dt><dd>{report.counts.pending}, din care {report.counts.stale} cu verificare expirată sau date schimbate</dd></div><div><dt>Istoric fără jurnal prospectiv</dt><dd>{report.counts.legacy_unknown}</dd></div><div><dt>Cereri anulate sau nepreluate</dt><dd>{report.counts.cancelledOrDeclined} (incluse în total)</dd></div><div><dt>Cereri cu rezervare asociată</dt><dd>{report.counts.bookingsLinked}, din care {report.counts.trackedBookingsLinked} urmărite prospectiv</dd></div></dl><p>{report.eligibleConversion.reason}</p></>}
  </section>;
}
