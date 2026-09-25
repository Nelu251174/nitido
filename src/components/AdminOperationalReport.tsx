'use client';
import {useState} from 'react';
import type {OperationalReport} from '@/lib/operationalReport';
import {inputClass} from './ui';
export function AdminOperationalReport(){
 const [report,setReport]=useState<OperationalReport|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(form:HTMLFormElement){setBusy(true);setError('');setReport(null);try{const query=new URLSearchParams();new FormData(form).forEach((v,k)=>query.set(k,String(v)));const r=await fetch('/api/admin/operational-report?'+query,{cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error??'Raport indisponibil');setReport(data);}catch(e){setError(e instanceof Error?e.message:'Raport indisponibil');}finally{setBusy(false);}}
 const money=(bani:number)=>new Intl.NumberFormat('ro-RO',{style:'currency',currency:'RON'}).format(bani/100);
 return <section id="performanta" className="workspace-panel space-y-4" style={{background:'#f7f3ec',border:'1px solid #ddd4c5',borderRadius:20,padding:24,minWidth:0}}>
  <h2 className="text-xl font-bold">Performanță operațională și prestatori</h2>
  <p>Analizează lucrările create într-o perioadă și rezultatele cunoscute acum. Reclamațiile confirmate sunt separate de sesizările care încă necesită verificare. Acest raport ajută decizia operatorului; nu introduce un scor nou și nu modifică alocarea Express.</p>
  <form onSubmit={e=>{e.preventDefault();void load(e.currentTarget);}} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
   <label>De la<input className={inputClass} required type="date" name="from"/></label><label>Până la, inclusiv<input className={inputClass} required type="date" name="to"/></label>
   <label>Localitate exactă<input className={inputClass} name="city" maxLength={150} placeholder="Toate localitățile"/></label>
   <label>Mod<select className={inputClass} name="mode"><option value="">Standard și Express</option><option value="standard">Standard</option><option value="express">Express</option></select></label>
   <label>Tip spațiu<select className={inputClass} name="space"><option value="">Toate tipurile</option><option value="apartament">Apartament</option><option value="casa">Casă</option><option value="birou">Birou</option><option value="altul">Altul</option></select></label>
   <label>Identificator prestator<input className={inputClass} name="firm" maxLength={150} placeholder="Toți prestatorii"/></label><label>Identificator client<input className={inputClass} name="client" maxLength={150} placeholder="Toți clienții"/></label>
   <button className="v2-btn v2-btn-primary self-end" disabled={busy}>{busy?'Se calculează…':'Calculează raportul'}</button>
  </form>
  {error&&<p role="alert">{error}</p>}
  {report&&<>
   <p className="text-sm">{report.basis} Fus orar: România. {report.total===0?'Nu există lucrări pentru filtrele alese.':''}</p>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Lucrări',report.total],['Finalizate',report.completed],['În așteptare',report.waiting],['În execuție sau acceptate',report.active],['Anulate',report.cancelled],['No-show înregistrate',report.noShow],['Lucrări finalizate cu reclamație confirmată',report.confirmedComplaintJobs],['Lucrări cu sesizări de verificat',report.unreviewedComplaintJobs]].map(([label,value])=><div key={label} className="rounded-xl border p-4" style={{background:'#fbf7ef',borderColor:'#ddd4c5'}}><span className="block text-sm">{label}</span><strong className="text-2xl">{value}</strong></div>)}</div>
   <h3 className="font-bold">Marjă operațională documentată</h3>
   <p>{report.margin.totalBani===null?'Marja totală nu poate fi confirmată pentru această selecție.':`Marjă totală documentată: ${money(report.margin.totalBani)}.`} Subtotalul lucrărilor cu costuri confirmate este {money(report.margin.knownConfirmedBani)}: {report.margin.confirmedJobs} lucrări cu toate costurile confirmate, {report.margin.estimatedJobs} cu estimări și {report.margin.missingOrIncompleteJobs} fără costuri complete. Costurile lipsă nu sunt considerate zero. Acesta nu este profit net contabil.</p>
   <h3 className="font-bold">Provider Score — observare, fără ponderi active</h3>
   <p className="text-sm">Indicatorii de mai jos nu sunt un clasament. Sosirea se compară strict cu ora programată, numai când ambele ore există. Prezența fotografiilor valide nu certifică singură calitatea execuției. Ratele de acceptare, marja pe firmă și distribuția automată necesită date și reguli suplimentare; nu sunt deduse din ofertele pierdute.</p>
   <div className="grid gap-3 md:grid-cols-2">{report.providers.map(p=><article className="rounded-xl border p-4 min-w-0" style={{background:'#fbf7ef',borderColor:'#ddd4c5'}} key={p.id}>
    <h4 className="font-bold break-words">{p.name}</h4><p className="text-xs break-all">{p.id}</p>
    <p>{p.verified?'Verificare înregistrată':'Verificare neconfirmată'} · {p.completed} finalizate / {p.assigned} lucrări asociate</p>
    <p>Rating publicat după finalizare: {p.averageRating===null?'Date insuficiente':p.averageRating.toFixed(2)+' / 5'} · {p.ratingCount} recenzii publicate</p>
    <p>Sosiri până la ora programată: {p.arrivedByScheduled} / {p.arrivalSamples} măsurători. Dovezi de sosire și finalizare: {p.completedWithBothProofs} / {p.completed} lucrări finalizate.</p>
    <p>{p.confirmedComplaintJobs} lucrări finalizate cu reclamații confirmate · {p.unreviewedComplaintJobs} lucrări cu sesizări de verificat · {p.noShow} no-show înregistrate</p>
   </article>)}</div>
  </>}
 </section>;
}
