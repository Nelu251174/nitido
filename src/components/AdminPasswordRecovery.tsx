'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button, Card, Logo, inputClass } from './ui';

export function AdminPasswordRecovery() {
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const read = useRef(false);
  useEffect(() => {
    const load = () => {
      const url = new URL(window.location.href), value = url.hash.slice(1);
      if (read.current && !value) return;
      read.current = true;
      url.hash = ''; window.history.replaceState(window.history.state, '', url.pathname + url.search);
      queueMicrotask(() => { setToken(value); setReady(true); });
    };
    load(); window.addEventListener('hashchange', load); return () => window.removeEventListener('hashchange', load);
  }, []);
  return <div className="min-h-screen mesh-light flex items-center justify-center p-6"><Card className="w-full max-w-md p-8"><Logo href="/admin"/>
    {!ready ? <p className="mt-6">Se încarcă…</p> : <RecoveryForm key={token} token={token}/>}
  </Card></div>;
}
function RecoveryForm({ token }: { token: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [method, setMethod] = useState<'totp' | 'recovery'>('totp');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (running.current) return;
    setError('');
    if (token && password !== confirm) { setError('Parolele nu coincid.'); return; }
    running.current = true; setBusy(true);
    try {
      const response = await fetch(`/api/admin/auth/${token ? 'reset-password' : 'forgot-password'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(token ? { token, password, code, method } : { email }) });
      const data = await response.json(); if (!response.ok) throw Error(data.error ?? 'Operațiunea nu a reușit.');
      setPassword(''); setConfirm(''); setDone(true);
    } catch (e) { setError((e as Error).message); }
    finally { setCode(''); running.current = false; setBusy(false); }
  }
  return <>
    <p className="v2-eyebrow mt-6">ADMIN · MEDIU DE TEST</p>
    <h1 className="font-display text-2xl font-bold mb-3">{token ? 'Setează parola nouă' : 'Recuperare parolă ADMIN'}</h1>
    {done ? <div role="status" className="rounded-xl border border-line bg-mist p-4 text-sm">{token ? 'Parola a fost schimbată. Sesiunile anterioare au fost închise. Autentifică-te cu parola nouă și următorul cod 2FA afișat de aplicația ta.' : 'Cererea a fost procesată. Dacă adresa corespunde unui administrator activ și mesajul poate fi trimis, vei primi linkul de recuperare. Verifică Inbox și Spam.'}</div> : <form className="space-y-4" onSubmit={submit}>
      <p className="text-sm text-muted">{token ? 'Alege o parolă de minimum 12 caractere, cu litere și cifre. Confirmă schimbarea cu un cod 2FA.' : 'Introdu adresa contului de administrator. Vei primi un link valabil 15 minute. Schimbarea parolei necesită și codul 2FA.'}</p>
      <fieldset disabled={busy} className="space-y-4">
        {token ? <>
          <label className="block">Parolă nouă<input className={inputClass} type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={password} onChange={e => setPassword(e.target.value)}/></label>
          <label className="block">Confirmă parola<input className={inputClass} type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={confirm} onChange={e => setConfirm(e.target.value)}/></label>
          <label className="block">{method === 'totp' ? 'Cod din aplicația de autentificare' : 'Cod de recuperare 2FA'}<input className={inputClass} type={method === 'totp' ? 'text' : 'password'} inputMode={method === 'totp' ? 'numeric' : 'text'} autoComplete={method === 'totp' ? 'one-time-code' : 'off'} required maxLength={method === 'totp' ? 6 : 32} pattern={method === 'totp' ? '[0-9]{6}' : '[a-fA-F0-9]{32}'} value={code} onChange={e => setCode(e.target.value)}/></label>
          <button type="button" className="underline text-sm" onClick={() => { setMethod(method === 'totp' ? 'recovery' : 'totp'); setCode(''); }}>{method === 'totp' ? 'Folosesc un cod de recuperare 2FA' : 'Folosesc aplicația de autentificare'}</button>
        </> : <label className="block">Email administrator<input className={inputClass} type="email" autoComplete="username" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)}/></label>}
        {error && <p role="alert" className="text-coral text-sm">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">{busy ? 'Se procesează…' : token ? 'Schimbă parola ADMIN' : 'Trimite linkul de recuperare'}</Button>
      </fieldset>
    </form>}
    <p className="text-sm mt-5"><Link href="/admin" className="underline">Înapoi la autentificarea ADMIN</Link></p>
    <p className="text-xs text-muted mt-4">Dacă nu mai ai acces la adresa de email sau la codurile 2FA, recuperarea necesită intervenție în infrastructură.</p>
  </>;
}
