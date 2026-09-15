'use client';
import {useState} from 'react';
import Link from 'next/link';
import type {ExecutionReport} from '@/lib/business';
import {money} from '@/lib/workspaceShared';
export function BusinessExecutionReport({properties=[],organizationId=''}:{organizationId?:string;properties?:{id:string;name:string;kind:string;organization_id?:string|null;organization_name?:string|null}[]}){
 const [month,setMonth]=useState(()=>new Date().toISOString().slice(0,7));
 const [scope,setScope]=useState<'all'|'business'>('business'),[property,setProperty]=useState(''),[organization,setOrganization]=useState(organizationId);
 const organizations=Array.from(new Map(properties.filter(p=>p.organization_id).map(p=>[p.organization_id!,p.organization_name??'Organizație'])).entries());
 const [report,setReport]=useState<ExecutionReport|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const query=new URLSearchParams({month,scope});if(property)query.set('propertyId',property);if(organization)query.set('organizationId',organization);
 async function load(){setBusy(true);setError('');setReport(null);try{const r=await fetch(`/api/reports/execution?${query}`);const d=await r.json();if(!r.ok)throw new Error(d.error||'Raport indisponibil');setReport(d.report)}catch(e){setError(e instanceof Error?e.message:'Eroare de conexiune')}finally{setBusy(false)}}
 return <section className="design-panel mt-6"><h2 className="font-bold text-xl">Raport lunar de execuție</h2>
  <p className="text-sm text-muted mt-2">Lucrări finalizate, locații și centre de cost. Luna folosește data finalizării în UTC. Sumele sunt în RON și reprezintă valoarea lucrărilor; raportul nu este o factură sau o confirmare de încasare.</p>
  <div className="workspace-toolbar">
   <label>Luna<input className="booking-input" type="month" value={month} disabled={busy} onChange={e=>{setMonth(e.target.value);setReport(null)}}/></label>
   <label>Portofoliu<select className="booking-input" value={scope} disabled={busy} onChange={e=>{setScope(e.target.value as 'all'|'business');setProperty('');setReport(null)}}><option value="business">Locații Business</option><option value="all">Întregul cont client</option></select></label>
   <label>Organizația<select className="booking-input" disabled={busy||!!organizationId} value={organization} onChange={e=>{setOrganization(e.target.value);setProperty('');setReport(null)}}><option value="">Toate organizațiile / contul propriu</option>{organizations.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
   <label>Locația<select className="booking-input" value={property} disabled={busy} onChange={e=>{setProperty(e.target.value);setReport(null)}}><option value="">Toate locațiile din portofoliu</option>{properties.filter(p=>(scope==='all'||p.kind==='business')&&(!organization||p.organization_id===organization)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <button className="v2-btn v2-btn-primary" disabled={busy||!month} onClick={()=>void load()}>{busy?'Se încarcă…':'Generează raportul'}</button>
  </div>
  {error&&<p role="alert" className="workspace-error">{error}</p>}
  {report&&<>
   <p role="status">{report.totalJobs} lucrări finalizate · {money(report.totalAmount)} · {report.rows.reduce((n,r)=>n+(r.openCases??0),0)} dosare deschise</p>
   <div className="overflow-x-auto"><table className="workspace-table"><thead><tr><th>Lucrare / documente</th><th>Finalizată (UTC)</th><th>Locație / centru de cost</th><th>Firmă</th><th>Valoare RON</th><th>Întârziere sosire</th><th>Probleme / recepție</th></tr></thead><tbody>{report.rows.map(r=><tr key={r.jobId}>
    <td><Link href={`/client?jobId=${encodeURIComponent(r.jobId)}`} className="underline">{r.jobId}</Link><small>{r.city} · {r.street}</small></td>
    <td>{r.completedAt??'—'}</td><td>{r.propertyName??'Fără locație asociată'}<small>{r.costCenter||'Fără centru de cost'}</small></td>
    <td>{r.firmName??'—'}</td><td>{money(r.priceGross)}</td><td>{r.arrivalDelayMinutes===null||r.arrivalDelayMinutes===undefined?'Fără oră de sosire confirmată':`${r.arrivalDelayMinutes} min`}</td>
    <td>{(r.caseCount??0)>0?<Link className="underline" href={`/remedieri?jobId=${encodeURIComponent(r.jobId)}`}>{r.caseCount} dosare · {r.openCases} deschise</Link>:'Fără dosare'}<small>{r.receiptConfirmedAt?'Recepție confirmată':'Recepție neconfirmată'}</small></td>
   </tr>)}</tbody></table></div>
   {!report.rows.length&&<p className="mt-3">Nicio lucrare finalizată pentru filtrele selectate.</p>}
   <a className="v2-btn v2-btn-secondary mt-4" href={`/api/reports/execution?${query}&format=csv`} download>Descarcă raportul CSV</a>
   <p className="text-sm text-muted mt-2">Întârzierea compară ora programată cu sosirea confirmată în aplicație; nu reprezintă o penalizare. Exportul aplică aceleași filtre și reflectă datele actualizate la descărcare.</p>
  </>}
 </section>;
}
