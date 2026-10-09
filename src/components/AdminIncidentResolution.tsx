'use client';
import { useEffect, useState } from 'react';
import { RESOLUTION_KINDS, type ResolutionKind, type IncidentResolution } from '@/lib/incidentResolutionShared';
import { inputClass } from './ui';
export function AdminIncidentResolution({ caseId, jobId, revision, canManage, canFinance, canOperate = true, onSaved }: {
    caseId: string;
    jobId: string;
    revision: string;
    canManage: boolean;
    canFinance: boolean;
    canOperate?: boolean;
    onSaved: () => Promise<void>;
}) {
    const [kind, setKind] = useState<ResolutionKind>(canOperate ? 'remediation' : 'refund'), [note, setNote] = useState(''), [reference, setReference] = useState(''), [history, setHistory] = useState<IncidentResolution[]>([]), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [confirmRefund, setConfirmRefund] = useState(false);
    useEffect(() => { const c = new AbortController(); fetch('/api/admin/incident-resolutions?caseId=' + encodeURIComponent(caseId), { signal: c.signal, cache: 'no-store' }).then(async (r) => { const d = await r.json(); if (!r.ok)
        throw Error(d.error); setHistory(d.history); }).catch(e => { if (!c.signal.aborted)
        setMessage(e.message); }); return () => c.abort(); }, [caseId, revision]);
    async function save(action: 'propose' | 'complete') { if (busy)
        return; setBusy(true); setMessage(''); try {
        const r = await fetch('/api/admin/incident-resolutions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId, revision, kind, note, reference, action }) }), d = await r.json();
        if (!r.ok)
            throw Error(d.error);
        await onSaved();
    }
    catch (e) {
        setMessage(e instanceof Error ? e.message : 'Rezoluție neconfirmată.');
    }
    finally {
        setBusy(false);
    } }
    async function refund() { if (busy || !confirmRefund)
        return; setBusy(true); setMessage(''); try {
        const r = await fetch(`/api/admin/payments/${encodeURIComponent(jobId)}/refund`, { method: 'POST' }), d = await r.json();
        if (!r.ok)
            throw Error(d.error);
        setMessage(d.status === 'succeeded' ? 'Rambursare confirmată. Poți înregistra acum rezoluția finală.' : 'Rambursare în curs. Verifică din nou înainte de închiderea dosarului.');
    }
    catch (e) {
        setMessage(e instanceof Error ? e.message : 'Rambursare neconfirmată.');
    }
    finally {
        setBusy(false);
        setConfirmRefund(false);
    } }
    const financial = kind === 'refund' || kind === 'credit';
    const canComplete = financial ? canFinance : canManage;
    return <section className="rounded-xl border p-4 space-y-3" style={{ background: '#fbf7ef', borderColor: '#ddd4c5' }}><h3 className="font-bold">Rezoluția dosarului</h3><p className="text-sm">Propunerea păstrează dosarul deschis. Finalizarea verifică drepturile rolului și dovada rezultatului: revenire executată, rambursare confirmată sau decizie motivată. Creditul și penalizarea rămân propuneri până la aprobarea politicii comerciale.</p>
 <details><summary>Istoricul rezoluțiilor ({history.length})</summary>{history.map(r => <p className="my-2 whitespace-pre-wrap break-words" key={r.id}>{RESOLUTION_KINDS[r.kind]} · {r.state === 'completed' ? 'Finalizată' : 'Propusă'} · {new Date(r.created_at).toLocaleString('ro-RO')} · {r.note}{r.reference && ` · Referință: ${r.reference}`}</p>)}</details>
 <label className="block">Tip rezoluție<select className={inputClass} disabled={busy} value={kind} onChange={e => { setKind(e.target.value as ResolutionKind); setConfirmRefund(false); }}>{Object.entries(RESOLUTION_KINDS).filter(([k]) => canOperate || k === 'refund' || k === 'credit').map(([k, label]) => <option key={k} value={k}>{label}</option>)}</select></label><label className="block">Motiv și dovezi · notă internă<textarea className={inputClass} maxLength={2000} value={note} disabled={busy} onChange={e => setNote(e.target.value)}/></label>
 {['provider_review', 'provider_suspension'].includes(kind) && <label className="block">{kind === 'provider_suspension' ? 'Suspendare până la · dată ISO cu fus orar, conform aprobării' : 'Referința verificării prestatorului'}<input className={inputClass} maxLength={300} value={reference} onChange={e => setReference(e.target.value)} disabled={busy}/></label>}
 <div className="flex flex-wrap gap-3"><button className="v2-btn v2-btn-secondary" disabled={busy || !note.trim()} onClick={() => void save('propose')}>Înregistrează propunerea</button>{canComplete && <button className="v2-btn v2-btn-primary" disabled={busy || !note.trim() || kind === 'credit' || kind === 'provider_penalty'} onClick={() => void save('complete')}>Verifică rezultatul și închide dosarul</button>}</div>
 {kind === 'refund' && canFinance && <fieldset className="space-y-3 border-t pt-3"><legend className="font-bold">Operațiune financiară efectivă</legend><p>Rambursare integrală prin fluxul existent, pentru lucrarea {jobId}. Nu se execută prin simpla salvare a unei propuneri.</p><label className="block"><input type="checkbox" checked={confirmRefund} disabled={busy} onChange={e => setConfirmRefund(e.target.checked)}/> Confirm executarea rambursării integrale pentru această lucrare.</label><button className="v2-btn v2-btn-secondary" disabled={busy || !confirmRefund} onClick={() => void refund()}>Execută / verifică rambursarea</button></fieldset>}
 {message && <p role="status">{message}</p>}</section>;
}
