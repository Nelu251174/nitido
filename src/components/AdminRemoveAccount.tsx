'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import styles from './AdminRemoveAccount.module.css';
import {createPortal} from 'react-dom';
export function AdminRemoveAccount({kind,targetId,name,disabled=false,onRemoved}:{kind:'firm'|'client';targetId:string;name:string;disabled?:boolean;onRemoved:()=>void}){
 const [open,setOpen]=useState(false),[confirmation,setConfirmation]=useState(''),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null),sending=useRef(false);
 useEffect(()=>{if(open){dialog.current?.showModal();input.current?.focus();}else dialog.current?.close();},[open]);
 async function remove(event:FormEvent){
  event.preventDefault();if(sending.current||confirmation.trim()!==name.trim()||reason.trim().length<3)return;
  sending.current=true;setBusy(true);setError('');
  try{
   const response=await fetch('/api/admin/account-removal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,targetId,confirmName:confirmation,reason})});
   const data=await response.json().catch(()=>null);if(!response.ok||!data?.removed)throw Error(data?.error??'Ștergerea nu a fost confirmată.');
   setOpen(false);onRemoved();
  }catch(cause){setError(cause instanceof Error?cause.message:'Ștergerea nu a fost confirmată.');}finally{sending.current=false;setBusy(false);}
 }
 return <><button type="button" className={styles.trigger} disabled={disabled} aria-label={`Șterge ${name}`} onClick={()=>{setConfirmation('');setReason('');setError('');setOpen(true);}}>Șterge</button>
 {open&&createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby={`remove-${targetId}`} onCancel={event=>{if(busy)event.preventDefault();else setOpen(false);}} onClose={()=>setOpen(false)}>
  <form onSubmit={event=>void remove(event)}>
   <p className={styles.eyebrow}>{kind==='firm'?'Firmă de curățenie':'Cont client'}</p><h2 id={`remove-${targetId}`}>Ștergi acest cont?</h2>
   <div className={styles.identity}><strong>{name}</strong><small>Referință: {targetId}</small></div>
   <p>Contul va dispărea din liste și nu se va mai putea autentifica. Istoricul lucrărilor, documentelor și plăților se păstrează.</p>
   <p className={styles.notice}>Lucrările în desfășurare, planurile recurente active și plățile în curs trebuie soluționate înainte de ștergere.</p>
   <label>Scrie numele exact pentru confirmare<input ref={input} value={confirmation} onChange={event=>setConfirmation(event.target.value)} maxLength={200} disabled={busy} autoComplete="off" spellCheck={false}/></label>
   <label>Motivul ștergerii<textarea value={reason} onChange={event=>setReason(event.target.value)} minLength={3} maxLength={1000} rows={2} disabled={busy} placeholder="De exemplu: cont de test"/></label>
   {error&&<p role="alert" className={styles.error}>{error}</p>}
   <div className={styles.actions}><button type="button" className={styles.cancel} disabled={busy} onClick={()=>setOpen(false)}>Renunță</button><button type="submit" className={styles.confirm} disabled={busy||confirmation.trim()!==name.trim()||reason.trim().length<3}>{busy?'Se șterge…':'Șterge contul'}</button></div>
  </form>
 </dialog>,document.body)}</>;
}
