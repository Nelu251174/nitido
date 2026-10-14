'use client';
import {UiText,UiElement,UiTemplate} from '@/components/UiText';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import type {ExecutionReport} from '@/lib/business';
import {money} from '@/lib/workspaceShared';
type Property={id:string;name:string;kind:string;archived?:number;organization_id?:string|null;organization_name?:string|null};
type Saved={id:string;name:string;createdAt:string};
const dateLabel=(s:string)=>new Date(s).toLocaleString('ro-RO',{timeZone:'UTC'});
export function BusinessExecutionReport({properties=[],organizationId=''}:{organizationId?:string;properties?:Property[]}){
 const today=new Date().toISOString().slice(0,10);
 const [from,setFrom]=useState(today.slice(0,7)+'-01'),[to,setTo]=useState(today);
 const [scope,setScope]=useState('business'),[property,setProperty]=useState(''),[organization,setOrganization]=useState(organizationId);
 const [catalog,setCatalog]=useState<{properties:Property[];organizations:{id:string;name:string}[]}>({properties,organizations:[]});
 const [report,setReport]=useState<ExecutionReport|null>(null),[savedId,setSavedId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [name,setName]=useState(''),[saved,setSaved]=useState<Saved[]>([]),[page,setPage]=useState(0),[hasMore,setHasMore]=useState(false),[reload,setReload]=useState(0),[archiveError,setArchiveError]=useState('');
 const lock=useRef(false),requestKey=useRef('');
 const query=new URLSearchParams({from,to,scope});if(property)query.set('propertyId',property);if(organization)query.set('organizationId',organization);
 useEffect(()=>{let live=true;void fetch('/api/reports/execution?view=catalog').then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(live)setCatalog(d)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[]);
 useEffect(()=>{let live=true;const p=new URLSearchParams({view:'archive',page:String(page)});if(organization)p.set('organizationId',organization);
 void fetch(`/api/reports/execution?${p}`).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(live){setSaved(d.saved);setHasMore(d.hasMore);setArchiveError('')}}).catch(e=>{if(live){setSaved([]);setArchiveError(e.message)}});return()=>{live=false};},[organization,page,reload]);
 function clear(){setReport(null);setSavedId('');requestKey.current='';setError('')}
 async function run(mode:'load'|'save'|'open',id?:string){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{
   if(mode==='save'&&!requestKey.current)requestKey.current=crypto.randomUUID();
   const url=mode==='open'?`/api/reports/execution?savedId=${encodeURIComponent(id!)}`:`/api/reports/execution?${query}`;
   const r=await fetch(url,mode==='save'?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,requestKey:requestKey.current})}:{});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Raport indisponibil.');setReport(d.report);setSavedId(d.id??'');
   if(mode==='save'){setPage(0);setReload(n=>n+1);requestKey.current=''}
  }catch(e){setError(e instanceof Error?e.message:'Conexiune indisponibilă.')}finally{lock.current=false;setBusy(false)}
 }
 const months=new Map<string,{jobs:number;bani:number}>(),locations=new Map<string,{label:string;jobs:number;bani:number}>();
 for(const r of report?.rows??[]){const month=r.completedAt?new Date(r.completedAt).toISOString().slice(0,7):'Fără dată';const m=months.get(month)??{jobs:0,bani:0};m.jobs++;m.bani+=Math.round(r.priceGross*100);months.set(month,m);const key=JSON.stringify([r.propertyId,r.costCenter]);const l=locations.get(key)??{label:`${r.propertyName??'Fără locație'} · ${r.costCenter||'Fără centru de cost'}`,jobs:0,bani:0};l.jobs++;l.bani+=Math.round(r.priceGross*100);locations.set(key,l)}
 return <section id="raport-istoric" className="design-panel mt-6"><h2 className="font-bold text-xl"><UiText text={"Raportare istorică"}/></h2>
 <p className="text-sm text-muted mt-2"><UiText text={"Lucrări finalizate în perioada aleasă, inclusiv locații arhivate sau module dezactivate. Datele sunt în UTC, valorile în RON. Raportul operațional nu este factură sau confirmare de încasare."}/></p>
 <div className="report-filters">
 <label><UiText text={"De la"}/><input className="booking-input" type="date" value={from} disabled={busy} onChange={e=>{setFrom(e.target.value);clear()}}/></label>
 <label><UiText text={"Până la, inclusiv"}/><input className="booking-input" type="date" value={to} disabled={busy} onChange={e=>{setTo(e.target.value);clear()}}/></label>
 <label><UiText text={"Portofoliu"}/><select className="booking-input" value={scope} disabled={busy} onChange={e=>{setScope(e.target.value);setProperty('');clear()}}><option value="business"><UiText text={"Birouri și firme"}/></option><option value="host"><UiText text={"Curățenie între rezervări"}/></option><option value="all"><UiText text={"Întregul cont client"}/></option></select></label>
 <label><UiText text={"Organizația"}/><select className="booking-input" disabled={busy||!!organizationId} value={organization} onChange={e=>{setOrganization(e.target.value);setProperty('');setPage(0);clear()}}><option value=""><UiText text={"Toate / contul propriu"}/></option>{catalog.organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
 <label><UiText text={"Locația"}/><select className="booking-input" value={property} disabled={busy} onChange={e=>{setProperty(e.target.value);clear()}}><option value=""><UiText text={"Toate locațiile"}/></option>{catalog.properties.filter(p=>(scope==='all'||p.kind===scope)&&(!organization||p.organization_id===organization)).map(p=><option key={p.id} value={p.id}>{p.name}{p.archived?<UiText text={' · arhivată'}/>:''}</option>)}</select></label>
 <button className="v2-btn v2-btn-primary" disabled={busy||!from||!to} onClick={()=>void run('load')}>{busy?<UiText text={'Se procesează…'}/>:<UiText text={'Generează raportul'}/>}</button>
 </div>
 {error&&<p role="alert" className="workspace-error">{<UiText text={error}/>}</p>}
 {report&&<>
 <p role="status" className="font-semibold">{savedId?<UiText text={'Raport salvat'}/>:<UiText text={'Raport actualizat'}/>} · {report.from??report.month??<UiText text={'Toate datele'}/>} — {report.to??''} · {report.organizationName??<UiText text={'Cont client'}/>} · {report.scope==='business'?<UiText text={'Birouri și firme'}/>:report.scope==='host'?<UiText text={'Curățenie între rezervări'}/>:<UiText text={'Toate portofoliile'}/>}<UiText text={" · generat "}/>{report.generatedAt?dateLabel(report.generatedAt):'—'}<UiText text={" UTC"}/></p>
 <div className="workspace-metrics"><div><strong>{report.totalJobs}</strong><p><UiText text={"Lucrări finalizate"}/></p></div><div><strong>{money(report.totalAmount)}</strong><p><UiText text={"Valoarea lucrărilor"}/></p></div><div><strong>{report.rows.reduce((n,r)=>n+(r.openCases??0),0)}</strong><p><UiText text={"Dosare deschise la generare"}/></p></div><div><strong>{report.rows.filter(r=>r.receiptConfirmedAt).length}</strong><p><UiText text={"Recepții confirmate"}/></p></div></div>
 <div className="report-summary"><details><summary className="font-bold cursor-pointer"><UiText text={"Totaluri pe luni"}/></summary>{[...months].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=><p className="py-2" key={k}>{k} · {v.jobs}<UiText text={" lucrări · "}/>{money(v.bani/100)}</p>)}</details><details><summary className="font-bold cursor-pointer"><UiText text={"Totaluri pe locații și centre de cost"}/></summary>{[...locations].map(([k,v])=><p className="py-2" key={k}>{v.label} · {v.jobs}<UiText text={" lucrări · "}/>{money(v.bani/100)}</p>)}</details></div>
 <div className="overflow-x-auto"><table className="workspace-table"><thead><tr><th><UiText text={"Lucrare / documente"}/></th><th><UiText text={"Finalizată (UTC)"}/></th><th><UiText text={"Organizație / locație"}/></th><th><UiText text={"Firmă"}/></th><th><UiText text={"Valoare RON"}/></th><th><UiText text={"Întârziere sosire"}/></th><th><UiText text={"Dovezi / recepție"}/></th></tr></thead><tbody>{report.rows.map(r=><tr key={r.jobId}><td><Link href={`/client?jobId=${encodeURIComponent(r.jobId)}`} className="underline">{r.jobId}</Link><small>{r.city} · {r.street}</small></td><td>{r.completedAt?dateLabel(r.completedAt):'—'}</td><td>{r.organizationName??<UiText text={'Cont propriu'}/>}<small>{r.propertyName??<UiText text={'Fără locație'}/>} · {r.costCenter||<UiText text={'Fără centru de cost'}/>}</small></td><td>{r.firmName??'—'}</td><td>{money(r.priceGross)}</td><td>{r.arrivalDelayMinutes==null?<UiText text={'Neconfirmată'}/>:<UiTemplate text={"{p0} min"} values={[r.arrivalDelayMinutes]}/>}</td><td>{r.photoCount??0}<UiText text={" fotografii valide"}/><small>{r.receiptConfirmedAt?<UiText text={'Recepție confirmată'}/>:<UiText text={'Recepție neconfirmată'}/>}</small>{!!r.caseCount&&<Link className="underline" href={`/remedieri?jobId=${encodeURIComponent(r.jobId)}`}>{r.caseCount}<UiText text={" dosare · "}/>{r.openCases}<UiText text={" deschise"}/></Link>}</td></tr>)}</tbody></table></div>
 {!report.rows.length&&<p className="mt-3"><UiText text={"Nicio lucrare finalizată pentru filtrele selectate."}/></p>}
 <a className="v2-btn v2-btn-secondary mt-4" href={savedId?`/api/reports/execution?savedId=${encodeURIComponent(savedId)}&format=csv`:`/api/reports/execution?${query}&format=csv`} download><UiText text={"Descarcă CSV"}/>{savedId?<UiText text={' salvat'}/>:''}</a>
 {!savedId&&<div className="report-filters"><label><UiText text={"Denumire în arhivă"}/><UiElement as="input" className="booking-input" maxLength={100} value={name} disabled={busy} placeholder="Ex. Raport septembrie 2026" onChange={e=>{setName(e.target.value);requestKey.current=''}}/></label><button className="v2-btn v2-btn-primary" disabled={busy||!name.trim()} onClick={()=>void run('save')}><UiText text={"Actualizează și salvează în arhivă"}/></button></div>}
 <p className="text-sm text-muted mt-3"><UiText text={"Asocierea organizației, denumirile și centrele de cost sunt cele de la generare. Salvarea recalculează raportul și păstrează acea versiune. CSV-ul salvat reproduce versiunea păstrată; cel nesalvat recalculează datele. Legăturile către lucrări deschid documentele actuale, fără a arhiva fotografiile sau facturile în raport."}/></p>
 </>}
 <section className="mt-6 border-t pt-5"><h3 className="font-bold text-xl"><UiText text={"Arhiva rapoartelor"}/></h3><p className="text-sm text-muted my-3"><UiText text={"Rapoartele tale salvate"}/>{organization?<UiText text={' pentru organizația selectată'}/>:''}<UiText text={", indiferent de perioada de mai sus. Acces rezervat contului titular care le-a salvat."}/></p>
 {archiveError&&<p role="alert" className="workspace-error">{archiveError} <button className="underline" onClick={()=>setReload(n=>n+1)}><UiText text={"Reîncearcă"}/></button></p>}
 {!saved.length&&!archiveError&&<p><UiText text={"Nu există rapoarte pe această pagină."}/></p>}
 {saved.map(s=><div className="workspace-toolbar flex-wrap" key={s.id}><div className="flex-1"><b>{s.name}</b><small className="block">{dateLabel(s.createdAt)}<UiText text={" UTC"}/></small></div><button disabled={busy} className="v2-btn v2-btn-secondary" onClick={()=>void run('open',s.id)}><UiText text={"Deschide"}/></button><a className="v2-btn v2-btn-secondary" href={`/api/reports/execution?savedId=${encodeURIComponent(s.id)}&format=csv`} download><UiText text={"CSV"}/></a></div>)}
 <div className="flex gap-3 mt-4"><button className="v2-btn v2-btn-secondary" disabled={busy||page===0} onClick={()=>setPage(p=>p-1)}><UiText text={"Anterior"}/></button><span className="self-center"><UiText text={"Pagina "}/>{page+1}</span><button className="v2-btn v2-btn-secondary" disabled={busy||!hasMore} onClick={()=>setPage(p=>p+1)}><UiText text={"Următor"}/></button></div></section>
 </section>;
}
