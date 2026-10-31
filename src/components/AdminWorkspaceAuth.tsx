'use client';
import {useRef,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {Logo,Card,Button} from './ui';
import {UiElement,UiText} from './UiText';

export function AdminWorkspaceAuth(){
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[code,setCode]=useState(''),[factor,setFactor]=useState<'totp'|'recovery'>('totp'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const running=useRef(false);
  async function login(event:FormEvent){event.preventDefault();if(running.current)return;running.current=true;setBusy(true);setError('');
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Reload server-authenticated content after the HttpOnly session cookie changes.
    try{const response=await fetch('/api/admin/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,code:code.trim(),method:factor})});const data=await response.json();if(!response.ok)throw Error(data.error??'Autentificare eșuată');setPassword('');window.location.assign('/admin');}
    catch(e){setError(e instanceof Error?e.message:'Răspuns neconfirmat. Reîncarcă pagina și folosește un cod nou.');}
    finally{setCode('');running.current=false;setBusy(false);}
  }
  return <div className="workspace-redesign workspace-redesign-admin workspace-redesign-login"><Card className="w-full max-w-md p-8"><Logo href="/admin"/><p className="workspace-redesign-eyebrow"><UiText text="Acces echipă NÍTIDO"/></p><h1 className="text-2xl font-bold"><UiText text="Administrare"/></h1><p className="text-sm text-muted my-3"><UiText text="Folosește contul ADMIN și codul tău de autentificare."/></p>
    <form onSubmit={login} className="space-y-4"><label className="block"><UiText text="Email admin"/><UiElement as="input" className="w-full rounded-xl border p-3" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="block"><UiText text="Parolă admin"/><input className="w-full rounded-xl border p-3" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><label className="block" htmlFor="admin-mfa-code"><UiText text={factor==='totp'?'Cod din aplicația de autentificare':'Cod de recuperare'}/></label><input id="admin-mfa-code" className="w-full rounded-xl border p-3" type={factor==='recovery'?'password':'text'} inputMode={factor==='totp'?'numeric':'text'} autoComplete={factor==='totp'?'one-time-code':'off'} required maxLength={factor==='totp'?6:32} pattern={factor==='totp'?'[0-9]{6}':'[a-fA-F0-9]{32}'} value={code} onChange={e=>setCode(e.target.value)}/><button type="button" className="text-sm underline" disabled={busy} onClick={()=>{setFactor(factor==='totp'?'recovery':'totp');setCode('');setError('');}}><UiText text={factor==='totp'?'Folosesc un cod de recuperare':'Revin la aplicația de autentificare'}/></button><p className="text-xs text-muted"><UiText text="Fiecare cod poate fi folosit o singură dată. Codurile de recuperare se păstrează separat de parolă."/></p>{error&&<p role="alert"><UiText text={error}/></p>}<Button type="submit" disabled={busy} className="w-full"><UiText text={busy?'Se verifică…':'Autentificare'}/></Button><Link href="/admin/reset-parola" className="block text-center text-sm underline"><UiText text="Am uitat parola ADMIN"/></Link></form>
  </Card></div>;
}
