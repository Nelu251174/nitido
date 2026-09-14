'use client';
import {useRef,useState} from 'react';
import type {PayoutReport} from '@/lib/payoutReconciliation';

const issues:Record<string,string>={
 MANUAL_PAYOUT_REQUIRES_EXTERNAL_RECONCILIATION:'Virament manual: este necesară reconciliere externă.',
 PROVIDER_RECONCILIATION_NOT_READY:'Stripe nu a finalizat asocierea tranzacțiilor.',
 PAYOUT_NOT_PAID:'Viramentul nu este confirmat ca plătit.',
 UNSUPPORTED_CURRENCY:'Moneda necesită verificare separată.',
 NO_BALANCE_TRANSACTIONS:'Nu sunt disponibile tranzacțiile viramentului.',
 TOTAL_MISMATCH:'Totalul tranzacțiilor diferă de valoarea viramentului.',
 UNRESOLVED_LINES:'Există tranzacții care necesită verificare.',
 LOCAL_STATE_CHANGED:'Datele locale s-au schimbat în timpul verificării.',
};
export function PayoutReconciliation({accountId,payoutId}:{accountId:string;payoutId:string}){
 const lock=useRef(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[report,setReport]=useState<PayoutReport|null>(null);
 async function check(previous=false){
   if(lock.current)return;lock.current=true;setBusy(true);setError('');setReport(null);
   try{
     const res=previous?await fetch(`/api/admin/payout-reconciliation?${new URLSearchParams({accountId,payoutId})}`,{cache:'no-store'}):await fetch('/api/admin/payout-reconciliation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId,payoutId}),cache:'no-store'});
     const data=await res.json();
     if(!res.ok)throw Error(data.error??'Verificarea nu a reușit.');
     setReport(data.report);
     if(!data.report)setError('Nu există încă un raport pentru acest virament.');
   }catch(e){setError(e instanceof Error?e.message:'Conexiunea s-a întrerupt. Reîncearcă.');}
   finally{lock.current=false;setBusy(false);}
 }
 return <div className="space-y-2 min-w-48"><button disabled={busy} onClick={()=>void check()} className="border rounded-lg px-3 py-2 disabled:opacity-50">{busy?'Se verifică…':'Reconciliază în sandbox'}</button>
 <button disabled={busy} onClick={()=>void check(true)} className="block underline py-2 disabled:opacity-50">Ultimul raport salvat</button>
 {error&&<p role="alert" className="text-coral">{error}</p>}
 {report&&<div role="status"><p className="font-semibold">{report.status==='matched'?'Sume și lucrări asociate':'Necesită verificare'}</p><p className="text-muted">Verificare sandbox · {new Date(report.checkedAt).toLocaleString('ro-RO')}</p>
 {report.differenceMinor!==null&&<p>Diferență: {(report.differenceMinor/100).toFixed(2)} RON</p>}
 {report.issues.map(issue=><p key={issue}>{issues[issue]??'Verificare financiară necesară.'}</p>)}
 <details><summary className="cursor-pointer py-2">Tranzacții ({report.lines.length})</summary><ul className="space-y-2">{report.lines.map(line=><li key={line.balanceId} className="break-all">{line.jobId??'Lucrare neasociată'} · {(line.netMinor/100).toFixed(2)} RON<br/>{line.balanceId}{line.issue&&<p className="text-coral">Necesită verificare: {line.issue}</p>}</li>)}</ul></details>
 <p className="text-muted break-all">Raport: {report.id}</p></div>}
 </div>;
}
