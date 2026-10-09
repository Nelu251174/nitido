'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {inputClass} from './ui';
type Request={id:string;original_at:string;proposed_at:string;status:string;firm_confirmed_at:string|null;authorization_status:string|null;cleanup_status:string|null};
const label=(date:string)=>new Intl.DateTimeFormat('ro-RO',{timeZone:'Europe/Bucharest',dateStyle:'medium',timeStyle:'short'}).format(new Date(date));
export function RescheduleVisit({jobId,scheduledAt,status,role,onChanged}:{jobId:string;scheduledAt:string|null;status:string;role:'client'|'firma';onChanged:()=>void|Promise<void>}){
 const [requests,setRequests]=useState<Request[]>([]),[date,setDate]=useState(''),[hour,setHour]=useState(10),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const lock=useRef(false),url=`/api/jobs/${encodeURIComponent(jobId)}/reschedule`;
 const load=useCallback(async()=>{const r=await fetch(url);if(!r.ok)throw Error('Reprogramările nu au putut fi încărcate.');const d=await r.json();setRequests(d.requests??[])},[url]);
 useEffect(()=>{let active=true;const refresh=()=>{if(document.visibilityState==='visible'&&!lock.current)void load().catch(e=>{if(active)setMessage(e.message)})};refresh();const timer=setInterval(refresh,15000);document.addEventListener('visibilitychange',refresh);return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',refresh)}},[load]);
 async function send(payload:Record<string,unknown>){
  if(lock.current)return;lock.current=true;setBusy(true);setMessage('');
  try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw Error(d.error);
   setMessage(d.status==='awaiting_authorization'?'Ai acceptat intervalul. Clientul trebuie să confirme o autorizare nouă pe card. Până atunci rămâne valabilă data actuală.':d.status==='pending'?'Propunerea a fost trimisă firmei. Programul actual rămâne valabil până la confirmare.':d.status==='accepted'?'Noua dată a fost salvată.':'Propunerea a fost închisă.');await load();await onChanged();
  }catch(error){setMessage(error instanceof Error?error.message:'Operația nu a fost confirmată.')}finally{lock.current=false;setBusy(false)}
 }
 const pending=requests.find(r=>r.status==='pending');
 if(!['waiting','accepted'].includes(status)&&!requests.length)return null;
 return <section className="v2-card p-4 my-4 min-w-0"><h3 className="font-bold">Reprogramează această vizită</h3>
  <p className="text-xs text-muted mt-2">Schimbarea se aplică numai acestei rezervări. Pentru o lucrare preluată, firma trebuie să confirme noul interval. Prețul rămâne cel al rezervării.</p>
  {message&&<p role="status" className="text-sm mt-3">{message}</p>}
  {pending?.firm_confirmed_at&&<div className="mt-3 space-y-3 text-sm">
   {['aborting','aborted'].includes(pending.authorization_status??'')?<p>Reautorizarea nu s-a încheiat. Data inițială rămâne valabilă. {role==='client'?'Retrage propunerea și alege alt interval.':'Clientul poate retrage propunerea și alege alt interval.'}</p>:<><p>Firma a acceptat intervalul. Reprogramarea așteaptă confirmarea cardului de către client; data actuală rămâne valabilă.</p>{role==='client'&&<Link className="v2-btn v2-btn-primary" href={`/client/plata/${encodeURIComponent(jobId)}/reprogramare/${encodeURIComponent(pending.id)}`}>Confirmă cardul pentru noua dată</Link>}</>}
  </div>}
  {pending?<div className="mt-3 text-sm"><p>{label(pending.original_at)} → {label(pending.proposed_at)}</p><div className="flex flex-wrap gap-3 mt-3">{role==='client'?<button disabled={busy} className="v2-btn v2-btn-secondary" onClick={()=>void send({action:'withdraw',requestId:pending.id})}>Retrage propunerea</button>:<><button disabled={busy} className="v2-btn v2-btn-primary" onClick={()=>void send({action:'accept',requestId:pending.id})}>Confirmă noua dată</button><button disabled={busy} className="v2-btn v2-btn-secondary" onClick={()=>void send({action:'reject',requestId:pending.id})}>Refuză</button></>}</div></div>:role==='client'&&['waiting','accepted'].includes(status)&&scheduledAt?<form className="mt-3" onSubmit={e=>{e.preventDefault();void send({action:'propose',date,hour,expectedAt:scheduledAt})}}><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Data nouă<input required type="date" className={inputClass} value={date} onChange={e=>setDate(e.target.value)}/></label><label className="text-sm">Ora României<select className={inputClass} value={hour} onChange={e=>setHour(Number(e.target.value))}>{[8,10,12,14,16,18].map(h=><option key={h} value={h}>{h}:00</option>)}</select></label></fieldset><button disabled={busy||!date} className="v2-btn v2-btn-primary mt-3">{status==='accepted'?'Propune firmei':'Salvează noua dată'}</button></form>:<p className="text-sm mt-3">Nu există o propunere în așteptare.</p>}
 </section>;
}
