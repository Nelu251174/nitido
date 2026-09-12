'use client';
import Image from 'next/image';
import {useRef,useState} from 'react';
import type {JobRow} from '@/lib/types';
export function FirmProofActions({job,onRefresh}:{job:JobRow;onRefresh:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState<string|null>(null),[failed,setFailed]=useState(false);
 const lock=useRef(false);
 const arrival=job.proofs?.filter(p=>p.type==='ARRIVAL')??[],completion=job.proofs?.filter(p=>p.type==='COMPLETION')??[];
 async function run(action:'upload'|'arrived'|'complete',file?:File,type?:'ARRIVAL'|'COMPLETION'){
  if(lock.current)return;lock.current=true;setBusy(true);setMessage(null);setFailed(false);
  try{
   let body:FormData|undefined;
   if(action==='upload'){if(!file||!type)return;body=new FormData();body.set('file',file);body.set('jobId',job.id);body.set('proofType',type)}
   const r=await fetch(action==='upload'?'/api/uploads':`/api/jobs/${encodeURIComponent(job.id)}/${action}`,{method:'POST',body});const d=await r.json();
   if(!r.ok)throw new Error(d.error??'Operațiunea nu a putut fi confirmată.');
   setMessage(action==='upload'?'Fotografia a fost încărcată.':action==='arrived'?'Sosirea este confirmată. Poți începe lucrarea.':'Finalizarea a fost confirmată. Verifică mai jos starea plății.');
  }catch(e){setFailed(true);setMessage(e instanceof Error?e.message:'Conexiune întreruptă. Verifică starea lucrării înainte să reîncerci.')}
  finally{await onRefresh();lock.current=false;setBusy(false)}
 }
 const retry=job.status==='completed'&&job.financial?.paymentStatus==='authorized';
 const payment=job.financial?.paymentStatus;
 return <section className="proof-actions" aria-label="Fotografii și încasare"><div className="proof-pair">{(['ARRIVAL','COMPLETION'] as const).map((type,index)=>{const photos=type==='ARRIVAL'?arrival:completion;const enabled=type==='ARRIVAL'?job.status==='accepted':job.status==='arrived';return <div className="proof-stage" key={type}><h3 className="font-bold">{index+1}. {type==='ARRIVAL'?'Fotografii la sosire':'Fotografii la final'}</h3><p className="text-sm text-muted mt-2">{type==='ARRIVAL'?'Fotografiază spațiul înainte să începi curățenia.':'Fotografiază rezultatul după terminarea curățeniei.'}</p><div className="proof-thumbnails">{photos.map(photo=><a key={photo.id} href={photo.url} target="_blank" rel="noreferrer"><Image unoptimized src={photo.url} alt={type==='ARRIVAL'?'Dovadă la sosire':'Dovadă la final'} width={100} height={80}/></a>)}</div><p className="text-sm mb-3">{photos.length?`${photos.length} fotografii încărcate`:'Nicio fotografie încărcată'}</p><label className={`v2-btn v2-btn-secondary ${busy||!enabled?'opacity-50':''}`}>{type==='ARRIVAL'?'Încarcă poze la sosire':'Încarcă poze la final'}<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy||!enabled} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void run('upload',file,type)}}/></label>{type==='COMPLETION'&&job.status==='accepted'&&<p className="text-xs mt-2">Disponibil după confirmarea sosirii.</p>}</div>})}</div>
 {job.status==='accepted'&&<button className="v2-btn v2-btn-primary disabled:opacity-50" disabled={busy||!arrival.length} onClick={()=>void run('arrived')}>Am ajuns · Începe lucrarea</button>}
 <div className="proof-stage"><h3 className="font-bold">3. Finalizare și încasare</h3><p className="text-sm mt-2">{job.guarantee_of?'Re-curățare în garanție: fără încasare suplimentară.':payment==='authorized'?'Sumă autorizată pe card. Încasarea se solicită la finalizarea lucrării.':payment==='captured'?'Plata a fost încasată de pe card.':'Autorizarea plății nu este confirmată în datele disponibile.'}</p><p className="text-xs text-muted mt-2">Încasarea de pe card și viramentul în contul bancar al firmei sunt etape distincte.</p>{(job.status==='accepted'||job.status==='arrived'||retry)&&<button className="v2-btn v2-btn-primary mt-4 disabled:opacity-50" disabled={busy||!arrival.length||!completion.length||job.status==='accepted'} onClick={()=>void run('complete')}>{busy?'Se verifică…':retry?'Reîncearcă încasarea':job.guarantee_of?'Finalizează re-curățarea':'Finalizează lucrarea și solicită încasarea'}</button>}<p className="text-xs text-muted mt-2">Sunt necesare sosirea confirmată și fotografiile de început și de final. Serverul verifică toate condițiile.</p></div>
 {message&&<p role={failed?'alert':'status'} className={failed?'workspace-error':'workspace-notice'}>{message}</p>}
 </section>;
}
