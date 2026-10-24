'use client';
import { useRef,useState } from 'react';
import { Card,inputClass } from './ui';
import { MARKETING_REGIONS } from '@/lib/adminMarketingRegions';
import { marketingCsvBatches,marketingFileText } from '@/lib/adminMarketingCsvStream';
import type { MarketingInput } from '@/lib/adminMarketingShared';
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export function AdminMarketingCsvImport({onSaved}:{onSaved:()=>void}){
 const [file,setFile]=useState<File|null>(null),[county,setCounty]=useState('CT'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[preview,setPreview]=useState<{total:number;sample:MarketingInput[]}|null>(null);
 const cancel=useRef(false),lastRequest=useRef(0);
 async function request(path:string,body:unknown){
  for(let attempt=0;attempt<4;attempt++){
   if(cancel.current)throw Error('Importul a fost oprit. Loturile deja salvate rămân disponibile; reluarea omite duplicatele.');
   await pause(Math.max(0,2300-(Date.now()-lastRequest.current)));lastRequest.current=Date.now();
   const response=await fetch('/api/admin/marketing/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   if(response.status===429){setMessage('Se așteaptă reînnoirea limitei de cereri. Importul continuă automat.');await pause(60000);continue;}
   const data=await response.json();if(!response.ok)throw Error(data.error??'Importul nu a reușit.');return data;
  }throw Error('Limita de cereri este încă activă. Reia importul; duplicatele sunt omise.');
 }
 async function process(save:boolean){
  if(!file||busy)return;setBusy(true);setError('');cancel.current=false;let total=0,created=0,duplicates=0;const sample:MarketingInput[]=[];
  try{
   for await(const csv of marketingCsvBatches(marketingFileText(file))){
    const result=await request('collect',{source:'csv',csv,county});total+=result.contacts.length;
    if(save){for(let offset=0;offset<result.contacts.length;){const contacts:MarketingInput[]=[];let size=0;while(offset<result.contacts.length&&contacts.length<200){const row=result.contacts[offset],n=new TextEncoder().encode(JSON.stringify(row)).length;if(contacts.length&&size+n>400000)break;contacts.push(row);size+=n;offset++;}const saved=await request('contacts',{contacts});created+=saved.created;duplicates+=saved.duplicates;}}
    else if(sample.length<25)sample.push(...result.contacts.slice(0,25-sample.length));
    setMessage(save?`${total.toLocaleString('ro-RO')} procesate · ${created} salvate · ${duplicates} duplicate.`:`${total.toLocaleString('ro-RO')} contacte validate pentru import…`);
   }
   if(save){setPreview(null);setMessage(`Import finalizat: ${created.toLocaleString('ro-RO')} contacte salvate, ${duplicates.toLocaleString('ro-RO')} duplicate. Trimiterea emailurilor este oprită.`);onSaved();}
   else{setPreview({total,sample});setMessage(`Fișier verificat: ${total.toLocaleString('ro-RO')} contacte. Previzualizarea arată primele 25.`);}
  }catch(e){setError((e as Error).message);if(save)onSaved();}finally{setBusy(false);}
 }
 return <Card><h3 className="text-xl font-bold">Import CSV de volum mare</h3><p className="my-3 text-sm">Fără plafon total de contacte. Fișierul este citit treptat și împărțit automat în loturi de maximum 200, cu progres vizibil. Coloana county stabilește județul fiecărui rând; pentru rândurile fără județ se folosește selecția de mai jos. Verificarea fișierului validează structura datelor; verificarea sursei publice și a domeniului email este separată.</p>
 <div className="grid gap-3 sm:grid-cols-2"><label>Județ pentru rândurile fără county<select className={inputClass} disabled={busy} value={county} onChange={e=>{setCounty(e.target.value);setPreview(null);}}>{MARKETING_REGIONS.map(r=><option key={r.code} value={r.code}>{r.name}</option>)}</select></label><label>Fișier CSV<input className={inputClass} type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>{setFile(e.target.files?.[0]??null);setPreview(null);setError('');setMessage('');}}/></label></div>
 {message&&<p role="status" className="my-3">{message}</p>}{error&&<p role="alert" className="my-3 text-red-700">{error}</p>}
 {preview&&<div className="my-3 overflow-auto"><table className="w-full text-sm text-left"><thead><tr><th>Nume</th><th>Județ</th><th>Localitate</th><th>Email</th></tr></thead><tbody>{preview.sample.map((r,i)=><tr key={i}><td className="p-2">{r.name}</td><td>{r.county}</td><td>{r.city}</td><td>{r.email}</td></tr>)}</tbody></table></div>}
 <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={!file||busy} className="v2-btn v2-btn-secondary" onClick={()=>void process(false)}>Verifică fișierul complet</button>{preview&&<button type="button" disabled={busy} className="v2-btn v2-btn-primary" onClick={()=>void process(true)}>Importă toate cele {preview.total.toLocaleString('ro-RO')} contacte</button>}{busy&&<button type="button" className="v2-btn v2-btn-secondary" onClick={()=>{cancel.current=true;}}>Oprește după lotul curent</button>}</div></Card>;
}
