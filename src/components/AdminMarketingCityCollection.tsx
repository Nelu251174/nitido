'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, inputClass } from './ui';
import { CITY_COLLECTION_STATES, type MarketingCityView } from '@/lib/adminMarketingCityShared';
import { MARKETING_CATEGORIES } from '@/lib/adminMarketingShared';
async function request(body?:unknown,id?:string,page=1):Promise<MarketingCityView|null>{
 const params=new URLSearchParams({page:String(page)});if(id)params.set('id',id);
 const response=await fetch('/api/admin/marketing/city?'+params,{method:body?'POST':'GET',cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
 const result=await response.json();if(!response.ok)throw Error(result.error??'Colectarea municipiului nu a reușit.');return result.view;
}
const activeStates=['queued','discovering','collecting','waiting'];
export function AdminMarketingCityCollection({onProgress}:{onProgress?:()=>void}){
 const [city,setCity]=useState('Constanța'),[view,setView]=useState<MarketingCityView|null>(null),[page,setPage]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const locked=useRef(false);
 const load=useCallback(async(id?:string,targetPage=1)=>{try{setView(await request(undefined,id,targetPage));}catch(e){setError((e as Error).message);}},[]);
 useEffect(()=>{const controller=setTimeout(()=>void load(),0);return()=>clearTimeout(controller);},[load]);
 useEffect(()=>{if(!view||!activeStates.includes(view.job.state))return;const timer=setInterval(()=>void load(view.job.id,page),5000);return()=>clearInterval(timer);},[view?.job.id,view?.job.state,page,load,view]);
 async function run(body:unknown){if(locked.current)return;locked.current=true;setBusy(true);setError('');try{setView(await request(body));setPage(1);}catch(e){setError((e as Error).message);}finally{locked.current=false;setBusy(false);}}
 useEffect(()=>{if(view?.job.id)onProgress?.();},[view?.job.id,view?.job.saved,onProgress]);
 const job=view?.job,active=!!job&&activeStates.includes(job.state);
 return <Card><div className="space-y-4"><h3 className="text-2xl font-bold">Colectare municipiu întreg</h3><p>Pornește cu <b>Constanța</b>: toate domeniile disponibile în sursă, inclusiv firmele de curățenie. Sistemul preia lista municipiului și verifică firmele în fundal, fără limita de 20 de firme a căutării rapide.</p><p className="text-sm text-muted">Sursa OpenStreetMap nu este registrul complet al firmelor înregistrate. Lista poate include puncte de lucru ale aceleiași firme. Datele necesită verificare; nu putem garanta găsirea unui email pentru fiecare firmă.</p>
 {error&&<p role="alert" className="text-red-800">{error}</p>}
 <form onSubmit={e=>{e.preventDefault();void run({action:'start',data:{city}});}} className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1">Municipiu<input className={inputClass} required maxLength={100} value={city} onChange={e=>setCity(e.target.value)} disabled={busy||active}/></label><button className="v2-btn v2-btn-primary" disabled={busy||active}>{busy?'Se pornește…':`Pornește colectarea întregului municipiu`}</button></form>
 <p className="text-sm text-muted">Contactele cu email sau website se salvează automat ca <b>Noi, fără acord înregistrat</b>. Duplicatele existente și dezabonările sunt păstrate. Colectarea continuă când închizi pagina. Nu se trimit emailuri.</p>
 {view&&job&&<section className="space-y-4 border-t border-line pt-4" aria-label="Progres colectare municipiu"><h4 className="font-bold text-lg">{job.city} · {CITY_COLLECTION_STATES[job.state]}</h4>
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[['Firme în sursă',job.total],['Firme procesate',job.processed],['Firme cu email public',job.emails],['Contacte noi salvate',job.saved],['Duplicate existente',job.duplicates],['Procesate fără email',job.withoutEmail],['Necesită verificare site',job.errors]].map(([label,value])=><div key={label} className="rounded-xl border border-line p-3"><p className="text-sm text-muted">{label}</p><b className="text-2xl">{value}</b></div>)}</div>
 {job.total>0&&<progress aria-label="Firme procesate" className="w-full" max={job.total} value={job.processed}/>}
 {job.message&&<p role="status">{job.message}</p>}{job.nextAttemptAt&&job.state==='waiting'&&<p className="text-sm">Următoarea încercare: {new Date(job.nextAttemptAt).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest'})}, ora României.</p>}
 <div className="flex flex-wrap gap-3">{active&&<button disabled={busy} className="v2-btn v2-btn-secondary" onClick={()=>void run({action:'pause',id:job.id})}>Pauză colectare municipiu</button>}{['paused','waiting'].includes(job.state)&&<button disabled={busy} className="v2-btn v2-btn-primary" onClick={()=>void run({action:'resume',id:job.id})}>Reia colectarea municipiului</button>}{!['completed','canceled'].includes(job.state)&&<button disabled={busy} className="v2-btn v2-btn-secondary" onClick={()=>void run({action:'cancel',id:job.id})}>Oprește colectarea municipiului</button>}<button disabled={busy} className="v2-btn v2-btn-secondary" onClick={()=>void load(job.id,page)}>Actualizează progresul</button>{job.total>0&&<a className="v2-btn v2-btn-secondary" href={'/api/admin/marketing/city?format=csv&id='+encodeURIComponent(job.id)}>Exportă lista municipiului CSV</a>}</div>
 <p className="text-sm text-muted">{view.attribution}</p>
 {!!view.items.length&&<div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Firme din municipiu</caption><thead><tr>{['Firmă','Categorie','Email / website','Sursă','Rezultat'].map(label=><th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{view.items.map(item=><tr key={item.id} className="border-t border-line"><td className="p-2">{item.name}</td><td className="p-2">{MARKETING_CATEGORIES[item.category]}</td><td className="p-2 break-all">{item.email||item.website||'Email și website nepublicate în sursă'}</td><td className="p-2"><a className="underline" href={item.source} target="_blank" rel="noreferrer">Verifică sursa</a></td><td className="p-2">{item.status==='pending'?'În așteptare':item.warning||(!item.email?'Fără email public':'Email public găsit')}</td></tr>)}</tbody></table></div>}
 {view.pages>1&&<div className="flex flex-wrap gap-3 items-center"><button className="v2-btn v2-btn-secondary" disabled={busy||page<=1} onClick={()=>{setPage(page-1);void load(job.id,page-1);}}>Pagina anterioară</button><span>Pagina {page} / {view.pages}</span><button className="v2-btn v2-btn-secondary" disabled={busy||page>=view.pages} onClick={()=>{setPage(page+1);void load(job.id,page+1);}}>Pagina următoare</button></div>}
 </section>}
 </div></Card>;
}
