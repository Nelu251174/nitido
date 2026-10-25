'use client';

import Link from 'next/link';
import { AdminMarketingSignups } from './AdminMarketingSignups';
import { AdminMarketingCounties } from './AdminMarketingCounties';
import { AdminMarketingCsvImport } from './AdminMarketingCsvImport';
import { MARKETING_REGIONS,MARKETING_EMAIL_VERIFICATIONS } from '@/lib/adminMarketingRegions';
import { AdminMarketingCityCollection } from './AdminMarketingCityCollection';
import { AdminMarketingRegrant } from './AdminMarketingRegrant';
import { AdminMarketingPublicCollection } from './AdminMarketingPublicCollection';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { MARKETING_CATEGORIES, MARKETING_CONSENTS, MARKETING_STATUSES, type MarketingCategory, type MarketingContact, type MarketingInput, type MarketingList } from '@/lib/adminMarketingShared';
import { Card, inputClass } from './ui';
import { AdminMarketingWorkspace } from './AdminMarketingWorkspace';

const emptyContact: MarketingInput = { name: '', category: 'business', email: '', phone: '', city: '', county:'', cui: '', website: '', source: '', consent: 'not_recorded', consentEvidence: '', notes: '' };
const template = 'name,category,email,phone,county,city,cui,website,source,consent,consentEvidence,notes\r\nFirma exemplu,business,contact@example.com,,București,București,,https://example.com,Import administrativ,not_recorded,,\r\n';
async function api(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(`/api/admin/marketing/${path}`, { method, cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Operațiunea nu a reușit.');
  return data;
}
function downloadTemplate() {
  const url = URL.createObjectURL(new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'model-contacte-marketing.csv'; anchor.click(); URL.revokeObjectURL(url);
}
function CategoryOptions({ all = false }: { all?: boolean }) {
  return <>{all && <option value="">Toate categoriile</option>}{Object.entries(MARKETING_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</>;
}

export function AdminMarketing({ testEnvironment = true }: { testEnvironment?: boolean }) {
  const [tab, setTab] = useState<'signups' | 'counties' | 'overview' | 'contacts' | 'collect' | 'campaigns' | 'results' | 'settings'>('counties');
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [list, setList] = useState<MarketingList | null>(null);
  const [filters, setFilters] = useState({ category: '', county:'',city: '', search: '', status: '',emailVerification:'' });
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const operationRunning = useRef(false);
  const loadSequence = useRef(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<MarketingInput>({ ...emptyContact });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MarketingContact | null>(null);
  const [collection, setCollection] = useState({ source: 'csv', city: '', category: '', csv: '', cuis: '' });
  const [preview, setPreview] = useState<{ contacts: MarketingInput[]; requested: number; excluded: number; notFound: number } | null>(null);

  const refresh = useCallback(async (params: string, signal?: AbortSignal) => {
    const sequence = ++loadSequence.current;
    try {
      const response = await fetch(`/api/admin/marketing/contacts?${params}`, { cache: 'no-store', signal });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? 'Lista nu a putut fi încărcată.');
      if (!signal?.aborted && sequence === loadSequence.current) setList(data);
    } catch (e) { if (!signal?.aborted && sequence === loadSequence.current) setError((e as Error).message); }
    finally { if (!signal?.aborted && sequence === loadSequence.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void refresh(query, controller.signal), 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, refresh]);

  async function run(operation: () => Promise<void>) {
    if (operationRunning.current) return;
    operationRunning.current = true; setBusy(true); setError(''); setMessage('');
    try { await operation(); } catch (e) { setError((e as Error).message); }
    finally { operationRunning.current = false; setBusy(false); }
  }
  async function saveContacts(contacts: MarketingInput[], collectionInfo?: object) {
    const result = await api('contacts', 'POST', { contacts, collection: collectionInfo });
    setRevision(value => value + 1);
    setMessage(`${result.created} contacte salvate. ${result.duplicates} duplicate omise; datele existente au fost păstrate.`);
    await refresh(query);
  }
  function setCollectionField(key: keyof typeof collection, value: string) {
    setCollection(old => ({ ...old, [key]: value })); setPreview(null); setMessage('');
  }
  const onCityProgress = useCallback(() => { setRevision(value => value + 1); void refresh(query); }, [query, refresh]);
  function changeQuery(params: string) { setSelected({}); setLoading(true); if (params === query) void refresh(params); else setQuery(params); }
  function applyFilters(event: FormEvent) { event.preventDefault(); setError(''); changeQuery(new URLSearchParams(filters).toString()); }
  const previewContactRows = preview?.contacts ?? [];

  return <main className="design-container max-w-6xl py-8 space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><Link href="/admin" className="underline text-sm">← ADMIN</Link><p className="v2-eyebrow mt-4">{testEnvironment ? 'NITIDO · MEDIU DE TEST' : 'NITIDO · ADMIN'}</p><h1 className="text-3xl font-bold">Marketing</h1></div>
      <p className="text-sm text-muted max-w-md">Contacte, colectare firme și campanii, într-un singur loc. Trimiterea reală este oprită; verificările și coada de test nu expediază emailuri.</p>
    </header>
    <div className="grid gap-3 sm:grid-cols-3">{Object.entries(MARKETING_CATEGORIES).map(([key, label]) => <Card key={key}><p className="text-muted">{label}</p><b className="text-3xl">{list?.counts[key as MarketingCategory] ?? '—'}</b></Card>)}</div>
    <nav aria-label="Secțiuni Marketing" className="flex flex-wrap gap-3">{([['counties','Județe'],['signups','Înscrieri'],['overview', 'Panou general'], ['contacts', 'Contacte'], ['collect', 'Colectare firme'], ['campaigns', 'Campanii'], ['results', 'Rezultate'], ['settings', 'Setări']] as const).map(([key, label]) => <button key={key} type="button" className={`v2-btn ${tab === key ? 'v2-btn-primary' : 'v2-btn-secondary'}`} aria-current={tab === key ? 'page' : undefined} style={tab === key ? { color: '#052e22' } : undefined} onClick={() => { setError(''); setMessage(''); setTab(key); }}>{label}</button>)}</nav>
    {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-green-300 bg-green-50 p-4 text-green-900">{message}</p>}
    {tab==='signups'&&<AdminMarketingSignups/>}
    {tab==='counties'&&<AdminMarketingCounties onContacts={code=>{const next={...filters,county:code,city:'',search:'',status:'',emailVerification:''};setFilters(next);changeQuery(new URLSearchParams(next).toString());setTab('contacts');}}/>}
    {['overview', 'campaigns', 'results', 'settings'].includes(tab) && <AdminMarketingWorkspace key={tab} section={tab as 'overview' | 'campaigns' | 'results' | 'settings'} revision={revision} onContacts={() => setTab('contacts')}/>}

    {tab === 'contacts' && <section className="space-y-5" aria-label="Contacte">
      <div className="flex flex-wrap justify-between items-center gap-3"><h2 className="text-2xl font-bold">Contacte</h2><div className="flex flex-wrap gap-3"><button className="v2-btn v2-btn-primary" type="button" onClick={() => { setShowForm(!showForm); setEditing(null); }}>Adaugă contact</button><a className="v2-btn v2-btn-secondary" href={`/api/admin/marketing/contacts?${query}&format=csv`}>Export CSV</a></div></div>
      {showForm && <Card><form className="grid gap-4 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); void run(async () => { await saveContacts([draft]); setDraft({ ...emptyContact }); setShowForm(false); }); }}>
        <h3 className="sm:col-span-2 text-xl font-bold">Contact nou</h3>
        <label>Nume / firmă<input className={inputClass} required maxLength={180} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/></label>
        <label>Categorie<select className={inputClass} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value as MarketingCategory, consent: 'not_recorded', consentEvidence: '', cui: '' })}><CategoryOptions/></select></label>
        <label>Email<input className={inputClass} type="email" maxLength={254} required={draft.category === 'individual'} value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })}/></label>
        <label>Telefon<input className={inputClass} maxLength={50} value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })}/></label>
        <label>Județ<select className={inputClass} value={draft.county??''} onChange={e => setDraft({ ...draft, county: e.target.value })}><option value="">Nespecificat</option>{MARKETING_REGIONS.map(r=><option key={r.code} value={r.name}>{r.name}</option>)}</select></label>
        <label>Localitate<input className={inputClass} required maxLength={100} value={draft.city} onChange={e => setDraft({ ...draft, city: e.target.value })}/></label>
        {draft.category !== 'individual' && <label>CUI<input className={inputClass} maxLength={20} value={draft.cui} onChange={e => setDraft({ ...draft, cui: e.target.value })}/></label>}
        <label>Website<input className={inputClass} type="url" maxLength={500} value={draft.website} onChange={e => setDraft({ ...draft, website: e.target.value })}/></label>
        <label>Sursa contactului<input className={inputClass} required maxLength={500} value={draft.source} onChange={e => setDraft({ ...draft, source: e.target.value })}/></label>
        <label>Acord pentru marketing<select className={inputClass} value={draft.consent} onChange={e => setDraft({ ...draft, consent: e.target.value as MarketingInput['consent'] })}>{Object.entries(MARKETING_CONSENTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Dovadă acord (sursă și dată)<input className={inputClass} maxLength={1000} required={draft.consent === 'granted' || draft.category === 'individual'} value={draft.consentEvidence} onChange={e => setDraft({ ...draft, consentEvidence: e.target.value })}/></label>
        <label className="sm:col-span-2">Observații<textarea className={inputClass} maxLength={2000} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })}/></label>
        <p className="sm:col-span-2 text-sm text-muted">Pentru firme este necesar un email, CUI sau website. Persoanele fizice se adaugă cu email și dovada acordului pentru marketing.</p>
        <div className="flex gap-3"><button disabled={busy} className="v2-btn v2-btn-primary">{busy ? 'Se salvează…' : 'Salvează contactul'}</button><button type="button" className="v2-btn v2-btn-secondary" onClick={() => setShowForm(false)}>Închide</button></div>
      </form></Card>}
      {editing && <Card><form className="grid gap-4 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); void run(async () => { await api('contacts', 'PATCH', editing); setEditing(null); setRevision(value => value + 1); setMessage('Contact actualizat.'); await refresh(query); }); }}>
        <h3 className="sm:col-span-2 text-xl font-bold">Actualizează: {editing.name}</h3>
        <label>Nume / firmă<input className={inputClass} required maxLength={180} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}/></label>
        <label>Categorie<select className={inputClass} value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value as MarketingCategory })}><CategoryOptions/></select></label>
        <label>Email<input className={inputClass} type="email" maxLength={254} required={editing.category === 'individual'} value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })}/></label>
        <label>Telefon<input className={inputClass} maxLength={50} value={editing.phone} onChange={e => setEditing({ ...editing, phone: e.target.value })}/></label>
        <label>Județ<select className={inputClass} value={editing.county??''} onChange={e => setEditing({ ...editing, county: e.target.value })}><option value="">Nespecificat</option>{MARKETING_REGIONS.map(r=><option key={r.code} value={r.name}>{r.name}</option>)}</select></label>
        <label>Localitate<input className={inputClass} required maxLength={100} value={editing.city} onChange={e => setEditing({ ...editing, city: e.target.value })}/></label>
        {editing.category !== 'individual' && <label>CUI<input className={inputClass} maxLength={20} value={editing.cui} onChange={e => setEditing({ ...editing, cui: e.target.value })}/></label>}
        <label>Website<input className={inputClass} type="url" maxLength={500} value={editing.website} onChange={e => setEditing({ ...editing, website: e.target.value })}/></label>
        <label>Sursa contactului<input className={inputClass} required maxLength={500} value={editing.source} onChange={e => setEditing({ ...editing, source: e.target.value })}/></label>
        <label>Stare<select className={inputClass} value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value as MarketingContact['status'] })}>{Object.entries(MARKETING_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Acord pentru marketing<select className={inputClass} value={editing.consent} onChange={e => setEditing({ ...editing, consent: e.target.value as MarketingInput['consent'] })}>{Object.entries(MARKETING_CONSENTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="sm:col-span-2">Dovadă acord (sursă și dată)<input className={inputClass} maxLength={1000} required={editing.consent === 'granted'} value={editing.consentEvidence} onChange={e => setEditing({ ...editing, consentEvidence: e.target.value })}/></label>
        <label className="sm:col-span-2">Observații<textarea className={inputClass} maxLength={2000} value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })}/></label>
        <p className="sm:col-span-2 text-sm">Retragerea acordului marchează automat contactul „Nu contacta”.</p>
        <div className="flex gap-3"><button disabled={busy} className="v2-btn v2-btn-primary">Salvează modificările</button><button className="v2-btn v2-btn-secondary" type="button" onClick={() => setEditing(null)}>Închide</button></div>
      </form>{editing.email && <AdminMarketingRegrant key={editing.id} contact={editing} onSaved={async()=>{setEditing(null);setRevision(value=>value+1);setMessage('Acord nou înregistrat.');await refresh(query);}}/>}</Card>}
      <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={applyFilters}>
        <label>Categorie<select className={inputClass} value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })}><CategoryOptions all/></select></label>
        <label>Județ<select className={inputClass} value={filters.county} onChange={e=>setFilters({...filters,county:e.target.value})}><option value="">Toate județele</option>{MARKETING_REGIONS.map(r=><option key={r.code} value={r.code}>{r.name}</option>)}</select></label>
        <label>Verificare email<select className={inputClass} value={filters.emailVerification} onChange={e=>setFilters({...filters,emailVerification:e.target.value})}><option value="">Toate</option>{Object.entries(MARKETING_EMAIL_VERIFICATIONS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label>Localitate<input className={inputClass} maxLength={100} value={filters.city} onChange={e => setFilters({ ...filters, city: e.target.value })}/></label>
        <label>Nume, email sau CUI<input className={inputClass} maxLength={180} value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })}/></label>
        <label>Stare<select className={inputClass} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option value="">Toate stările</option>{Object.entries(MARKETING_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button className="v2-btn v2-btn-secondary self-end" disabled={loading}>Aplică filtrele</button>
      </form>
      <p role="status">{loading ? 'Se încarcă…' : `${list?.total ?? 0} contacte în selecție`}</p>
      {!!list?.contacts.length && <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2"><input type="checkbox" checked={list.contacts.every(row => selected[row.id] !== undefined)} onChange={e => setSelected(e.target.checked ? Object.fromEntries(list.contacts.map(row => [row.id, row.version])) : {})}/>Selectează pagina</label><span>{Object.keys(selected).length} selectate</span>{(['reviewed', 'do_not_contact'] as const).map(status => <button key={status} type="button" className="v2-btn v2-btn-secondary" disabled={busy || !Object.keys(selected).length} onClick={() => void run(async () => { const result = await api('contacts', 'PATCH', { selection: Object.entries(selected).map(([id, version]) => ({ id, version })), status }); setSelected({}); setRevision(value => value + 1); setMessage(`${result.updated} contacte actualizate: ${MARKETING_STATUSES[status]}.`); await refresh(query); })}>{status === 'reviewed' ? 'Marchează selectatele Verificate' : 'Nu contacta selectatele'}</button>)}</div>}
      {!loading && list?.contacts.length === 0 && <Card>Nu există contacte pentru selecția curentă. Adaugă un contact sau deschide Colectare firme.</Card>}
      {!!list?.contacts.length && <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full text-sm bg-white"><caption className="sr-only">Contacte de marketing</caption><thead className="text-left bg-mist"><tr><th className="p-3"><span className="sr-only">Selectare</span></th>{['Contact', 'Categorie', 'Județ / localitate', 'Sursă', 'Stare / acord', 'Acțiuni'].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{list.contacts.map(contact => <tr key={contact.id} className="border-t border-line align-top"><td className="p-3"><input type="checkbox" aria-label={`Selectează ${contact.name}`} checked={selected[contact.id] !== undefined} onChange={e => setSelected(old => { const next = { ...old }; if (e.target.checked) next[contact.id] = contact.version; else delete next[contact.id]; return next; })}/></td><td className="p-3"><b>{contact.name}</b><p>{contact.email || 'Email neînregistrat'}</p>{contact.email&&<p className="text-xs text-muted">{MARKETING_EMAIL_VERIFICATIONS[contact.emailVerification??'pending']}</p>}<p>{contact.phone}</p>{contact.cui && <p>CUI: {contact.cui}</p>}{contact.website && <a className="underline" href={contact.website} target="_blank" rel="noreferrer">Website</a>}</td><td className="p-3">{MARKETING_CATEGORIES[contact.category]}</td><td className="p-3">{contact.regions?.length?contact.regions.filter(r=>!filters.county||MARKETING_REGIONS.find(c=>c.code===filters.county)?.name===r.county).map((r,i)=><p key={i}><b>{r.county}</b><br/>{r.city}</p>):<p><b>{contact.county||'Județ nespecificat'}</b><br/>{contact.city}</p>}</td><td className="p-3 max-w-56 break-words">{contact.source}</td><td className="p-3">{MARKETING_STATUSES[contact.status]}<p className="text-muted">{MARKETING_CONSENTS[contact.consent]}</p></td><td className="p-3"><button type="button" className="v2-btn v2-btn-secondary" disabled={busy} onClick={() => { setEditing({ ...contact }); setShowForm(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Actualizează</button></td></tr>)}</tbody></table></div>}
      {list && list.total > 25 && <div className="flex items-center gap-3"><button className="v2-btn v2-btn-secondary" disabled={loading || list.page <= 1} onClick={() => { const params = new URLSearchParams(query); params.set('page', String(list.page - 1)); changeQuery(params.toString()); }}>Înapoi</button><span>Pagina {list.page} / {Math.ceil(list.total / 25)}</span><button className="v2-btn v2-btn-secondary" disabled={loading || list.page * 25 >= list.total} onClick={() => { const params = new URLSearchParams(query); params.set('page', String(list.page + 1)); changeQuery(params.toString()); }}>Înainte</button></div>}
    </section>}

    {tab === 'collect' && <section className="space-y-5" aria-label="Colectare firme">
      <h2 className="text-2xl font-bold">Colectare firme</h2>
      <AdminMarketingCsvImport onSaved={onCityProgress}/>
      <details><summary className="cursor-pointer underline">Colectare pe municipiu (istoric separat de județ)</summary><AdminMarketingCityCollection onProgress={onCityProgress}/></details>
      <AdminMarketingPublicCollection onSave={saveContacts}/>
      <Card><form onSubmit={event => { event.preventDefault(); void run(async () => { setPreview(null); const result = await api('collect', 'POST', collection); setPreview(result); }); }}><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <label>Sursă<select className={inputClass} value={collection.source} onChange={e => { setCollectionField('source', e.target.value); if (e.target.value === 'anaf') setCollection(old => ({ ...old, category: 'business' })); }}><option value="csv">Import CSV</option><option value="anaf">ANAF · listă de CUI-uri</option></select></label>
        <label>Categorie<select className={inputClass} value={collection.category} onChange={e => setCollectionField('category', e.target.value)}>{collection.source === 'csv' && <option value="">Toate categoriile din fișier</option>}{Object.entries(MARKETING_CATEGORIES).filter(([key]) => collection.source === 'csv' || key !== 'individual').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Localitate{collection.source === 'csv' && ' (opțional)'}<input className={inputClass} required={collection.source === 'anaf'} maxLength={100} value={collection.city} onChange={e => setCollectionField('city', e.target.value)}/></label>
        {collection.source === 'csv' ? <>
          <label>CSV pentru un lot (maximum 250 KB)<input type="file" accept=".csv,text/csv" className={inputClass} disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (!file) return; setPreview(null); if (file.size > 250000) { setError('Fișierul depășește 250 KB.'); setCollectionField('csv', ''); return; } void run(async () => { setCollectionField('csv', await file.text()); }); }}/></label>
          <label className="sm:col-span-2">Conținut CSV<textarea className={`${inputClass} font-mono text-xs`} rows={7} required maxLength={250000} value={collection.csv} onChange={e => setCollectionField('csv', e.target.value)}/></label>
          <div className="sm:col-span-2 text-sm space-y-2"><button className="underline" type="button" onClick={downloadTemplate}>Descarcă modelul CSV</button><p>Acest formular procesează un singur lot de maximum 200 de contacte. Pentru fișiere mari folosește „Import CSV de volum mare” de mai sus; totalul pe județ nu este plafonat. Coduri categorie: business, cleaning, individual. Coloane obligatorii: name, category, city, source; identificare prin email sau cui. Acord: not_recorded, granted sau withdrawn. Persoanele fizice necesită granted și consentEvidence.</p><p>Filtrele selectează rândurile din fișier; categoriile existente sunt păstrate.</p></div>
        </> : <>
          <label className="sm:col-span-2">CUI-uri (maximum 20)<textarea className={inputClass} rows={3} required maxLength={500} value={collection.cuis} onChange={e => setCollectionField('cuis', e.target.value)}/></label>
          <p className="sm:col-span-2 text-sm text-muted">Introdu CUI-uri cunoscute, separate prin spațiu sau virgulă. ANAF verifică identitatea și localitatea firmelor; nu caută toate firmele dintr-un oraș și nu furnizează emailuri sau acord de marketing. Categoria este alegerea ta și trebuie verificată. Firmele radiate și cele din alte localități sunt excluse.</p>
        </>}
        <button className="v2-btn v2-btn-primary justify-self-start" disabled={busy}>{busy ? 'Se verifică…' : 'Previzualizează colectarea'}</button>
      </fieldset></form></Card>
      {preview && <Card><h3 className="text-xl font-bold">Previzualizare</h3><p className="my-3">{preview.requested} intrări verificate · {preview.contacts.length} în selecție · {preview.excluded} excluse · {preview.notFound} negăsite.</p><p className="text-sm text-muted mb-4">Datele se salvează când apeși butonul de mai jos. Duplicatele sunt omise; stările „Nu contacta” și acordurile existente sunt păstrate.</p>
        <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Contacte propuse pentru salvare</caption><thead className="text-left"><tr><th className="p-2">Nume</th><th className="p-2">Categorie</th><th className="p-2">Localitate</th><th className="p-2">Email / CUI</th></tr></thead><tbody>{previewContactRows.map((row, i) => <tr className="border-t border-line" key={i}><td className="p-2">{row.name}</td><td className="p-2">{MARKETING_CATEGORIES[row.category]}</td><td className="p-2">{row.city}</td><td className="p-2">{row.email || `CUI ${row.cui}`}</td></tr>)}</tbody></table></div>
        <button type="button" className="v2-btn v2-btn-primary mt-4" disabled={busy || !preview.contacts.length} onClick={() => void run(async () => { await saveContacts(preview.contacts, { source: collection.source, city: collection.city, category: collection.category, requested: preview.requested, excluded: preview.requested - preview.contacts.length }); setPreview(null); })}>Salvează {preview.contacts.length} contacte</button>
      </Card>}
      <AdminMarketingWorkspace section="collections" revision={revision}/>
    </section>}
  </main>;
}
