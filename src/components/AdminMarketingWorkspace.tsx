'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AdminMarketingDelivery } from './AdminMarketingDelivery';
import { AdminMarketingCampaignSend } from './AdminMarketingCampaignSend';
import { MARKETING_REGIONS,marketingRegion } from '@/lib/adminMarketingRegions';
import { readMarketingResponse } from '@/lib/adminMarketingResponse';
import { Card, inputClass } from './ui';
import { MARKETING_CATEGORIES, type MarketingCategory } from '@/lib/adminMarketingShared';
import { formatMarketingDate as date, CAMPAIGN_STATES, type MarketingAudience, type MarketingCampaign, type MarketingSettings, type MarketingSimulation, type MarketingWorkspace } from '@/lib/adminMarketingWorkspaceShared';

type Section = 'overview' | 'campaigns' | 'results' | 'settings' | 'collections';
const blankCampaign = (): MarketingCampaign => ({ id: '', version: 0, name: '', subject: '', body: '', category: '',county:'',variant:'',recipientLimit:null, city: '', ctaLabel: 'Descoperă NITIDO', ctaUrl: 'https://nitido.ro', budgetRon: null, state: 'draft', updatedAt: '' });
const amount = (value: number | null) => value === null ? 'Cost neconfigurat' : `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 6 }).format(value)} RON`;
function downloadHtml(html: string) { const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'campanie-marketing.html'; anchor.click(); URL.revokeObjectURL(url); }
async function command<T=unknown>(action: string, data?: unknown, id?: string) {
  const response = await fetch('/api/admin/marketing/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, data, id }) });
  const body = await readMarketingResponse<{result:T}>(response);return body.result;
}
function Collections({ data }: { data: MarketingWorkspace }) {
  return <section className="space-y-3"><h2 className="text-xl font-bold">Istoric colectare</h2>{!data.collections.length ? <p>Nu există loturi de colectare salvate.</p> : <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr>{['Data (zz/ll/aaaa)', 'Sursă', 'Selecție', 'Salvate', 'Duplicate', 'Excluse'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{data.collections.map(row => <tr key={row.id} className="border-t border-line"><td className="p-3">{date(row.createdAt)}</td><td className="p-3">{{anaf:'ANAF',csv:'CSV',openstreetmap:'OpenStreetMap',websites:'Site-uri firme'}[row.source] || row.source}</td><td className="p-3">{row.city || 'Toate localitățile'} · {MARKETING_CATEGORIES[row.category as MarketingCategory] || 'Toate categoriile'}</td><td className="p-3">{row.created}</td><td className="p-3">{row.duplicates}</td><td className="p-3">{row.excluded}</td></tr>)}</tbody></table></div>}</section>;
}
function CampaignMessage({ campaign }: { campaign: MarketingCampaign }) {
  return <div className="mt-4 rounded-xl border border-line bg-white p-4 space-y-3">
    <div><p className="text-sm text-muted">Subiectul emailului</p><p className="font-semibold break-words">{campaign.subject || 'Subiect necompletat'}</p></div>
    <details><summary className="cursor-pointer font-semibold">Textul emailului</summary>
      <p className="mt-3 whitespace-pre-wrap break-words">{campaign.body || 'Mesajul nu este completat.'}</p>
      {campaign.ctaLabel && campaign.ctaUrl && <p className="mt-3"><a className="underline break-words" href={campaign.ctaUrl} target="_blank" rel="noopener noreferrer">{campaign.ctaLabel}</a></p>}
    </details>
  </div>;
}
export function AdminMarketingWorkspace({ section, revision = 0, onContacts, onSettings, onCampaignContacts }: { section: Section; revision?: number; onContacts?: () => void; onSettings?: () => void; onCampaignContacts?: (campaign: MarketingCampaign) => void }) {
  const [data, setData] = useState<MarketingWorkspace | null>(null);
  const [settings, setSettings] = useState<MarketingSettings | null>(null);
  const [editor, setEditor] = useState<MarketingCampaign | null>(null);
  const [preview, setPreview] = useState<{ campaign: MarketingCampaign; audience: MarketingAudience } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [campaignCounty,setCampaignCounty]=useState(''),[campaignCategory,setCampaignCategory]=useState('');
  const locked = useRef(false);
  const previewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!preview) return;
    previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    previewRef.current?.focus({ preventScroll: true });
  }, [preview]);
  const load = useCallback(async (signal?: AbortSignal) => {
    try { const response = await fetch('/api/admin/marketing/workspace', { cache: 'no-store', signal }); const body = await readMarketingResponse<MarketingWorkspace>(response); if (!signal?.aborted) { setData(body); setSettings(body.settings);setError(''); } }
    catch (e) { if (!signal?.aborted) setError((e as Error).message); }
  }, []);
  useEffect(() => { const controller = new AbortController(); const timer = setTimeout(() => void load(controller.signal), 0); return () => { clearTimeout(timer); controller.abort(); }; }, [load, revision]);
  async function run(operation: () => Promise<void>) {
    if (locked.current) return; locked.current = true; setBusy(true); setError(''); setMessage('');
    try { await operation(); } catch (e) { setError((e as Error).message); } finally { locked.current = false; setBusy(false); }
  }
  async function showPreview(campaign: MarketingCampaign) { const audience = await command<MarketingAudience>('preview', undefined, campaign.id); setPreview({ campaign, audience }); }
  function submitCampaign(event: FormEvent) { event.preventDefault(); if (!editor) return; void run(async () => { const saved = await command<MarketingCampaign>('save', { ...editor, id: editor.id || undefined }); setEditor(null); setMessage('Campania a fost salvată ca ciornă.'); await load(); await showPreview(saved); }); }
  async function changeState(campaign: MarketingCampaign, state: MarketingCampaign['state']) {
    const updated = await command<MarketingCampaign>('state', { id: campaign.id, version: campaign.version, state }); setPreview(null); setMessage(`Campanie: ${CAMPAIGN_STATES[state]}.`); await load(); if (state === 'ready') await showPreview(updated);
  }
  if (!data) return <section className="space-y-3">{error ? <p role="alert" className="text-coral">{error}</p> : <p role="status">Se încarcă modulul Marketing…</p>}<button className="v2-btn v2-btn-secondary" onClick={() => void load()}>Reîncarcă</button></section>;
  const visibleCampaigns = data.campaigns.filter(campaign => (!campaignCounty || campaign.county === campaignCounty) && (!campaignCategory || campaign.category === campaignCategory));
  return <div className="space-y-5">
    {error && <p role="alert" className="rounded-xl bg-red-50 text-red-800 border border-red-200 p-4">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-green-50 text-green-900 border border-green-200 p-4">{message}</p>}
    {section === 'overview' && <>
      <h2 className="text-2xl font-bold">Panou general</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Contacte eligibile', data.totals.eligible], ['Campanii', data.totals.campaigns], ['Simulări efectuate', data.totals.simulations], ['Contacte verificate', data.totals.reviewed]].map(([label, value]) => <Card key={label}><p className="text-muted">{label}</p><b className="text-3xl">{value}</b></Card>)}</div>
      <Card><h3 className="font-bold text-lg">De la contact la campanie</h3><ol className="list-decimal pl-5 space-y-2 my-4"><li>Adaugă sau colectează contacte și înregistrează sursa.</li><li>Verifică datele, acordul și marchează contactul „Verificat”.</li><li>Completează expeditorul și limitele în Setări.</li><li>Creează campania, verifică destinatarii și previzualizarea.</li><li>Pregătește campania și pune-o în coada de test. Verifică mesajele capturate în Rezultate.</li></ol><p className="text-sm text-muted">Contactele fără acord, cele fără email și cele marcate „Nu contacta” sunt excluse. Simulările nu trimit emailuri și nu reprezintă livrări sau înscrieri reale.</p><button className="v2-btn v2-btn-secondary mt-4" onClick={onContacts}>Gestionează contactele</button></Card>
      <Collections data={data}/>
    </>}
    {section === 'collections' && <Collections data={data}/>}
    {section === 'settings' && settings && <section className="space-y-4"><h2 className="text-2xl font-bold">Setări Marketing</h2><Card><form onSubmit={event => { event.preventDefault(); void run(async () => { await command('settings', settings); setMessage('Setările Marketing au fost salvate.'); setPreview(null); await load(); }); }}><fieldset disabled={busy} className="grid sm:grid-cols-2 gap-4">
      <label>Nume expeditor<input className={inputClass} required maxLength={120} value={settings.senderName} onChange={e => setSettings({ ...settings, senderName: e.target.value })}/></label>
      <label>Email expeditor<input className={inputClass} type="email" maxLength={254} value={settings.senderEmail} onChange={e => setSettings({ ...settings, senderEmail: e.target.value })}/></label>
      <div><label>Email pentru răspunsuri<input className={inputClass} type="email" maxLength={254} value={settings.replyTo} onChange={e => setSettings({ ...settings, replyTo: e.target.value })}/></label><button type="button" className="underline text-sm mt-2" disabled={!settings.senderEmail} onClick={() => setSettings({ ...settings, replyTo: settings.senderEmail })}>Folosește adresa expeditorului pentru răspunsuri</button></div>
      <label>Adresă poștală<input className={inputClass} maxLength={500} value={settings.postalAddress} onChange={e => setSettings({ ...settings, postalAddress: e.target.value })}/></label>
      <label>Limită zilnică de expediere<input className={inputClass} type="number" min={1} max={5000} required value={settings.dailyLimit} onChange={e => setSettings({ ...settings, dailyLimit: Number(e.target.value) })}/></label>
      <label>Cost estimat per email · RON<input className={inputClass} type="number" min={0} max={1000000} step="0.000001" value={settings.unitCostRon ?? ''} onChange={e => setSettings({ ...settings, unitCostRon: e.target.value === '' ? null : Number(e.target.value) })}/></label>
      <label>Buget lunar planificat · RON<input className={inputClass} type="number" min={0} max={1000000} step="0.01" value={settings.monthlyBudgetRon ?? ''} onChange={e => setSettings({ ...settings, monthlyBudgetRon: e.target.value === '' ? null : Number(e.target.value) })}/></label>
      <p className="sm:col-span-2 text-sm text-muted">Costul este estimarea introdusă de tine, nu un tarif confirmat de furnizor. Setările nu activează trimiterea și nu modifică serviciul de email al aplicației.</p>
      <button className="v2-btn v2-btn-primary justify-self-start">{busy ? 'Se salvează…' : 'Salvează setările Marketing'}</button>
    </fieldset></form></Card><Card><h3 className="font-bold">Acces și trimitere</h3><p className="mt-2">Acces exclusiv administratorului. {data.deliveryEnabled ? 'Trimiterea reală este activată prin configurarea serverului.' : 'Trimiterea reală este oprită.'} Datele și rapoartele sunt vizibile numai în ADMIN.</p></Card></section>}
    {section === 'campaigns' && <section className="space-y-5"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-2xl font-bold">Campanii</h2><button className="v2-btn v2-btn-secondary" disabled={busy} onClick={() => void run(async () => { setPreview(null); await load(); })}>Reîncarcă lista</button><button className="v2-btn v2-btn-primary" disabled={busy} onClick={() => { setEditor(blankCampaign()); setPreview(null); }}>Campanie nouă</button><button className="v2-btn v2-btn-secondary" disabled={busy} onClick={()=>void run(async()=>{const result=await command<{created:number;existing:number}>('prepareDrafts');setMessage(`${result.created} ciorne create; ${result.existing} existente păstrate. Trimiterea rămâne oprită.`);await load();})}>Pregătește ciornele pe județe</button></div>
      {editor && <Card><form onSubmit={submitCampaign}><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2"><h3 className="font-bold text-xl sm:col-span-2">{editor.id ? 'Editează campania' : 'Campanie nouă'}</h3>
        <label>Nume campanie<input className={inputClass} required maxLength={180} value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })}/></label>
        <label>Subiect email<input className={inputClass} maxLength={200} value={editor.subject} onChange={e => setEditor({ ...editor, subject: e.target.value })}/></label>
        <label>Categorie destinatari<select className={inputClass} value={editor.category} onChange={e => setEditor({ ...editor, category: e.target.value as MarketingCampaign['category'] })}><option value="">Toate categoriile</option>{Object.entries(MARKETING_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Județ destinatari<select className={inputClass} value={editor.county??''} onChange={e=>setEditor({...editor,county:e.target.value,city:''})}><option value="">Toate județele</option>{MARKETING_REGIONS.map(r=><option key={r.code} value={r.code}>{r.name}</option>)}</select></label>
        <label>Variantă de test<select className={inputClass} value={editor.variant??''} onChange={e=>setEditor({...editor,variant:e.target.value as ''|'A'|'B'})}><option value="">Fără împărțire A/B</option><option value="A">A</option><option value="B">B</option></select><span className="text-sm text-muted">Aceeași adresă aparține unei singure variante.</span></label>
        <label>Destinatari în lot (opțional)<input className={inputClass} type="number" min={1} max={5000} value={editor.recipientLimit??''} onChange={e=>setEditor({...editor,recipientLimit:e.target.value?Number(e.target.value):null})}/><span className="text-sm text-muted">Limitează rularea, fără a trunchia baza de contacte.</span></label>
        <label>Localitate destinatari<input className={inputClass} maxLength={100} value={editor.city} onChange={e => setEditor({ ...editor, city: e.target.value })}/></label>
        <label className="sm:col-span-2">Mesaj<textarea className={inputClass} rows={7} maxLength={10000} value={editor.body} onChange={e => setEditor({ ...editor, body: e.target.value })}/></label>
        <label>Text buton<input className={inputClass} maxLength={100} value={editor.ctaLabel} onChange={e => setEditor({ ...editor, ctaLabel: e.target.value })}/></label>
        <label>Adresă buton<input className={inputClass} type="url" maxLength={1000} value={editor.ctaUrl} onChange={e => setEditor({ ...editor, ctaUrl: e.target.value })}/></label>
        <label>Buget campanie · RON<input className={inputClass} type="number" step="0.01" min={0} max={1000000} value={editor.budgetRon ?? ''} onChange={e => setEditor({ ...editor, budgetRon: e.target.value === '' ? null : Number(e.target.value) })}/></label>
        <p className="text-sm text-muted self-center">Salvarea modificărilor readuce campania în Ciornă, pentru reverificarea selecției.</p>
        <div className="flex flex-wrap gap-3 sm:col-span-2"><button className="v2-btn v2-btn-primary">Salvează și previzualizează</button><button type="button" className="v2-btn v2-btn-secondary" onClick={() => setEditor(null)}>Închide editorul</button></div>
      </fieldset></form></Card>}
      <div className="grid sm:grid-cols-2 gap-3"><label>Campanii din județ<select className={inputClass} value={campaignCounty} onChange={e=>{setCampaignCounty(e.target.value);setPreview(null);}}><option value="">Toate județele</option>{MARKETING_REGIONS.map(r=><option key={r.code} value={r.code}>{r.name}</option>)}</select></label><label>Audiență<select className={inputClass} value={campaignCategory} onChange={e=>{setCampaignCategory(e.target.value);setPreview(null);}}><option value="">Toate categoriile</option>{Object.entries(MARKETING_CATEGORIES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>
      {!data.campaigns.length && <Card>Nu există campanii. Creează prima ciornă și verifică selecția înainte de simulare.</Card>}
      <p className="text-sm text-muted">{visibleCampaigns.length} din {data.campaigns.length} campanii. Subiectul și textul emailului sunt disponibile în fiecare card.</p>
      {data.campaigns.length > 0 && visibleCampaigns.length === 0 && <Card><p>Nu există campanii pentru județul și audiența selectate.</p><button className="v2-btn v2-btn-secondary mt-3" onClick={() => { setCampaignCounty(''); setCampaignCategory(''); setPreview(null); }}>Resetează filtrele</button></Card>}
      <div className="grid gap-4">{visibleCampaigns.map(campaign => <Card key={campaign.id}><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold text-lg">{campaign.name}</h3><p className="text-sm">{CAMPAIGN_STATES[campaign.state]} · {MARKETING_CATEGORIES[campaign.category as MarketingCategory] || 'Toate categoriile'} · {marketingRegion(campaign.county)?.name||'Toate județele'} · {campaign.city || 'Toate localitățile'}{campaign.variant?` · Varianta ${campaign.variant}`:''}</p><p className="text-muted text-sm">Actualizată {date(campaign.updatedAt)}</p></div></div><CampaignMessage campaign={campaign}/><div className="flex flex-wrap gap-2 mt-4">
        <button className="v2-btn v2-btn-secondary" disabled={busy} onClick={() => void run(() => showPreview(campaign))}>Previzualizează emailul</button>
        {campaign.state !== 'archived' && <><button className="v2-btn v2-btn-secondary" disabled={busy} onClick={() => { setEditor({ ...campaign }); setPreview(null); }}>Editează</button>{campaign.state === 'ready' && <><button className="v2-btn v2-btn-primary" disabled={busy} onClick={() => void run(async () => { const result = await command<{simulation:MarketingSimulation}>('simulate', { id: campaign.id, version: campaign.version, requestId: crypto.randomUUID() }); setMessage(`Simulare finalizată: ${result.simulation.eligible} destinatari eligibili, ${result.simulation.excluded} excluși, 0 emailuri trimise real.`); setPreview(null); await load(); })}>Rulează simularea</button><button className="v2-btn v2-btn-secondary" disabled={busy} onClick={() => void run(() => changeState(campaign, 'paused'))}>Pauză</button></>}<button className="v2-btn v2-btn-secondary" disabled={busy} onClick={() => void run(() => changeState(campaign, 'archived'))}>Arhivează</button></>}
      </div>
      <AdminMarketingCampaignSend campaign={campaign} onChanged={load} onCreated={async created => { await load(); await showPreview(created); }} onSettings={onSettings} onContacts={() => onCampaignContacts ? onCampaignContacts(campaign) : onContacts?.()}/>
      {preview?.campaign.id === campaign.id && <div ref={previewRef} role="region" aria-label={`Previzualizare ${campaign.name}`} tabIndex={-1} className="mt-4 border-t border-line pt-4"><h3 className="text-xl font-bold">Previzualizare · {preview.campaign.name}</h3><div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">{[['În selecție', preview.audience.selected], ['Eligibili', preview.audience.eligible], ['Excluși', preview.audience.excluded],['În afara lotului',preview.audience.deferred], ['Cost estimat', amount(preview.audience.estimatedCostRon)]].map(([label, value]) => <div key={label}><p className="text-sm text-muted">{label}</p><b>{value}</b></div>)}</div><ul className="text-sm space-y-1 mb-4"><li>Nu contacta / acord retras: {preview.audience.reasons.suppressed}</li><li>Fără email: {preview.audience.reasons.noEmail}</li><li>Fără acord documentat: {preview.audience.reasons.noConsent}</li><li>Contacte nerevizuite: {preview.audience.reasons.notReviewed}</li><li>Emailuri neverificate tehnic: {preview.audience.reasons.unverifiedEmail??0}</li><li>Emailuri duplicate: {preview.audience.reasons.duplicate}</li></ul>{!!preview.audience.blockers.length && <div role="status" className="p-4 rounded-xl bg-amber-50 border border-amber-200 mb-4"><b>Înainte de pregătire:</b><ul className="list-disc pl-5">{preview.audience.blockers.map(reason => <li key={reason}>{reason}</li>)}</ul></div>}<iframe title="Previzualizare email Marketing" srcDoc={preview.audience.html} sandbox="" referrerPolicy="no-referrer" className="w-full min-h-96 rounded-xl border border-line bg-white"/><button className="v2-btn v2-btn-secondary mt-4" onClick={() => downloadHtml(preview.audience.html)}>Descarcă previzualizarea HTML</button></div>}
      </Card>)}</div>
    </section>}
    {['campaigns','results','settings'].includes(section) && <AdminMarketingDelivery/>}
    {section === 'results' && <section className="space-y-4"><h2 className="text-2xl font-bold">Rezultate</h2><div className="grid gap-3 sm:grid-cols-3"><Card><p>Simulări</p><b className="text-3xl">{data.totals.simulations}</b></Card><Card><p>Destinatari în simulări</p><b className="text-3xl">{data.totals.simulatedRecipients}</b></Card></div><p className="text-sm text-muted">Simulările verifică selecția și conținutul; nu reprezintă livrări, deschideri, clicuri sau înscrieri. Rapoartele cozii sunt afișate separat mai sus.</p>{!data.simulations.length ? <Card>Nu există simulări. Pregătește o campanie și rulează prima verificare.</Card> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Data (zz/ll/aaaa)', 'Campanie', 'Eligibili', 'Excluși', 'Cost estimat', 'Emailuri reale'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{data.simulations.map(row => <tr key={row.id} className="border-t border-line"><td className="p-3">{date(row.createdAt)}</td><td className="p-3">{row.campaignName}</td><td className="p-3">{row.eligible}</td><td className="p-3">{row.excluded}</td><td className="p-3">{amount(row.estimatedCostRon)}</td><td className="p-3">0</td></tr>)}</tbody></table></div>}</section>}
  </div>;
}
