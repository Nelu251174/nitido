'use client';
import {useEffect,useState} from 'react';
import type {Tariff,SimulationRow} from '@/lib/managedPricingStore';
import type {PriceDefinition,PriceScope,PriceRule} from '@/lib/managedPricing';
import type {SpaceType} from '@/lib/pricing';

const spaces:[SpaceType,string][]=[['apartament','Apartament'],['casa','Casă / vilă'],['birou','Birou'],['altul','Alt spațiu']];
const money=(bani:number)=>new Intl.NumberFormat('ro-RO',{style:'currency',currency:'RON'}).format(bani/100);
const statusLabel={draft:'În pregătire',published:'Publicat în registru',withdrawn:'Retras'};
type Simulation={simulationId:string;revision:number;results:SimulationRow[]};
type Form={label:string;scope:PriceScope;definition:PriceDefinition};
const formOf=(t:Tariff):Form=>({label:t.label,scope:t.scope,definition:t.definition});
const displayedDate=(value:string|null)=>value?new Intl.DateTimeFormat('ro-RO',{timeZone:'Europe/Bucharest',dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'fără termen';
export function AdminPricing(){
  const [tariffs,setTariffs]=useState<Tariff[]>([]),[selected,setSelected]=useState(''),[form,setForm]=useState<Form|null>(null);
  const [bookingActivation,setBookingActivation]=useState(false);
  const [busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [simulation,setSimulation]=useState<Simulation|null>(null),[reviewed,setReviewed]=useState(false);
  const [from,setFrom]=useState(''),[until,setUntil]=useState(''),[reason,setReason]=useState('');
  const current=tariffs.find(t=>t.id===selected),dirty=!!current&&JSON.stringify(form)!==JSON.stringify(formOf(current));
  function select(t:Tariff){setSelected(t.id);setForm(formOf(t));setSimulation(null);setReviewed(false);setError('');setMessage('');setFrom('');setUntil('');setReason('');}
  useEffect(()=>{let active=true;fetch('/api/admin/pricing',{cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error);return data;}).then(data=>{if(active){setTariffs(data.tariffs);setBookingActivation(data.bookingActivation===true);if(data.tariffs[0])select(data.tariffs[0]);setLoaded(true);}}).catch(e=>{if(active){setError(e.message);setLoaded(true);}});return()=>{active=false;};},[]);
  async function action(payload:Record<string,unknown>){
    if(busy)return;setBusy(true);setError('');setMessage('');
    try{
      const r=await fetch('/api/admin/pricing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await r.json();if(!r.ok)throw Error(data.error||'Operațiune nereușită.');setTariffs(data.tariffs);setBookingActivation(data.bookingActivation===true);
      if(payload.action==='simulate'){setSimulation(data.result);setReviewed(false);setMessage('Comparația folosește versiunea salvată. Verifică diferențele înainte de publicare.');}
      else{select(data.result);setMessage(payload.action==='publish'?(data.bookingActivation?'Versiunea este publicată pentru ofertele de test din sandbox.':'Versiunea este publicată în registru. Activarea pentru rezervări rămâne separată.'):payload.action==='withdraw'?'Versiunea a fost retrasă din calculele viitoare ale motorului. Istoricul este păstrat.':'Versiunea a fost salvată.');}
    }catch(e){setError(e instanceof Error?e.message:'Operațiune nereușită.');}finally{setBusy(false);}
  }
  function patch(value:Partial<Form>){setForm(f=>f?{...f,...value}:f);setSimulation(null);setReviewed(false);setMessage('');}
  function rule(space:SpaceType,value:PriceRule){if(form)patch({definition:{...form.definition,rules:{...form.definition.rules,[space]:value}}});}
  function scopeKind(kind:PriceScope['kind']){patch({scope:kind==='national'?{kind}:kind==='city'?{kind,city:''}:kind==='zone'?{kind,city:'',zone:''}:{kind,contractId:''}});}
  const numeric=(label:string,value:number,onChange:(n:number)=>void,min=0,max=100000000)=><label>{label}<input required type="number" step="1" min={min} max={max} value={Number.isFinite(value)?value:''} onChange={e=>onChange(e.target.value===''?NaN:Number(e.target.value))}/></label>;
  return <section className="design-panel admin-service-catalog" aria-labelledby="pricing-admin-title">
    <h2 id="pricing-admin-title">Tarife administrabile și simulator</h2>
    <p>Pregătește tarifele, compară rezultatele cu prețurile actuale și publică o versiune cu perioadă clară. Versiunile publicate sunt păstrate în istoric și se modifică printr-o copie nouă.</p>
    <p className="booking-muted">{bookingActivation?<><strong>Testare în sandbox:</strong> tarifele publicate sunt folosite pentru oferte și rezervări de test. Estimatorul public rămâne orientativ.</>:<><strong>Mod de pregătire:</strong> acest registru nu modifică încă prețurile din rezervări, estimator sau plăți. Activarea pentru clienți se face după validarea sandboxului.</>}</p>
    {error&&<p role="alert">{error} Dacă alt administrator a modificat versiunea, reîncarcă pagina pentru datele actuale.</p>}{message&&<p role="status">{message}</p>}
    {!loaded&&<p>Se încarcă versiunile…</p>}
    <div className="catalog-actions"><button type="button" disabled={busy||dirty||!loaded} onClick={()=>void action({action:'create',label:'Tarif nou — baza actuală'})}>Creează din tariful actual</button>{current&&<button type="button" disabled={busy||dirty} onClick={()=>void action({action:'create',sourceId:current.id,label:`Copie ${current.label}`.slice(0,120)})}>Copiază versiunea selectată</button>}</div>
    {loaded&&!tariffs.length&&<p>Nu există versiuni configurate. Prima versiune reproduce prețurile actuale, inclusiv pragurile apartamentelor și geamurile.</p>}
    {!!tariffs.length&&<label>Versiune<select disabled={busy||dirty} value={selected} onChange={e=>{const t=tariffs.find(t=>t.id===e.target.value);if(t)select(t);}}>{tariffs.map(t=><option key={t.id} value={t.id}>{t.label} · v{t.revision} · {statusLabel[t.status]}</option>)}</select></label>}
    {current&&form&&<>
      <p>{statusLabel[current.status]} · revizia {current.revision}. {current.valid_from&&<>Valabilitate în ora României: {displayedDate(current.valid_from)} — {displayedDate(current.valid_until)}.</>}</p>
      <form onSubmit={e=>{e.preventDefault();void action({action:'save',id:current.id,revision:current.revision,...form});}}>
        <fieldset disabled={busy||current.status!=='draft'}>
          <label>Denumire<input required maxLength={120} value={form.label} onChange={e=>patch({label:e.target.value})}/></label>
          <div className="booking-fields"><label>Arie de aplicare<select value={form.scope.kind} onChange={e=>scopeKind(e.target.value as PriceScope['kind'])}><option value="national">Național</option><option value="city">Localitate</option><option value="zone">Zonă din localitate</option><option value="contract">Contract Pro</option></select></label>
          {'city' in form.scope&&<label>Localitate<input required maxLength={120} value={form.scope.city} onChange={e=>patch({scope:{...form.scope,city:e.target.value} as PriceScope})}/></label>}
          {form.scope.kind==='zone'&&<label>Zonă<input required maxLength={120} value={form.scope.zone} onChange={e=>patch({scope:{...form.scope,zone:e.target.value} as PriceScope})}/></label>}
          {form.scope.kind==='contract'&&<label>Identificator contract Pro<input required maxLength={120} value={form.scope.contractId} onChange={e=>patch({scope:{kind:'contract',contractId:e.target.value}})}/></label>}</div>
          <p className="booking-muted">Prioritate: contract Pro, zonă, localitate, național. Două versiuni pentru aceeași arie nu pot avea perioade suprapuse. Identificatorul contractului trebuie legat de un contract valid înainte de activarea la rezervare.</p>
          {spaces.map(([key,label])=>{const r=form.definition.rules[key];return <fieldset key={key}><legend>{label}</legend>
            <label>Metodă principală<select value={r.method} onChange={e=>{const method=e.target.value as PriceRule['method'];rule(key,method==='manual'?{method}:method==='package'?{method,tiers:[{maxSqm:100,amountBani:65000}],overflowRateBani:650}:{method,rateBani:500,minimumBani:25000});}}><option value="package">Pachet pe praguri de suprafață</option><option value="sqm">Preț pe m²</option><option value="hour">Preț pe oră</option><option value="manual">Ofertă manuală</option></select></label>
            {r.method==='package'&&<>{r.tiers.map((t,i)=><div className="booking-fields" key={i}>{numeric(`Pragul ${i+1}: până la m²`,t.maxSqm,n=>rule(key,{...r,tiers:r.tiers.map((x,j)=>i===j?{...x,maxSqm:n}:x)}),1,1000)}{numeric(`Pragul ${i+1}: preț în bani`,t.amountBani,n=>rule(key,{...r,tiers:r.tiers.map((x,j)=>i===j?{...x,amountBani:n}:x)}),1)}<button type="button" disabled={r.tiers.length===1} onClick={()=>rule(key,{...r,tiers:r.tiers.filter((_,j)=>j!==i)})}>Elimină pragul {i+1}</button></div>)}<button type="button" disabled={r.tiers.length>=12||r.tiers[r.tiers.length-1].maxSqm>=1000} onClick={()=>{const last=r.tiers[r.tiers.length-1];rule(key,{...r,tiers:[...r.tiers,{maxSqm:Math.min(1000,last.maxSqm+20),amountBani:last.amountBani}]});}}>Adaugă prag</button>{numeric('Peste ultimul prag: bani/m²',r.overflowRateBani,n=>rule(key,{...r,overflowRateBani:n}),1)}</>}
            {(r.method==='sqm'||r.method==='hour')&&<div className="booking-fields">{numeric(r.method==='sqm'?'Tarif în bani/m²':'Tarif în bani/oră',r.rateBani,n=>rule(key,{...r,rateBani:n}),1)}{numeric('Preț minim în bani',r.minimumBani,n=>rule(key,{...r,minimumBani:n}))}</div>}
            {r.method==='manual'&&<p>Motorul va cere ofertă manuală. Nu va inventa un total și nu va permite confirmarea automată.</p>}
          </fieldset>;})}
          {numeric('Geamuri: tarif în bani/m²',form.definition.windowsRateBani,n=>patch({definition:{...form.definition,windowsRateBani:n}}))}
          <p className="booking-muted">100 bani = 1 leu. Prețul curățeniei păstrează rotunjirea actuală la leu; geamurile sunt adăugate separat. Nu se introduc cote TVA sau schimbări de comision.</p>
          <div className="catalog-actions"><button className="design-button" type="submit" disabled={!dirty}>Salvează revizia</button><button type="button" disabled={!dirty} onClick={()=>select(current)}>Anulează editarea</button></div>
        </fieldset>
      </form>
      {current.status==='draft'&&<><button type="button" className="design-button" disabled={busy||dirty} onClick={()=>void action({action:'simulate',id:current.id,revision:current.revision})}>Simulează versiunea salvată</button>
        {simulation&&<><h3>Comparație cu tariful actual</h3><p>{simulation.results.length} scenarii. Pentru tarifele orare, scenariile folosesc 2 ore; comparația nu presupune că durata serviciului este aceeași.</p><div style={{overflowX:'auto',maxHeight:400}} tabIndex={0} role="region" aria-label="Rezultatele simulării"><table><thead><tr><th>Spațiu</th><th>m²</th><th>Geamuri m²</th><th>Actual</th><th>Propus</th><th>Diferență</th></tr></thead><tbody>{simulation.results.map((r,i)=><tr key={i}><td>{spaces.find(([key])=>key===r.spaceType)?.[1]}</td><td>{r.sqm}</td><td>{r.windowsSqm}</td><td>{money(r.legacyBani)}</td><td>{r.proposedBani===null?r.note:money(r.proposedBani)}</td><td>{r.deltaBani===null?'—':money(r.deltaBani)}</td></tr>)}</tbody></table></div>
          <form onSubmit={e=>{e.preventDefault();void action({action:'publish',id:current.id,revision:current.revision,simulationId:simulation.simulationId,from,until:until||null});}}><fieldset disabled={busy||dirty}>
            <p>Introdu date cu fus explicit, de exemplu 2026-10-01T09:00:00+03:00. Pentru iarna din România folosește +02:00. Intervalul include începutul și exclude sfârșitul.</p>
            <label>Valabil de la<input required type="text" placeholder="2026-10-01T09:00:00+03:00" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Valabil până la, opțional<input type="text" value={until} onChange={e=>setUntil(e.target.value)}/></label>
            <label><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>Am verificat comparația, aria și perioada de valabilitate.</label><button className="design-button" disabled={!reviewed} type="submit">Publică în registrul de tarife</button>
          </fieldset></form></>}
      </>}
      {current.status==='published'&&<form onSubmit={e=>{e.preventDefault();void action({action:'withdraw',id:current.id,revision:current.revision,reason});}}><fieldset disabled={busy}><label>Motivul retragerii<input required maxLength={120} value={reason} onChange={e=>setReason(e.target.value)}/></label><p>Retragerea oprește folosirea versiunii pentru calcule noi în motor. Istoricul și comenzile existente se păstrează.</p><button type="submit">Retrage versiunea</button></fieldset></form>}
    </>}
  </section>;
}
