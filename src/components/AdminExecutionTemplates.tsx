"use client";
import {useState} from 'react';
import {EXECUTION_SCOPES,type ExecutionTemplate,type ExecutionItem} from '@/lib/executionTemplatesShared';
import {inputClass} from './ui';
export function AdminExecutionTemplates(){
 const [templates,setTemplates]=useState<ExecutionTemplate[]>([]),[selected,setSelected]=useState<ExecutionTemplate|null>(null),[items,setItems]=useState<ExecutionItem[]>([]),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 function choose(t:ExecutionTemplate){setSelected(t);setItems(t.items.map(i=>({...i})));setReason('');setMessage('');}
 async function request(body?:unknown){const r=await fetch('/api/admin/execution-templates',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error);return d as {templates:ExecutionTemplate[]};}
 async function load(){if(busy)return;setBusy(true);setMessage('');try{const d=await request();setTemplates(d.templates);choose(d.templates.find(t=>t.scope===selected?.scope)??d.templates[0]);}catch(e){setMessage(e instanceof Error?e.message:'Listele nu au putut fi încărcate.');}finally{setBusy(false);}}
 async function save(){if(busy||!selected)return;setBusy(true);setMessage('');try{const d=await request({scope:selected.scope,revision:selected.revision,items,reason});setTemplates(d.templates);choose(d.templates.find(t=>t.scope===selected.scope)!);setMessage('Lista a fost publicată pentru lucrările create de acum înainte.');}catch(e){setMessage(e instanceof Error?e.message:'Salvarea nu a fost confirmată.');}finally{setBusy(false);}}
 return <section className="design-panel my-5 space-y-4" style={{background:'#f7f3ec',minWidth:0}}>
  <h2 className="text-xl font-bold">Liste de verificări pentru execuție</h2>
  <p>Definește clar ce verifică echipa înainte de finalizare. Lista publicată se copiază în fiecare lucrare nouă din serviciul ales. Lucrările existente păstrează lista anterioară, inclusiv la o revenire pentru remediere. Listele organizațiilor Pro se gestionează separat.</p>
  <button className="v2-btn v2-btn-secondary" disabled={busy} onClick={()=>void load()}>Încarcă sau reîncarcă listele</button>
  {message&&<p role="status">{message}</p>}
  {selected&&<form className="space-y-4" onSubmit={e=>{e.preventDefault();void save();}}>
   <label className="block">Flux / serviciu<select className={inputClass} disabled={busy} value={selected.scope} onChange={e=>choose(templates.find(t=>t.scope===e.target.value)!)}>{EXECUTION_SCOPES.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <p>Revizia {selected.revision}{selected.revision===0?' · lista inițială':` · publicată la ${new Date(selected.createdAt!).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest'})}`}. {selected.reason&&`Motiv: ${selected.reason}`}</p>
   <p>Toate sarcinile din listă trebuie bifate înaintea raportului. Pentru listele publicate aici, serverul verifică lista și înainte de finalizare. O sarcină imposibil de executat se raportează cu motiv din dosarul lucrării.</p>
   {items.map((item,index)=><div key={index} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_2fr_auto]" style={{background:'#fbf7ef',borderColor:'#ddd4c5'}}>
    <label>Cod sarcină<input className={inputClass} required pattern="[-a-z0-9_]{1,40}" maxLength={40} value={item.key} disabled={busy} onChange={e=>setItems(items.map((x,i)=>i===index?{...x,key:e.target.value}:x))}/></label>
    <label>Descriere pentru echipă<input className={inputClass} required maxLength={300} value={item.label} disabled={busy} onChange={e=>setItems(items.map((x,i)=>i===index?{...x,label:e.target.value}:x))}/></label>
    <button type="button" className="v2-btn v2-btn-secondary self-end" disabled={busy||items.length===1} onClick={()=>setItems(items.filter((_,i)=>i!==index))}>Elimină</button>
   </div>)}
   <button type="button" className="v2-btn v2-btn-secondary" disabled={busy||items.length>=40} onClick={()=>setItems([...items,{key:'',label:''}])}>Adaugă o sarcină</button>
   <label className="block">Motivul modificării<textarea className={inputClass} required maxLength={2000} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)}/></label>
   <button className="v2-btn v2-btn-primary" disabled={busy}>Publică lista pentru lucrările noi</button>
  </form>}
 </section>;
}
