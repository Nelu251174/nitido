'use client';
import { useState } from 'react';
import { ADMIN_ROLES, type AdminRole } from '@/lib/adminRolesShared';
import { inputClass } from './ui';
type Account = {
    email: string;
    role: AdminRole;
    active: boolean;
    revision: number;
    credentialsConfigured: boolean;
};
export function AdminStaff() {
    const [accounts, setAccounts] = useState<Account[]>([]), [email, setEmail] = useState(''), [role, setRole] = useState<AdminRole>('operator'), [active, setActive] = useState(true), [reason, setReason] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
    async function load() { const r = await fetch('/api/admin/staff', { cache: 'no-store' }), d = await r.json(); if (!r.ok)
        throw Error(d.error); setAccounts(d.accounts); }
    async function run(save = false) { setBusy(true); setMessage(''); try {
        if (save) {
            const current = accounts.find(a => a.email === email.trim().toLowerCase());
            const r = await fetch('/api/admin/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role, active, revision: current?.revision ?? 0, reason }) }), d = await r.json();
            if (!r.ok)
                throw Error(d.error);
            setReason('');
            setMessage('Permisiunile au fost salvate. Sesiunile anterioare ale contului au fost revocate.');
        }
        await load();
    }
    catch (e) {
        setMessage(e instanceof Error ? e.message : 'Operațiune neconfirmată.');
    }
    finally {
        setBusy(false);
    } }
    return <section className="design-panel space-y-4" style={{ background: '#f7f3ec' }}><h2 className="text-xl font-bold">Echipa internă NITIDO</h2><p>Fiecare coleg folosește un cont nominal și propriul cod de autentificare. Operatorul gestionează cereri și incidente. Managerul configurează serviciile și vede rapoartele. Financiarul verifică sumele și rambursările. Super Admin gestionează toate permisiunile.</p><button className="v2-btn v2-btn-secondary" disabled={busy} onClick={() => void run()}>Încarcă echipa</button>
 <div className="space-y-2">{accounts.map(a => <button key={a.email} className="block text-left underline" disabled={busy} onClick={() => { setEmail(a.email); setRole(a.role); setActive(!!a.active); setReason(''); }}>{a.email} · {ADMIN_ROLES[a.role]} · {a.active ? 'Activ' : 'Dezactivat'} · {a.credentialsConfigured ? 'Autentificare configurată' : 'Așteaptă configurarea autentificării'}</button>)}</div>
 <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void run(true); }}><label>Email nominal<input className={inputClass} required type="email" maxLength={254} value={email} disabled={busy} onChange={e => setEmail(e.target.value)}/></label><label>Rol<select className={inputClass} value={role} disabled={busy} onChange={e => setRole(e.target.value as AdminRole)}>{Object.entries(ADMIN_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label><label><input type="checkbox" checked={active} disabled={busy} onChange={e => setActive(e.target.checked)}/> Cont activ</label><label>Motivul schimbării<textarea className={inputClass} required maxLength={2000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)}/></label><button className="v2-btn v2-btn-primary" disabled={busy}>Salvează accesul</button></form><p className="text-sm">Parola și al doilea factor se configurează separat, prin administrarea securizată a aplicației. Activarea unui rol singură nu permite autentificarea.</p>{message && <p role="status">{message}</p>}</section>;
}
