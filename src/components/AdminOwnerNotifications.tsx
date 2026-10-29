'use client';
import {useCallback,useEffect,useState} from 'react';
import styles from './AdminOwnerNotifications.module.css';
type Report={source:string;reportDate:string;status:string;metric:string;countries:{country:string;installs:number;redownloads?:number}[];reason?:string};
type Event={id:string;event_type:string;created_ms:number;email_status:string;read_ms:number|null;name:string|null;email:string|null;accountType:string|null;last_error:string|null;payload:{connectionCountry?:string;digestDate?:string}};
type Inbox={events:Event[];unread:number;config:{enabled:boolean;recipient:string|null;emailConfigured:boolean};reports:Report[]};
const delivery:Record<string,string>={pending:'În așteptare',sending:'Se trimite',sent:'Acceptat',failed:'Eșuat',uncertain:'De verificat',suppressed:'Indisponibil'};
const dateFormat=new Intl.DateTimeFormat('ro-RO',{timeZone:'Europe/Bucharest',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
function eventName(e:Event){return e.name||(e.event_type==='DAILY_DOWNLOAD_REPORT'?'Raport descărcări '+e.payload.digestDate:e.event_type==='SYSTEM_TEST'?'Verificare alerte':'Cont indisponibil');}
export function AdminOwnerNotifications(){
 const [data,setData]=useState<Inbox|null>(null),[error,setError]=useState('');
 const refresh=useCallback(async()=>{try{const r=await fetch('/api/admin/owner-notifications',{cache:'no-store'});if(!r.ok)throw Error();setData(await r.json());setError('');}catch{setError('Alertele nu au putut fi actualizate.');}},[]);
 useEffect(()=>{const first=setTimeout(()=>void refresh(),0);const t=setInterval(()=>{if(!document.hidden)void refresh();},15000);const changed=()=>void refresh();window.addEventListener('nitido-admin-alerts-updated',changed);return()=>{clearTimeout(first);clearInterval(t);window.removeEventListener('nitido-admin-alerts-updated',changed);};},[refresh]);
 async function markRead(){if(!data)return;try{const r=await fetch('/api/admin/owner-notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:data.events.filter(e=>!e.read_ms).map(e=>e.id)})});if(!r.ok)throw Error();await refresh();window.dispatchEvent(new CustomEvent('nitido-admin-alerts-updated',{detail:'owner'}));}catch{setError('Marcarea alertelor nu a fost confirmată.');}}
 return <section id="inscrieri" className={styles.panel}>
  <div className={styles.header}>
   <div><div className={styles.titleRow}><h2>Înregistrări și descărcări</h2><span className={styles.count}>{data?`${data.unread} necitite`:'Se încarcă…'}</span></div><p className={styles.subtitle}>Clienți privați, clienți comerciali și firme de curățenie.</p></div>
   {data&&<div className={styles.recipient}>Email: <strong>{data.config.enabled&&data.config.emailConfigured&&data.config.recipient?data.config.recipient:'neactivat / configurare incompletă'}</strong></div>}
  </div>
  {error&&<p role="alert" className={styles.error}>{error}</p>}
  {data&&<>
   <div className={styles.toolbar}><p>Țara indică locația estimată a conexiunii.</p><button type="button" className={styles.readButton} disabled={!data.unread} onClick={()=>void markRead()}>Marchează toate ca citite</button></div>
   <div className={styles.tableViewport} tabIndex={0} role="region" aria-label="Înregistrări — tabel derulabil">
    <table className={styles.table}><caption className={styles.srOnly}>Înregistrări noi și starea notificărilor prin email. Orele sunt afișate pentru România.</caption><thead><tr><th>Data · ora</th><th>Nume / eveniment</th><th>Email</th><th>Tip cont</th><th>Țară</th><th>Stare email</th><th><span className={styles.srOnly}>Acțiuni</span></th></tr></thead><tbody>
     {data.events.map(e=><tr key={e.id}><td className={styles.date}><time dateTime={new Date(e.created_ms).toISOString()}>{dateFormat.format(e.created_ms)}</time></td><td className={styles.name}>{!e.read_ms&&<span className={styles.unreadDot} aria-label="Necitit"/>}{eventName(e)}</td><td>{e.email?<a className={styles.email} href={'mailto:'+e.email}>{e.email}</a>:<span className={styles.muted}>—</span>}</td><td>{e.accountType?<span className={styles.account}>{e.accountType}</span>:<span className={styles.muted}>—</span>}</td><td><span className={styles.country}>{e.payload.connectionCountry??'—'}</span></td><td><span className={`${styles.status} ${e.email_status==='sent'?styles.accepted:['failed','uncertain'].includes(e.email_status)?styles.attention:styles.pending}`} title={e.last_error|| (e.email_status==='sent'?'Acceptat de serviciul de email; primirea în căsuța destinatarului nu este confirmată.':undefined)}>{delivery[e.email_status]??e.email_status}</span></td><td>{e.accountType&&<a className={styles.openLink} href={e.event_type==='FIRM_REGISTERED'?'/admin#firme':'/admin#clienti'} aria-label={e.event_type==='FIRM_REGISTERED'?'Vezi firmele':'Vezi clienții'}>Deschide <svg aria-hidden="true" width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 12 12 4M4 4h8v8"/></svg></a>}</td></tr>)}
     {!data.events.length&&<tr><td colSpan={7} className={styles.empty}>Nicio alertă de la activarea acestei funcții.</td></tr>}
    </tbody></table>
   </div>
   <p className={styles.mobileHint}>Glisează tabelul pentru toate coloanele.</p>
   <details className={styles.reports}><summary><span>Rapoarte oficiale de descărcări</span><span className={styles.reportCount}>{data.reports.length?`${data.reports.length} rapoarte`:'Niciun raport importat'}</span></summary>
    <div className={styles.reportBody}><p>Datele magazinelor pot întârzia. Datele lipsă nu sunt zero descărcări. Apple raportează unități de aplicație; Google raportează instalări, fără a identifica persoanele.</p>
     {!data.reports.length&&<p>Accesul Apple Sales &amp; Trends și Google Play Statistics trebuie configurat separat.</p>}
     <div className={styles.reportGrid}>{data.reports.map(r=><details key={r.source+r.reportDate} className={styles.reportCard}><summary>{r.source==='apple'?'Apple App Store':'Google Play'} · {r.reportDate} · {r.status==='ready'?'Disponibil':r.status==='pending'?'În așteptare':'Acces indisponibil'}</summary>{r.status!=='ready'?<p>{r.reason}</p>:<><p>{r.metric==='app_units'?'Țară: descărcări inițiale / redescărcări':r.metric==='device_installs'?'Țară: instalări pe dispozitive':'Țară: evenimente de instalare'}</p>{r.countries.length?r.countries.map(c=><p key={c.country}>{c.country}: {c.installs}{r.metric==='app_units'?' / '+(c.redownloads??0):''}</p>):<p>0 unități raportate.</p>}</>}</details>)}</div>
    </div>
   </details>
  </>}
 </section>;
}
