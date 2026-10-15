'use client';
import {useCallback,useEffect,useState} from 'react';
type Report={source:string;reportDate:string;status:string;metric:string;countries:{country:string;installs:number;redownloads?:number}[];reason?:string};
type Event={id:string;event_type:string;created_ms:number;email_status:string;read_ms:number|null;name:string|null;email:string|null;last_error:string|null;payload:{connectionCountry?:string;digestDate?:string}};
type Inbox={events:Event[];unread:number;config:{enabled:boolean;recipient:string|null;emailConfigured:boolean};reports:Report[]};
const delivery:Record<string,string>={pending:'În așteptare',sending:'Se trimite',sent:'Acceptat de serviciul de email',failed:'Trimitere nereușită',uncertain:'Necesită verificare',suppressed:'Cont indisponibil'};
export function AdminOwnerNotifications(){
 const [data,setData]=useState<Inbox|null>(null),[error,setError]=useState('');
 const refresh=useCallback(async()=>{try{const r=await fetch('/api/admin/owner-notifications',{cache:'no-store'});if(!r.ok)throw Error();setData(await r.json());setError('');}catch{setError('Alertele nu au putut fi actualizate.');}},[]);
 useEffect(()=>{void refresh();const t=setInterval(()=>{if(!document.hidden)void refresh();},15000);return()=>clearInterval(t);},[refresh]);
 async function markRead(){if(!data)return;try{const r=await fetch('/api/admin/owner-notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:data.events.filter(e=>!e.read_ms).map(e=>e.id)})});if(!r.ok)throw Error();await refresh();}catch{setError('Marcarea alertelor nu a fost confirmată.');}}
 return <section id="inscrieri" className="my-6 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900">
  <h2 className="text-xl font-semibold">Înregistrări și descărcări — {data?.unread??'…'} alerte necitite</h2>
  <p className="text-sm text-slate-600">Conturi noi din orice țară. Țara conexiunii este o estimare; nu indică naționalitatea sau sediul firmei.</p>
  {error&&<p role="alert">{error}</p>}
  {data&&<>
   <p className="my-2 text-sm">Email: {data.config.enabled&&data.config.emailConfigured&&data.config.recipient?data.config.recipient:'neactivat / configurare incompletă'}</p>
   <button type="button" className="my-2 rounded border px-3 py-2" onClick={()=>void markRead()}>Marchează alertele afișate ca citite</button>
   <div className="max-h-96 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>Data</th><th>Eveniment</th><th>Țara conexiunii</th><th>Email</th></tr></thead><tbody>
    {data.events.map(e=><tr key={e.id} className={e.read_ms?'border-t':'border-t font-semibold'}><td className="py-3">{new Date(e.created_ms).toLocaleString('ro-RO')}</td><td>{e.event_type==='CLIENT_REGISTERED'?'Client nou':e.event_type==='FIRM_REGISTERED'?'Firmă nouă (cont creat)':e.event_type==='DAILY_DOWNLOAD_REPORT'?'Raport descărcări '+e.payload.digestDate:'Verificare alerte'}<div>{e.name} {e.email}</div></td><td>{e.payload.connectionCountry??'—'}</td><td>{delivery[e.email_status]??e.email_status}{e.last_error&&<div>{e.last_error}</div>}</td></tr>)}
   </tbody></table>{!data.events.length&&<p className="py-3">Nicio alertă nouă de la activarea acestei funcții.</p>}</div>
   <h3 className="mt-5 font-semibold">Rapoarte oficiale pe țări</h3>
   <p className="text-sm">Datele magazinelor pot întârzia. Datele lipsă nu sunt zero descărcări. Apple raportează unități de aplicație; Google raportează instalări, fără a identifica persoanele.</p>
   {!data.reports.length&&<p className="mt-2">Nu a fost importat niciun raport oficial. Accesul Apple Sales &amp; Trends și Google Play Statistics trebuie configurat separat.</p>}
   <div className="grid gap-3 md:grid-cols-2">{data.reports.map(r=><details key={r.source+r.reportDate} className="mt-2 rounded border p-3"><summary>{r.source==='apple'?'Apple App Store':'Google Play'} · {r.reportDate} · {r.status==='ready'?'Disponibil':r.status==='pending'?'În așteptare':'Acces indisponibil'}</summary>{r.status!=='ready'?<p>{r.reason}</p>:<><p>{r.metric==='app_units'?'Țară: descărcări inițiale / redescărcări':r.metric==='device_installs'?'Țară: instalări pe dispozitive':'Țară: evenimente de instalare'}</p>{r.countries.length?r.countries.map(c=><p key={c.country}>{c.country}: {c.installs}{r.metric==='app_units'?' / '+(c.redownloads??0):''}</p>):<p>0 unități raportate.</p>}</>}</details>)}</div>
  </>}
 </section>;
}
