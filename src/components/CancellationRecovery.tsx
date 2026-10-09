"use client";
import {useRef,useState} from 'react';

export function CancellationRecovery({jobId,onRecovered}:{jobId:string;onRecovered:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');const running=useRef(false);
 async function retry(){
   if(running.current)return;running.current=true;setBusy(true);setMessage('');
   try{
     const response=await fetch('/api/admin/payment-cancellation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobId})});
     const data=await response.json();
     if(!response.ok){setMessage(data.error??'Verificarea nu a reușit.');return;}
     if(data.status==='processed')await onRecovered();
     else setMessage('Autorizarea nu este încă identificată. Este necesară reconcilierea în Stripe.');
   }catch{setMessage('Răspuns neconfirmat. Reîncarcă starea înainte de a reîncerca.');}
   finally{running.current=false;setBusy(false);}
 }
 return <><button className="underline disabled:opacity-50" disabled={busy} onClick={retry}>{busy?'Se verifică…':'Reîncearcă eliberarea în sandbox'}</button>{message&&<p role="status" className="text-sm">{message}</p>}</>;
}
