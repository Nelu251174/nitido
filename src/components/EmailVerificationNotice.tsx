'use client';
import {UiText} from '@/components/UiText';
import {useState,useEffect,useRef} from 'react';
export function EmailVerificationNotice(){
 const [state,setState]=useState<{verified:boolean;configured:boolean}|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const sending=useRef(false);
 useEffect(()=>{const c=new AbortController();fetch('/api/auth/verify-email',{signal:c.signal}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(setState).catch(()=>{if(!c.signal.aborted)setMessage('Starea confirmării emailului nu a putut fi verificată.')});return()=>c.abort()},[]);
 async function resend(){if(sending.current)return;sending.current=true;setBusy(true);setMessage('');try{const r=await fetch('/api/auth/verify-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'resend'})});const d=await r.json().catch(()=>null);if(!r.ok)throw Error(typeof d?.error==='string'?d.error:'Trimitere indisponibilă.');if(d?.verified===true)setState({verified:true,configured:true});else if(d?.accepted===true)setMessage('Furnizorul a acceptat mesajul. Verifică Inbox și Spam; livrarea nu este încă confirmată.');else throw Error('Trimiterea emailului nu a putut fi confirmată.')}catch(e){setMessage(e instanceof Error?e.message:'Trimitere indisponibilă.')}finally{sending.current=false;setBusy(false)}}
 if(state?.verified)return null;
 return <section className="v2-card p-4 mb-5"><h2 className="font-bold"><UiText text={"Confirmarea adresei de email"}/></h2><p className="text-sm mt-2">{state?(state.configured?<UiText text={'Adresa ta nu este încă confirmată. Dacă ai primit emailul, linkul de confirmare este valabil 24 de ore.'}/>:<UiText text={'Trimiterea emailurilor nu este activată momentan. Adresa ta rămâne neconfirmată.'}/>):<UiText text={'Se verifică starea emailului…'}/>}</p>{state?.configured&&<button className="v2-btn v2-btn-secondary mt-3" disabled={busy} onClick={()=>void resend()}>{busy?<UiText text={'Se trimite…'}/>:<UiText text={'Retrimite emailul de confirmare'}/>}</button>}{message&&<p role="status" className="text-sm mt-3">{message}</p>}</section>
}
