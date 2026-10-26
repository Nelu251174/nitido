'use client';
import Link from 'next/link';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {UiText} from '@/components/UiText';
import {inputClass} from './ui';
import {MARKETING_REGIONS,marketingRegion} from '@/lib/adminMarketingRegions';
import {MARKETING_CATEGORIES,type MarketingCategory} from '@/lib/adminMarketingShared';
import {MARKETING_SIGNUP_CONSENT,MARKETING_SIGNUP_CONSENT_VERSION} from '@/lib/adminMarketingSignupShared';
import {readMarketingResponse} from '@/lib/adminMarketingResponse';
export function MarketingSignup(){
 const [form,setForm]=useState({name:'',email:'',category:'individual' as MarketingCategory,county:'',city:'',consent:false,website:''}),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');const campaign=useRef('');
 useEffect(()=>{const timer=setTimeout(()=>{const q=new URLSearchParams(window.location.search),r=marketingRegion(q.get('county')),c=q.get('category');campaign.current=q.get('utm_campaign')??'';if(r||c&&Object.hasOwn(MARKETING_CATEGORIES,c))setForm(f=>({...f,county:r?.code??'',city:r?.code==='B'?'București':'',category:c&&Object.hasOwn(MARKETING_CATEGORIES,c)?c as MarketingCategory:f.category}));},0);return()=>clearTimeout(timer);},[]);
 async function submit(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{await readMarketingResponse(await fetch('/api/marketing/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,campaign:campaign.current,consentVersion:MARKETING_SIGNUP_CONSENT_VERSION})}));setDone(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <main className="max-w-2xl mx-auto px-5 py-10 space-y-6"><Link href="/" className="font-bold text-2xl"><UiText text={"NITIDO"}/></Link><h1 className="text-3xl font-bold"><UiText text="Noutăți NITIDO pentru zona ta"/></h1><p><UiText text="Alege ce te interesează: curățenie pentru locuință, servicii pentru firmă sau oportunități pentru firma ta de curățenie. Disponibilitatea se confirmă pentru fiecare cerere."/></p>
 {done?<div role="status" className="rounded-xl bg-green-50 border p-5"><p><UiText text="Solicitarea a fost înregistrată. Înscrierea nu este încă activă. Nu este necesar să completezi din nou formularul."/></p></div>:<form onSubmit={submit} className="space-y-5"><fieldset disabled={busy} className="grid sm:grid-cols-2 gap-4">
 <label><UiText text="Prenume sau numele firmei"/><input className={inputClass} required autoComplete="given-name" maxLength={100} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
 <label><UiText text="Email"/><input className={inputClass} required type="email" autoComplete="email" maxLength={254} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
 <label className="sm:col-span-2"><UiText text="Ce te interesează?"/><select className={inputClass} value={form.category} onChange={e=>setForm({...form,category:e.target.value as MarketingCategory})}><option value="individual"><UiText text="Curățenie pentru locuință"/></option><option value="business"><UiText text="Curățenie pentru spațiul firmei"/></option><option value="cleaning"><UiText text="Înscrierea firmei de curățenie"/></option></select></label>
 <label><UiText text="Județ"/><select className={inputClass} required value={form.county} onChange={e=>setForm({...form,county:e.target.value,city:e.target.value==='B'?'București':''})}><option value=""><UiText text="Alege județul"/></option>{MARKETING_REGIONS.map(r=><option key={r.code} value={r.code}>{r.name}</option>)}</select></label>
 <label><UiText text="Localitate"/><input className={inputClass} required maxLength={100} readOnly={form.county==='B'} value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></label>
 <label aria-hidden="true" className="hidden"><UiText text="Website"/><input tabIndex={-1} autoComplete="off" value={form.website} onChange={e=>setForm({...form,website:e.target.value})}/></label>
 <label className="sm:col-span-2 flex gap-3 items-start"><input type="checkbox" required checked={form.consent} onChange={e=>setForm({...form,consent:e.target.checked})}/><span><UiText text={MARKETING_SIGNUP_CONSENT}/></span></label>
 <p className="sm:col-span-2 text-sm"><UiText text="Datele sunt folosite pentru înscrierea și comunicările solicitate. Înscrierile neconfirmate sunt păstrate cel mult 30 de zile."/> <Link href="/confidentialitate" className="underline"><UiText text="Politica de confidențialitate"/></Link></p>
 {error&&<p role="alert" className="sm:col-span-2 text-red-700">{error}</p>}<button className="v2-btn v2-btn-primary sm:col-span-2">{busy?<UiText text="Se înregistrează…"/>:<UiText text="Înregistrează solicitarea"/>}</button>
 </fieldset></form>}
 <p><Link href="/rezervare" className="underline"><UiText text="Vezi serviciile și calculează prețul"/></Link></p></main>;
}
