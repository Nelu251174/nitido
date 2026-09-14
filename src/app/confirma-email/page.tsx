'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
export default function ConfirmEmail(){
 const [token,setToken]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false);
 useEffect(()=>{const value=window.location.hash.slice(1);window.history.replaceState({},'',window.location.pathname);queueMicrotask(()=>setToken(value))},[]);
 async function confirm(){setBusy(true);setMessage('');try{const r=await fetch('/api/auth/verify-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'confirm',token})});const d=await r.json();if(!r.ok)throw Error(d.error);setDone(true);setToken('');setMessage('Adresa de email a fost confirmată.')}catch(e){setMessage(e instanceof Error?e.message:'Confirmarea nu a reușit.')}finally{setBusy(false)}}
 return <main className="container max-w-xl py-16"><h1 className="text-3xl font-bold">Confirmă adresa de email</h1><p className="mt-4">Apasă butonul pentru a confirma adresa asociată linkului. Această operație nu te autentifică și nu modifică parola.</p>{!done&&token&&<button className="v2-btn v2-btn-primary mt-6" disabled={busy} onClick={()=>void confirm()}>{busy?'Se confirmă…':'Confirmă emailul'}</button>}{!token&&!done&&<p className="mt-4">Deschide linkul complet din email sau solicită altul din cont.</p>}{message&&<p role="status" className="mt-4">{message}</p>}<Link className="v2-btn v2-btn-secondary mt-6" href="/login">Intră în cont</Link></main>
}
