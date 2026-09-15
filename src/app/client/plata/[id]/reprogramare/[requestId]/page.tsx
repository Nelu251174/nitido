'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useParams,useRouter} from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import {useCurrentUser} from '@/lib/useCurrentUser';
import {Button,Card,Logo} from '@/components/ui';
type Confirmation={status:'consent_required'|'waiting_window'|'requires_action'|'authorized';amountMinor:number;scheduledAt?:string;availableAt?:string;cleanupPending?:boolean;clientSecret?:string;paymentMethodId?:string;publishableKey?:string};
type StripeBrowser={confirmCardPayment:(secret:string,data:{payment_method:string})=>Promise<{error?:{message?:string}}>};
const dateLabel=(date:string)=>new Intl.DateTimeFormat('ro-RO',{timeZone:'Europe/Bucharest',dateStyle:'medium',timeStyle:'short'}).format(new Date(date));
export default function ConfirmRescheduleCard(){
 const {id,requestId}=useParams<{id:string;requestId:string}>(),router=useRouter(),{user,loading}=useCurrentUser();
 const [data,setData]=useState<Confirmation|null>(null),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[consent,setConsent]=useState(false),[error,setError]=useState('');
 const lock=useRef(false);
 const request=useCallback(async(action:'start'|'begin'|'verify')=>{
  const response=await fetch(`/api/jobs/${encodeURIComponent(id)}/reschedule/authorize-card`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,action}),cache:'no-store'});
  const body=await response.json();if(!response.ok)throw Error(body.error??'Confirmarea nu a fost încheiată.');return body as Confirmation;
 },[id,requestId]);
 useEffect(()=>{
  if(loading)return;
  if(!user){router.replace(`/login?next=${encodeURIComponent(`/client/plata/${id}/reprogramare/${requestId}`)}`);return}
  if(user.role!=='client')return;
  let active=true;void request('start').then(result=>{if(active)setData(result)}).catch(e=>{if(active)setError(e.message)});
  return()=>{active=false};
 },[id,requestId,user,loading,router,request]);
 async function refresh(){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{setData(await request('start'))}catch(e){setError(e instanceof Error?e.message:'Starea plății nu a fost confirmată.')}finally{lock.current=false;setBusy(false)}
 }
 async function confirm(){
  if(lock.current||!consent||!ready||!data||data.status==='waiting_window')return;
  lock.current=true;setBusy(true);setError('');
  try{
   const current=await request('begin');setData(current);
   if(current.status==='authorized'||current.status==='waiting_window')return;
   const create=(window as unknown as {Stripe?:(key:string)=>StripeBrowser}).Stripe;
   if(!create||!current.publishableKey||!current.clientSecret||!current.paymentMethodId)throw Error('Conexiunea securizată nu este disponibilă. Reîncarcă starea plății.');
   const result=await create(current.publishableKey).confirmCardPayment(current.clientSecret,{payment_method:current.paymentMethodId});
   if(result.error)throw Error(result.error.message??'Banca nu a confirmat autorizarea.');
   const verified=await request('verify');setData(verified);
   if(verified.status!=='authorized')throw Error('Reprogramarea nu a fost confirmată. Reîncarcă starea plății.');
  }catch(e){setError(e instanceof Error?e.message:'Conexiunea s-a întrerupt. Reîncarcă starea plății.')}finally{lock.current=false;setBusy(false)}
 }
 return <main className="min-h-screen bg-mist px-4 py-8"><div className="mx-auto max-w-lg min-w-0">
  <Link href="/client"><Logo/></Link><Card className="mt-6">
   <h1 className="text-2xl font-display font-bold">Confirmă cardul pentru noua dată</h1>
   {loading?<p className="mt-4">Se verifică sesiunea…</p>:user?.role!=='client'?<p className="mt-4">Folosește contul clientului care a creat rezervarea.</p>:<>
    {data&&<p className="my-5 text-3xl font-bold">{new Intl.NumberFormat('ro-RO',{style:'currency',currency:'RON'}).format(data.amountMinor/100)}</p>}
    {data?.scheduledAt&&<p className="text-sm">Interval propus: {dateLabel(data.scheduledAt)}</p>}
    {data?.status==='authorized'?<div role="status" className="mt-5 space-y-3"><p className="font-bold text-aqua-deep">Noua dată și autorizarea sunt confirmate.</p>{data.cleanupPending?<p className="text-sm">Eliberarea autorizării vechi este în curs și va fi reluată automat dacă procesatorul nu răspunde.</p>:<p className="text-sm">Eliberarea autorizării vechi a fost confirmată de procesator. Banca poate avea nevoie de timp pentru actualizarea soldului disponibil.</p>}</div>:<>
     <p className="mt-4 text-sm text-muted">Autorizarea veche nu acoperă noul interval. Autorizezi aceeași sumă pe cardul ales pentru această rezervare. Încasarea se face la finalizarea lucrării.</p>
     <p className="mt-3 text-sm">Temporar, banca poate afișa ambele sume rezervate. După confirmarea noii autorizări și a disponibilității firmei, eliberăm autorizarea veche. Dacă reprogramarea nu se poate încheia, eliberăm autorizarea nouă nefolosită.</p>
     <p className="mt-3 text-sm font-medium">Data actuală rămâne valabilă până când apare confirmarea reprogramării.</p>
     {data?.status==='waiting_window'?<p role="status" className="mt-4">Poți confirma cardul începând cu {data.availableAt?dateLabel(data.availableAt):'48 de ore înaintea vizitei'}.</p>:<label className="mt-5 flex items-start gap-3 text-sm"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0"/><span>Sunt de acord cu noua autorizare și cu rezervarea temporară a ambelor sume.</span></label>}
     <Button className="mt-5 w-full" disabled={busy||!ready||!consent||!data||data.status==='waiting_window'} onClick={()=>void confirm()}>{busy?'Se confirmă…':'Autorizează și confirmă noua dată'}</Button>
    </>}
    <button className="mt-4 w-full text-sm underline py-2" disabled={busy} onClick={()=>void refresh()}>Reîncarcă starea plății</button>
   </>}
   {error&&<p role="alert" className="mt-4 text-sm text-coral">{error}</p>}
   <Link className="mt-5 block text-sm font-bold underline" href="/client">Revino la rezervare</Link>
  </Card></div>{user?.role==='client'&&<Script src="https://js.stripe.com/v3/" onReady={()=>setReady(true)} onError={()=>setError('Conexiunea securizată nu s-a încărcat. Reîncarcă pagina.')}/>}</main>;
}
