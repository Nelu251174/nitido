"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Logo,Card,Button,inputClass} from './ui';

export function AdminPasswordReset(){
 const [ready,setReady]=useState(false),[token,setToken]=useState(''),[email,setEmail]=useState('');
 const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[code,setCode]=useState('');
 const [method,setMethod]=useState<'totp'|'recovery'>('totp');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[complete,setComplete]=useState(false);
 const running=useRef(false);
 useEffect(()=>{
  let frame=0;
  function load(){
   const raw=window.location.hash.slice(1);
   if(raw){
    window.history.replaceState(window.history.state,'',window.location.pathname);
    window.cancelAnimationFrame(frame);
    frame=window.requestAnimationFrame(()=>{if(/^[a-f0-9]{64}$/.test(raw)){setToken(raw);setComplete(false);setMessage('');setError('');}else setError('Linkul de resetare este invalid. Solicită un link nou.');setReady(true);});
   }else frame=window.requestAnimationFrame(()=>setReady(true));
  }
  load();window.addEventListener('hashchange',load);
  return ()=>{window.cancelAnimationFrame(frame);window.removeEventListener('hashchange',load);};
 },[]);
 async function submit(event:React.FormEvent){
  event.preventDefault();if(running.current)return;
  setError('');setMessage('');
  if(token&&password!==confirmation){setError('Parolele nu coincid.');return;}
  running.current=true;setBusy(true);
  try{
   const response=await fetch('/api/admin/auth/'+(token?'reset-password':'forgot-password'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(token?{token,password,code:code.trim(),method}:{email})});
   const data=await response.json();
   if(!response.ok){setError(data.error??'Cererea nu a putut fi confirmată.');return;}
   setMessage(data.message??(token?'Parola ADMIN a fost actualizată. Autentifică-te cu parola nouă și un cod 2FA nou.':'Cererea a fost procesată.'));
   if(token){setComplete(true);setToken('');setPassword('');setConfirmation('');}
  }catch{setError('Răspuns neconfirmat. Verifică conexiunea și reîncearcă.');}
  finally{setCode('');running.current=false;setBusy(false);}
 }
 return <main className="min-h-screen mesh-light flex items-center justify-center px-4 py-8">
  <Card className="w-full max-w-md min-w-0 p-6 sm:p-8">
   <Logo href="/admin"/>
   <h1 className="font-display text-2xl font-bold mt-6">Resetare parolă ADMIN</h1>
   {!ready?<p className="mt-4 text-sm text-muted">Se încarcă…</p>:complete?<div className="mt-5 space-y-4"><p role="status" className="text-sm text-aqua-deep">{message}</p><Link className="block font-semibold underline" href="/admin">Autentificare ADMIN</Link></div>:<>
    <p className="mt-3 text-sm text-muted">{token?'Alege parola nouă și confirmă identitatea folosind codul 2FA sau un cod de recuperare.':'Introdu adresa contului ADMIN. Vei primi un link valabil 15 minute. Pentru setarea parolei este necesar și codul 2FA sau un cod de recuperare.'}</p>
    <form onSubmit={submit} className="mt-6 space-y-4">
     {!token?<div><label htmlFor="admin-reset-email" className="block text-sm font-medium mb-1">Email ADMIN</label><input id="admin-reset-email" className={inputClass+' w-full'} type="email" autoComplete="username" maxLength={254} required value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></div>:<>
      <div><label htmlFor="admin-new-password" className="block text-sm font-medium mb-1">Parola nouă</label><input id="admin-new-password" className={inputClass+' w-full'} type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/><p className="mt-1 text-xs text-muted">Cel puțin 12 caractere, cu litere și cifre.</p></div>
      <div><label htmlFor="admin-password-confirmation" className="block text-sm font-medium mb-1">Repetă parola nouă</label><input id="admin-password-confirmation" className={inputClass+' w-full'} type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy}/></div>
      <div><label htmlFor="admin-reset-factor" className="block text-sm font-medium mb-1">{method==='totp'?'Cod din aplicația de autentificare':'Cod de recuperare'}</label><input id="admin-reset-factor" className={inputClass+' w-full'} type={method==='totp'?'text':'password'} inputMode={method==='totp'?'numeric':'text'} autoComplete={method==='totp'?'one-time-code':'off'} maxLength={method==='totp'?6:32} pattern={method==='totp'?'[0-9]{6}':'[a-fA-F0-9]{32}'} required value={code} onChange={e=>setCode(e.target.value)} disabled={busy}/></div>
      <button type="button" className="text-sm underline" disabled={busy} onClick={()=>{setMethod(method==='totp'?'recovery':'totp');setCode('');setError('');}}>{method==='totp'?'Folosesc un cod de recuperare':'Revin la aplicația de autentificare'}</button>
     </>}
     {error&&<p role="alert" className="text-sm text-coral break-words">{error}</p>}
     {message&&<p role="status" className="text-sm text-aqua-deep break-words">{message}</p>}
     <Button type="submit" className="w-full" disabled={busy}>{busy?'Se verifică…':token?'Salvează parola nouă':'Trimite linkul de resetare'}</Button>
    </form>
    <Link href="/admin" className="inline-block mt-5 text-sm underline">Înapoi la ADMIN</Link>
   </>}
  </Card>
 </main>;
}
