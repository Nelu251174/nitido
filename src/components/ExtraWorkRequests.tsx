'use client';
import {useDisplayMoney} from '@/components/UiMoney';
import {UiText} from '@/components/UiText';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import {useCurrentUser} from '@/lib/useCurrentUser';
import {CATALOG_CATEGORIES} from '@/lib/serviceCatalog';
import type {ExtraWorkData} from '@/lib/extraWorkShared';

const states:Record<string,string>={proposed:'Propus pentru evaluare',approved:'Acceptat pentru evaluare',rejected:'Refuzat',withdrawn:'Retras',expired:'Expirat',outdated:'Context schimbat — propunere nevalabilă'};
class ProposalResponseError extends Error {}
export function ExtraWorkRequests({jobId}:{jobId:string}){
 const {money}=useDisplayMoney();
 const {user,loading,error:authError,retry}=useCurrentUser(),locale=useLocale();
 const [stored,setStored]=useState<{scope:string;data:ExtraWorkData}|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0),[consent,setConsent]=useState<Record<string,boolean>>({});
 const [category,setCategory]=useState('general'),[description,setDescription]=useState(''),[amount,setAmount]=useState(''),[sqm,setSqm]=useState(''),[rooms,setRooms]=useState(0),[bathrooms,setBathrooms]=useState(0),[difficulty,setDifficulty]=useState('');
 const lock=useRef(false),pending=useRef<{signature:string;key:string}|null>(null),scope=user?.id+':'+jobId;
 const load=useCallback(async(signal?:AbortSignal)=>{const r=await fetch('/api/jobs/'+encodeURIComponent(jobId)+'/extra-work',{signal});const b=await r.json();if(!r.ok||!Array.isArray(b.proposals))throw new ProposalResponseError(typeof b?.error==='string'?b.error:'Propunerile nu pot fi încărcate.');if(!signal?.aborted&&user){setStored({scope:user.id+':'+jobId,data:b});setError('');}},[jobId,user]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- data is written only after an asynchronous owner-scoped request.
 useEffect(()=>{if(!user||!['client','firma'].includes(user.role))return;const abort=new AbortController();void load(abort.signal).catch(e=>{if(!abort.signal.aborted)setError(e instanceof ProposalResponseError?e.message:'Conexiune indisponibilă.');});return()=>abort.abort();},[user,load,refresh]);
 async function post(body:Record<string,unknown>){if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');try{
  if(body.action==='propose'){
   if(!/^\d{1,6}(?:[.,]\d{1,2})?$/.test(amount.trim()))throw new ProposalResponseError('Introdu suma în lei, cu maximum două zecimale.');
   body={...body,category,description,proposedBani:Math.round(Number(amount.replace(',','.'))*100),sqm:Number(sqm),rooms,bathrooms,difficulty};
   const signature=JSON.stringify([jobId,body]);if(pending.current?.signature!==signature)pending.current={signature,key:crypto.randomUUID()};body.requestKey=pending.current.key;
  }
  const r=await fetch('/api/jobs/'+encodeURIComponent(jobId)+'/extra-work',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),b=await r.json();if(!r.ok||b.ok!==true)throw new ProposalResponseError(typeof b?.error==='string'?b.error:'Salvarea nu a fost confirmată.');
  if(body.action==='propose'){pending.current=null;setDescription('');setAmount('');setSqm('');setDifficulty('');}
  setNotice(body.action==='approve'?'Propunerea a fost trimisă la evaluare. Nu s-a creat o rezervare și nu s-a autorizat cardul.':'Modificarea propunerii a fost salvată.');
  try{await load()}catch{setNotice('Modificarea a fost salvată. Actualizează propunerile pentru starea curentă.');}
 }catch(e){setError(e instanceof ProposalResponseError?e.message:'Operația nu a fost confirmată.');}finally{lock.current=false;setBusy(false);}}
 if(loading)return null;
 if(authError)return <section className="design-panel my-5" role="alert"><UiText text={authError}/><button type="button" className="v2-btn" onClick={retry}><UiText text="Reîncearcă"/></button></section>;
 if(!user||!['client','firma'].includes(user.role))return null;
 const own=stored?.scope===scope?stored.data:null;
 return <section className="design-panel my-5" aria-labelledby={'extra-'+jobId}><h2 id={'extra-'+jobId} className="font-bold text-xl"><UiText text="Suplimente propuse pentru evaluare"/></h2><p className="my-3"><UiText text="Firma descrie lucrările suplimentare și suma propusă. Clientul poate accepta trimiterea la evaluare. Prețul final și rezervarea separată necesită confirmare ulterioară; acest pas nu autorizează cardul și nu permite începerea suplimentului."/></p>
  <button type="button" className="v2-btn my-3" disabled={busy} onClick={()=>{setError('');setRefresh(n=>n+1);if(authError)retry();}}><UiText text="Actualizează propunerile"/></button>
  {(error||authError)&&<p role="alert"><UiText text={error||authError}/></p>}{notice&&<p role="status"><UiText text={notice}/></p>}{!own&&!error&&!authError&&<p role="status"><UiText text="Se încarcă…"/></p>}
  {own?.canPropose&&<details className="my-4"><summary className="font-semibold"><UiText text="Propune un supliment"/></summary><form className="grid gap-4 my-4" onSubmit={e=>{e.preventDefault();void post({action:'propose'});}}><fieldset disabled={busy} className="grid gap-4">
   <label><UiText text="Serviciu solicitat"/><select className="w-full border p-3 rounded" value={category} onChange={e=>setCategory(e.target.value)}>{CATALOG_CATEGORIES.map(([key,label])=><option key={key} value={key}><UiText text={label}/></option>)}</select></label>
   <label><UiText text="Ce include suplimentul și de ce este necesar?"/><textarea required maxLength={2000} className="w-full border p-3 rounded" value={description} onChange={e=>setDescription(e.target.value)}/></label>
   <label><UiText text="Sumă propusă pentru evaluare, lei"/><input required inputMode="decimal" className="w-full border p-3 rounded" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
   <label><UiText text="Suprafața suplimentului pentru evaluare, m²"/><input required min={1} max={1000000} type="number" className="w-full border p-3 rounded" value={sqm} onChange={e=>setSqm(e.target.value)}/></label>
   <label><UiText text="Camere"/><input required type="number" min={0} max={10000} className="w-full border p-3 rounded" value={rooms} onChange={e=>setRooms(Number(e.target.value))}/></label>
   <label><UiText text="Băi"/><input required type="number" min={0} max={10000} className="w-full border p-3 rounded" value={bathrooms} onChange={e=>setBathrooms(Number(e.target.value))}/></label>
   <label><UiText text="Dificultate"/><select required className="w-full border p-3 rounded" value={difficulty} onChange={e=>setDifficulty(e.target.value)}><option value=""><UiText text="Alege dificultatea"/></option><option value="light"><UiText text="Redusă"/></option><option value="normal"><UiText text="Obișnuită"/></option><option value="heavy"><UiText text="Ridicată"/></option></select></label>
   <button className="v2-btn v2-btn-primary" type="submit"><UiText text="Trimite propunerea pentru client"/></button>
  </fieldset></form></details>}
  {own&&!own.proposals.length&&<p><UiText text="Nu există propuneri suplimentare pentru această lucrare."/></p>}
  <ul className="grid gap-4 my-4">{own?.proposals.map(p=><li key={p.id} className="v2-card p-4"><h3 className="font-semibold"><UiText text={states[p.status]??p.status}/></h3><p className="whitespace-pre-wrap my-2">{p.terms.description}</p><p><UiText text={CATALOG_CATEGORIES.find(([key])=>key===p.terms.category)?.[1]??p.terms.category}/> · <UiText text={{light:'Redusă',normal:'Obișnuită',heavy:'Ridicată'}[p.terms.difficulty]}/></p><p>{money(p.terms.proposedBani/100)} · {p.terms.sqm}<UiText text={" m² · "}/>{p.terms.rooms} <UiText text="camere"/> · {p.terms.bathrooms} <UiText text="băi"/></p><p><UiText text="Valabilă până la "/>{new Intl.DateTimeFormat(locale,{timeZone:'Europe/Bucharest',dateStyle:'medium',timeStyle:'short'}).format(new Date(p.expiresAt))}</p>
   {p.status==='proposed'&&own.role==='client'&&<><label className="flex gap-3 my-3"><input type="checkbox" checked={!!consent[p.id]} disabled={busy} onChange={e=>setConsent(s=>({...s,[p.id]:e.target.checked}))}/><UiText text="Accept trimiterea la evaluare. Înțeleg că nu confirm o plată, o rezervare sau începerea suplimentului."/></label><div className="flex gap-3 flex-wrap"><button type="button" className="v2-btn v2-btn-primary" disabled={busy||!consent[p.id]} onClick={()=>void post({action:'approve',id:p.id,revision:p.revision,acknowledgeNoPayment:consent[p.id]===true})}><UiText text="Acceptă pentru evaluare"/></button><button type="button" className="v2-btn" disabled={busy} onClick={()=>void post({action:'reject',id:p.id,revision:p.revision})}><UiText text="Refuză propunerea"/></button></div></>}
   {p.status==='proposed'&&own.role==='firma'&&<button type="button" className="v2-btn" disabled={busy} onClick={()=>void post({action:'withdraw',id:p.id,revision:p.revision})}><UiText text="Retrage propunerea"/></button>}
   {p.assessmentId&&<Link className="v2-btn mt-3" href="/client/evaluari"><UiText text="Vezi evaluările mele"/></Link>}
  </li>)}</ul><p className="text-sm"><UiText text="Sunt afișate cel mult 100 de propuneri. Lucrarea originală, plata și condițiile ei se urmăresc separat."/></p>
 </section>;
}
