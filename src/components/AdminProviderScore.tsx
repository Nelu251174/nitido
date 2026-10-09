'use client';
import { useState } from 'react';
import { SCORE_COMPONENTS, type ScoreComponent } from '@/lib/providerScoreShared';
import type { providerScoreReport } from '@/lib/providerScoreReport';
import { inputClass } from './ui';
type Report = ReturnType<typeof providerScoreReport>;
export function AdminProviderScore({ canManage = false }: { canManage?: boolean }) {
  const [report, setReport] = useState<Report | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function load() {
    setBusy(true); setMessage('');
    try { const response = await fetch('/api/admin/provider-score', { cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw Error(data.error); setReport(data); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Raport indisponibil.'); }
    finally { setBusy(false); }
  }
  async function save(form: HTMLFormElement) {
    const fields = new FormData(form), weights = Object.fromEntries((Object.keys(SCORE_COMPONENTS) as ScoreComponent[]).map(key => [key, Number(fields.get(key))]));
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/provider-score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: report?.policy?.revision ?? 0, reason: fields.get('reason'), definition: { mode: 'observation', periodDays: Number(fields.get('periodDays')), minimumCompletedJobs: Number(fields.get('minimumCompletedJobs')), minimumSamples: Number(fields.get('minimumSamples')), weights } }) });
      const data = await response.json(); if (!response.ok) throw Error(data.error);
      await load(); setMessage('Regula a fost salvată pentru observare.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Regula nu a putut fi salvată.'); }
    finally { setBusy(false); }
  }
  return <section className="workspace-panel space-y-4" style={{ background: '#f7f3ec', border: '1px solid #ddd4c5', borderRadius: 20, padding: 24, minWidth: 0 }}>
    <h2 className="text-xl font-bold">Provider Score — observare</h2>
    <p>Compară calitatea pe baza unei reguli explicite și a unei perioade comune. Datele insuficiente rămân nemăsurabile. Scorul nu schimbă alocarea, eligibilitatea sau suspendarea. Marja comercială rămâne separată.</p>
    <button className="v2-btn v2-btn-secondary" disabled={busy} onClick={() => void load()}>{busy ? 'Se încarcă…' : 'Încarcă regulile și rezultatele'}</button>
    {message && <p role="status">{message}</p>}
    {report && <>
      {!report.policy ? <p>Nu există ponderi configurate. Nu se calculează un scor implicit.</p> : <p>Revizia {report.policy.revision} · {report.period?.from}–{report.period?.to}, ora României. Datele din ziua curentă sunt încă în evoluție.</p>}
      {canManage && <form key={report.policy?.revision ?? 0} onSubmit={event => { event.preventDefault(); void save(event.currentTarget); }} className="grid gap-3 sm:grid-cols-2">
        <label>Perioadă în zile<input className={inputClass} name="periodDays" type="number" min={1} max={365} required defaultValue={report.policy?.definition.periodDays}/></label>
        <label>Minimum lucrări finalizate<input className={inputClass} name="minimumCompletedJobs" type="number" min={1} max={10000} required defaultValue={report.policy?.definition.minimumCompletedJobs}/></label>
        <label>Minimum măsurători pe componentă<input className={inputClass} name="minimumSamples" type="number" min={1} max={10000} required defaultValue={report.policy?.definition.minimumSamples}/></label>
        {(Object.entries(SCORE_COMPONENTS) as [ScoreComponent, string][]).map(([key, label]) => <label key={key}>{label} · pondere %<input className={inputClass} name={key} type="number" min={0} max={100} required defaultValue={report.policy?.definition.weights[key] ?? 0}/></label>)}
        <p className="sm:col-span-2">Ponderile trebuie să totalizeze 100%. O pondere zero exclude componenta. Sesizările neconfirmate nu devin penalizări; componenta reclamațiilor rămâne nemăsurabilă cât timp verificările lipsesc. Fotografiile numărate nu certifică singure calitatea serviciului.</p>
        <label className="sm:col-span-2">Motivul regulii<textarea className={inputClass} name="reason" required maxLength={2000}/></label>
        <button className="v2-btn v2-btn-primary" disabled={busy}>Salvează pentru observare</button>
      </form>}
      <div className="grid gap-3 md:grid-cols-2">{report.providers.map(provider => <article key={provider.id} className="rounded-xl border p-4 min-w-0" style={{ background: '#fbf7ef', borderColor: '#ddd4c5' }}>
        <h3 className="font-bold break-words">{provider.name}</h3><p>{provider.observation.score === null ? 'Scor nemăsurabil' : `Scor de observare: ${provider.observation.score} / 100`} · {provider.completedJobs} lucrări finalizate</p>
        {provider.observation.reasons.map(reason => <p key={reason}>{reason}</p>)}
        <ul>{provider.observation.components.map(component => <li key={component.key}>{component.label}: {component.percent === null ? 'date insuficiente' : component.percent.toFixed(1) + '%'} · {component.samples} măsurători · pondere {component.weight}%</li>)}</ul>
      </article>)}</div>
    </>}
  </section>;
}
