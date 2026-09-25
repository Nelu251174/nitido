'use client';
import {useEffect,useState} from 'react';
import {inputClass} from './ui';
type Policy={revision:number;pickup_minutes:number|null;provider_minutes:number|null;resolution_minutes:number|null};
type Triage={revision:number;severity:string;owner_label:string;internal_note:string};
type Deadlines={triage:Triage|null;pickupDue:string|null;providerDue:string|null;resolutionDue:string|null;pickupOverdue:boolean;providerOverdue:boolean;resolutionOverdue:boolean;providerResponded:boolean};
export function AdminIncidentTriage({caseId,caseRevision,onSaved,canManage=true}:{canManage?:boolean;caseId?:string;caseRevision?:string;onSaved:()=>Promise<void>}){
 const [policy,setPolicy]=useState<Policy|null>(null),[data,setData]=useState<Deadlines|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');setData(null);void fetch('/api/admin/incident-triage'+(caseId?'?caseId='+encodeURIComponent(caseId):''),{cache:'no-store',signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(!controller.signal.aborted){setPolicy(d.policy);setData(d.case??null);}}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[caseId,caseRevision,refresh]);
 async function save(form:HTMLFormElement,action:'policy'|'triage'){
  const values=Object.fromEntries(new FormData(form));const body=action==='policy'?{action,revision:policy?.revision??0,reason:values.reason,...Object.fromEntries(['pickupMinutes','providerMinutes','resolutionMinutes'].map(k=>[k,values[k]===''?null:Number(values[k])]))}:{action,caseId,caseRevision,revision:data?.triage?.revision??0,severity:values.severity,owner:values.owner,note:values.note};
  setBusy(true);setError('');try{const r=await fetch('/api/admin/incident-triage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error);await onSaved();setRefresh(x=>x+1);setError('Salvat în istoricul administrativ.');}catch(e){setError(e instanceof Error?e.message:'Salvarea nu a fost confirmată.');}finally{setBusy(false);}
 }
 const date=(v:string|null)=>v?new Date(v).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest'}):'Neconfigurat';
 return <div className="rounded-xl border p-4 space-y-3" style={{background:'#fbf7ef',borderColor:'#ddd4c5'}}>
  <h3 className="font-bold">Responsabilitate și termene interne</h3>
  <p className="text-sm">Termenele sunt ținte interne. Preluarea se măsoară de la raportarea cazului; răspunsul prestatorului și rezoluția, de la prima preluare. Nu sunt trimise notificări automat și nu sunt promise termene clientului. Reatribuirea păstrează termenele inițiale.</p>
  {error&&<p role="status">{error}</p>}
  {loading?<p>Se încarcă termenele…</p>:<>
   {canManage&&<details><summary>Configurează termenele pentru cazurile viitoare</summary>
    <p className="text-sm my-2">Completează numai valori aprobate. Câmp gol înseamnă neconfigurat. Cazurile deja preluate păstrează politica inițială; cazurile încă nepreluate folosesc regula curentă.</p>
    <form key={'policy'+policy?.revision} className="grid gap-3 sm:grid-cols-3" onSubmit={e=>{e.preventDefault();void save(e.currentTarget,'policy');}}>
     {([['pickupMinutes','Preluare',policy?.pickup_minutes],['providerMinutes','Răspuns prestator',policy?.provider_minutes],['resolutionMinutes','Rezoluție',policy?.resolution_minutes]] as const).map(([name,label,value])=><label key={name}>{label} · minute<input className={inputClass} type="number" min={1} max={525600} step={1} name={name} defaultValue={value??''} disabled={busy}/></label>)}
     <label className="sm:col-span-3">Motivul și referința aprobării<textarea className={inputClass} required maxLength={2000} name="reason" disabled={busy}/></label><button className="v2-btn v2-btn-primary" disabled={busy}>Salvează termenele</button>
    </form>
   </details>}
   {caseId&&data&&<>
    <p>Preluare: {date(data.pickupDue)} {data.pickupOverdue?'· DEPĂȘIT':''}<br/>Răspuns prestator: {date(data.providerDue)} {data.providerOverdue?'· DEPĂȘIT':data.providerResponded?'· răspuns înregistrat':''}<br/>Rezoluție: {date(data.resolutionDue)} {data.resolutionOverdue?'· DEPĂȘIT':''}</p>
    <form key={caseId+':'+data.triage?.revision} className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();void save(e.currentTarget,'triage');}}>
     <label>Severitate<select className={inputClass} name="severity" defaultValue={data.triage?.severity??'normal'} disabled={busy}><option value="low">Redusă</option><option value="normal">Normală</option><option value="high">Ridicată</option><option value="critical">Critică</option></select></label>
     <label>Responsabil intern · nume<input className={inputClass} name="owner" required maxLength={150} defaultValue={data.triage?.owner_label??''} disabled={busy}/></label>
     <label className="sm:col-span-2">Notă internă · acces administrativ<textarea className={inputClass} name="note" required maxLength={2000} defaultValue={data.triage?.internal_note??''} disabled={busy}/></label>
     <p className="text-sm sm:col-span-2">Responsabilul este o evidență operațională, fără acordare de acces. Nota rămâne internă. Concluzia destinată clientului și firmei se completează separat mai jos.</p>
     <button className="v2-btn v2-btn-primary" disabled={busy}>{data.triage?'Actualizează responsabilitatea':'Preia dosarul'}</button>
    </form>
   </>}
  </>}
 </div>;
}
