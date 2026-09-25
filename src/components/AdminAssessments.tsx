'use client';
import {AssistedJourney} from './AssistedJourney';
import {useCallback,useEffect,useState} from 'react';
import type {Assessment} from '@/lib/assessmentShared';
import {AdminManualEstimate} from './AdminManualEstimate';
import {AssessmentEvidence} from './AssessmentEvidence';
import {AssessmentThread} from './AssessmentThread';
export function AdminAssessments(){
 const [requests,setRequests]=useState<Assessment[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[all,setAll]=useState(false);
 const load=useCallback(async()=>{const r=await fetch('/api/admin/assessments'),d=await r.json();if(!r.ok)throw new Error(d.error||'Cererile nu pot fi încărcate');setRequests(d.requests);setLoaded(true)},[]);
 useEffect(()=>{const controller=new AbortController();fetch('/api/admin/assessments',{signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Cererile nu pot fi încărcate');return d}).then(d=>{if(!controller.signal.aborted){setRequests(d.requests);setLoaded(true)}}).catch(e=>{if(!controller.signal.aborted)setError(e.message)});return()=>controller.abort()},[]);
 async function action(id:string,version:number,action:string,body:string){setBusy(true);setError('');try{const r=await fetch('/api/admin/assessments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,version,action,body})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Salvare nereușită');await load();return true}catch(e){setError(e instanceof Error?e.message:'Salvare nereușită');return false}finally{setBusy(false)}}
 const visible=requests.filter(r=>all||['submitted','needs_details'].includes(r.status));
 return <section className="assessment-workspace"><AssistedJourney role="admin"/><h2>Cereri de evaluare asistată</h2><p>Răspunsul se salvează în contul clientului. Nu creează automat o rezervare, un preț acceptat sau o plată.</p><button disabled={busy} onClick={()=>void load().then(()=>setError('')).catch(e=>setError(e.message))}>Actualizează</button><label className="assessment-closed-filter"><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/>Include cererile închise</label><p className="booking-muted">Maximum 200 de cereri, cu prioritate pentru cele deschise.</p>{error&&<p role="alert">{error}</p>}{!loaded&&!error&&<p>Se încarcă…</p>}{loaded&&!visible.length&&<p>Nicio cerere în selecția curentă.</p>}{visible.map(r=><div key={r.id}><AssessmentThread admin request={r} busy={busy} onAction={action}/><AssessmentEvidence id={r.id} admin/><AdminManualEstimate id={r.id} assessmentVersion={r.version}/></div>)}</section>
}
