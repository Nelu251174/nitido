'use client';
import { useEffect, useState } from 'react';
type Job = {
    id: string;
    city: string;
    status: string;
    scheduled_at: string | null;
    accepted_firm_id: string | null;
    payments?: {
        id: string;
        status: string;
        amount_gross: number;
        refund_status: string;
        stripe_payment_intent_id: string | null;
        stripe_refund_id: string | null;
    }[];
};
export function AdminInternalJobs() { const [jobs, setJobs] = useState<Job[]>([]), [offset, setOffset] = useState(0), [more, setMore] = useState(false), [message, setMessage] = useState(''); useEffect(() => { const c = new AbortController(); setJobs([]); fetch('/api/admin/workbench?offset=' + offset, { cache: 'no-store', signal: c.signal }).then(async (r) => { const d = await r.json(); if (!r.ok)
    throw Error(d.error); setJobs(d.jobs); setMore(d.hasMore); }).catch(e => { if (!c.signal.aborted)
    setMessage(e.message); }); return () => c.abort(); }, [offset]); return <section className="design-panel space-y-3"><h2 className="text-xl font-bold">Lucrări și verificări disponibile rolului tău</h2><p>Lista afișează cel mult 50 de lucrări pe pagină. Sumele și referințele plăților sunt disponibile numai rolului Financiar și Super Admin.</p>{message && <p role="status">{message}</p>}<div className="grid gap-3 md:grid-cols-2">{jobs.map(j => <article className="border rounded-xl p-3 break-words" key={j.id}><h3 className="font-bold">{j.city} · {j.status}</h3><p>{j.id}</p><p>Prestator: {j.accepted_firm_id ?? 'Nealocat'}</p><p>{j.scheduled_at ? new Date(j.scheduled_at).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' }) : 'Fără oră programată'}</p>{j.payments?.map(p => <p key={p.id}>{p.amount_gross} lei · {p.status} · rambursare: {p.refund_status}<br />{p.stripe_payment_intent_id ?? 'Referință Stripe neconfirmată'}<br />{p.stripe_refund_id}</p>)}</article>)}</div><div className="flex gap-3"><button className="v2-btn v2-btn-secondary" disabled={offset === 0} onClick={() => setOffset(offset - 50)}>Pagina anterioară</button><button className="v2-btn v2-btn-secondary" disabled={!more} onClick={() => setOffset(offset + 50)}>Pagina următoare</button></div></section>; }
