'use client';

import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import type {CustomerRecordView} from '@/lib/customerAccess';
import {UiElement, UiText} from './UiText';
import {DesignIcon} from './DesignIcon';
import {inputClass} from './ui';
import {JOB_STATUS} from '@/lib/workspaceShared';
import {AdminRemoveAccount} from './AdminRemoveAccount';

type Entry = {id:string; name:string; email:string|null};
type Group = 'jobs'|'assessments'|'payments'|'cases'|'ratings'|'notes'|'restrictions';
type Detail = 'overview'|'jobs'|'assessments'|'payments'|'cases'|'history';
type HistoryPage = {rows: unknown[]; hasMore:boolean; offset:number};
type Pages = Partial<Record<Group,HistoryPage>>;
const groupKeys: Group[] = ['jobs','assessments','payments','cases','ratings','notes','restrictions'];
const details: Detail[] = ['overview','jobs','assessments','payments','cases','history'];
const label: Record<Group|string,string> = {overview:'Rezumat',jobs:'Rezervări',assessments:'Cereri de evaluare',payments:'Plăți',cases:'Sesizări',history:'Note și istoric',ratings:'Evaluări',notes:'Note interne',restrictions:'Istoricul restricțiilor'};
const offsetValue = (value:string|null) => {const number=Number(value??0);return Number.isSafeInteger(number)&&number>=0 ? Math.floor(number/50)*50 : 0;};
const page = (record:CustomerRecordView,key:Group):HistoryPage => ({...record[key],offset:record.offset});
const allPages = (record:CustomerRecordView):Pages => Object.fromEntries(groupKeys.map(key=>[key,page(record,key)]));

export function AdminCustomers({initialClientId,loadDirectory=false,canDelete=false}:{initialClientId?:string;loadDirectory?:boolean;canDelete?:boolean}={}) {
  const [query,setQuery]=useState('');
  const [clients,setClients]=useState<Entry[]>([]);
  const [directoryOffset,setDirectoryOffset]=useState(0);
  const [directoryMore,setDirectoryMore]=useState(false);
  const [record,setRecord]=useState<CustomerRecordView|null>(null);
  const [pages,setPages]=useState<Pages>({});
  const [detail,setDetail]=useState<Detail>('overview');
  const [history,setHistory]=useState<Group>('notes');
  const [busy,setBusy]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const running=useRef(false);

  function updateUrl(change:(params:URLSearchParams)=>void,push=false) {
    if(window.location.pathname!=='/admin/clienti')return;
    const url=new URL(window.location.href);change(url.searchParams);
    window.history[push?'pushState':'replaceState'](null,'',url.pathname+url.search);
  }
  async function request(url:string,body?:unknown) {
    const response=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
    const data=await response.json();
    if(!response.ok)throw Error(data.error??'Fișa nu a putut fi încărcată.');
    return data;
  }
  async function run(action:()=>Promise<void>) {
    if(running.current)return;
    running.current=true;setBusy(true);setError('');setNotice('');
    try{await action();}catch(cause){setError(cause instanceof Error?cause.message:'Operațiune neconfirmată.');}
    finally{running.current=false;setBusy(false);}
  }
  async function search(offset=0) {
    await run(async()=>{
      const data=await request('/api/admin/customers?'+new URLSearchParams({q:query,offset:String(offset)}));
      setClients(data.clients);setDirectoryMore(data.hasMore);setDirectoryOffset(offset);setRecord(null);setLoaded(true);
      updateUrl(params=>{params.delete('clientId');params.delete('detail');params.delete('history');if(query)params.set('q',query);else params.delete('q');if(offset)params.set('offset',String(offset));else params.delete('offset');for(const key of groupKeys)params.delete('page_'+key);});
    });
  }
  async function open(id:string) {
    await run(async()=>{
      const data:CustomerRecordView=await request('/api/admin/customers?'+new URLSearchParams({clientId:id,offset:'0'}));
      setRecord(data);setPages(allPages(data));setDetail('overview');setHistory('notes');setLoaded(true);
      updateUrl(params=>{params.set('clientId',id);params.delete('detail');params.delete('history');for(const key of groupKeys)params.delete('page_'+key);},true);
    });
  }
  async function loadPage(key:Group,offset:number) {
    if(!record)return;
    await run(async()=>{
      const data:CustomerRecordView=await request('/api/admin/customers?'+new URLSearchParams({clientId:record.user.id,offset:String(offset)}));
      setPages(current=>({...current,[key]:page(data,key)}));
      updateUrl(params=>{if(offset)params.set('page_'+key,String(offset));else params.delete('page_'+key);});
    });
  }
  function chooseDetail(value:Detail) {
    setDetail(value);setNotice('');
    updateUrl(params=>{if(value==='overview')params.delete('detail');else params.set('detail',value);});
  }
  function chooseHistory(value:Group) {
    setHistory(value);updateUrl(params=>params.set('history',value));
  }
  useEffect(()=>{
    if(!initialClientId&&!loadDirectory)return;
    const controller=new AbortController();
    const params=new URLSearchParams(window.location.search);
    const q=params.get('q')??'',directoryPage=offsetValue(params.get('offset'));
    const wantedDetail=details.includes(params.get('detail') as Detail)?params.get('detail') as Detail:'overview';
    const wantedHistory:Group=['notes','ratings','restrictions'].includes(params.get('history')??'')?params.get('history') as Group:'notes';
    const group:Group|null=wantedDetail==='overview'?null:wantedDetail==='history'?wantedHistory:wantedDetail;
    const currentOffset=group?offsetValue(params.get('page_'+group)):0;
    async function load() {
      setBusy(true);setLoaded(false);setError('');setQuery(q);setDirectoryOffset(directoryPage);setDetail(wantedDetail);setHistory(wantedHistory);
      try{
        const url=initialClientId?new URLSearchParams({clientId:initialClientId,offset:'0'}):new URLSearchParams({q,offset:String(directoryPage)});
        const response=await fetch('/api/admin/customers?'+url,{cache:'no-store',signal:controller.signal});
        const data=await response.json();if(!response.ok)throw Error(data.error);if(controller.signal.aborted)return;
        if(initialClientId){
          setRecord(data);setPages(allPages(data));if(wantedDetail==='payments'&&!data.permissions.financial)setDetail('overview');
          if(group&&currentOffset){const later=await fetch('/api/admin/customers?'+new URLSearchParams({clientId:initialClientId,offset:String(currentOffset)}),{cache:'no-store',signal:controller.signal});const next=await later.json();if(!later.ok)throw Error(next.error);if(controller.signal.aborted)return;setPages(current=>({...current,[group]:page(next,group)}));}
        }else{setClients(data.clients);setDirectoryMore(data.hasMore);setRecord(null);}
        setLoaded(true);
      }catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Fișa nu a putut fi încărcată.');}
      finally{if(!controller.signal.aborted)setBusy(false);}
    }
    void load();return()=>controller.abort();
  },[initialClientId,loadDirectory]);

  async function save(form:HTMLFormElement,action:'note'|'classify'|'restrict') {
    if(!record)return;
    const values=Object.fromEntries(new FormData(form));
    await run(async()=>{
      await request('/api/admin/customers',{action,clientId:record.user.id,revision:action==='restrict'?record.restriction.revision:record.classification.revision,...values,...(action==='restrict'?{blockBookings:values.blockBookings==='on',blockAssessments:values.blockAssessments==='on'}:{}),...(action==='classify'?{tags:String(values.tags).split(',').map(value=>value.trim()).filter(Boolean)}:{})});
      const updated:CustomerRecordView=await request('/api/admin/customers?clientId='+encodeURIComponent(record.user.id));
      setRecord(updated);
      if(action==='note'){setPages(current=>({...current,notes:page(updated,'notes')}));setDetail('history');setHistory('notes');updateUrl(params=>{params.set('detail','history');params.set('history','notes');params.delete('page_notes');});}
      if(action==='restrict')setPages(current=>({...current,restrictions:page(updated,'restrictions')}));
      setNotice(action==='note'?'Nota internă a fost salvată.':action==='classify'?'Clasificarea a fost salvată.':'Restricțiile au fost actualizate.');
      form.reset();
    });
  }
  const activeGroup:Group|null=detail==='overview'?null:detail==='history'?history:detail;
  const visiblePage=activeGroup?pages[activeGroup]:undefined;
  const permittedDetails=details.filter(item=>item!=='payments'||record?.permissions.financial);

  return <section id="clienti" className="admin-customers" aria-busy={busy}>
    {error&&<p className="workspace-error" role="alert">{error}</p>}
    {notice&&<p className="workspace-notice" role="status">{notice}</p>}
    {!record?<section className="design-panel admin-customers-directory">
      <div className="board-card-heading"><div><h2><UiText text="Clienți"/></h2><p className="text-sm text-muted"><UiText text="Caută după nume, email sau identificator."/></p></div><DesignIcon name="users" size={24}/></div>
      <form className="workspace-redesign-toolbar" onSubmit={event=>{event.preventDefault();void search();}}><label className="grow"><span className="sr-only"><UiText text="Caută un client"/></span><UiElement as="input" className={inputClass} maxLength={150} value={query} onChange={event=>setQuery(event.target.value)} disabled={busy} placeholder="Nume, email sau identificator"/></label><button className="v2-btn v2-btn-primary" disabled={busy}><DesignIcon name="search" size={18}/><UiText text="Caută clienți"/></button></form>
      {busy&&!loaded?<p role="status" className="py-6"><UiText text="Se încarcă clienții…"/></p>:<div className="admin-customers-table-wrap"><table className="workspace-table admin-customers-table"><thead><tr><th><UiText text="Client"/></th><th><UiText text="Email"/></th><th><UiText text="Acțiune"/></th></tr></thead><tbody>{clients.map(client=><tr key={client.id} className="customer-directory-row"><td><b>{client.name}</b><small>{client.id}</small></td><td className="break-all">{client.email??<UiText text="Email neînregistrat"/>}</td><td><button className="v2-btn v2-btn-secondary" disabled={busy} onClick={()=>void open(client.id)}><UiText text="Deschide fișa"/><DesignIcon name="arrow" size={16}/></button>{canDelete&&<AdminRemoveAccount kind="client" targetId={client.id} name={client.name} disabled={busy} onRemoved={()=>void search(directoryOffset)}/>}</td></tr>)}</tbody></table>{loaded&&!clients.length&&<div className="empty-workspace"><DesignIcon name="users" size={26}/><h3><UiText text="Niciun client pentru această căutare"/></h3><p><UiText text="Încearcă un alt nume, email sau identificator."/></p></div>}</div>}
      <div className="workspace-redesign-toolbar justify-between mt-5"><button className="v2-btn v2-btn-secondary" disabled={busy||directoryOffset===0} onClick={()=>void search(directoryOffset-50)}><UiText text="Clienții anteriori"/></button><span className="text-sm text-muted"><UiText text="Pagina"/> {directoryOffset/50+1}</span><button className="v2-btn v2-btn-secondary" disabled={busy||!directoryMore} onClick={()=>void search(directoryOffset+50)}><UiText text="Clienții următori"/></button></div>
    </section>:<article className="admin-customer-record">
      <button className="workspace-redesign-back mb-4" disabled={busy} onClick={()=>void search(directoryOffset)}><DesignIcon name="arrow" size={17}/><UiText text="Înapoi la clienți"/></button>
      <header className="design-panel admin-customer-heading"><div><p className="v2-eyebrow"><UiText text="FIȘĂ CLIENT"/></p><h2>{record.user.name}</h2><div className="admin-customer-contact"><span>{record.user.email??<UiText text="Email neînregistrat"/>}</span><span>{record.user.phone??<UiText text="Telefon neînregistrat"/>}</span></div><small className="text-muted break-all"><UiText text="Referință"/>: {record.user.id}</small></div><div className="admin-customer-tags">{record.classification.tags.map(tag=><span className="eyebrow-pill" key={tag}>{tag}</span>)}</div></header>
      <div className="admin-customer-metrics"><section className="design-panel"><p><UiText text="Lucrări înregistrate"/></p><strong>{record.value.totalJobs}</strong></section><section className="design-panel"><p><UiText text="Lucrări finalizate"/></p><strong>{record.value.completedJobs}</strong></section><section className="design-panel"><p><UiText text="Proprietăți active"/></p><strong>{record.properties}</strong></section></div>
      <UiElement as="nav" className="workspace-redesign-section-nav" aria-label="Secțiunile fișei clientului">{permittedDetails.map(item=><button key={item} type="button" aria-pressed={detail===item} disabled={busy} onClick={()=>chooseDetail(item)}><UiText text={label[item]}/></button>)}</UiElement>
      {detail==='overview'&&<div className="admin-customer-summary">
        <section className="design-panel"><h3><UiText text="Context operațional"/></h3><p><UiText text="Etichetele și notele sunt interne. Nu aplică automat blocări, reduceri sau schimbări de preț."/></p><p><UiText text="Proprietățile Pro rămân administrate separat în organizație."/></p>{record.permissions.financial&&<p><UiText text="Sold credit înregistrat"/>: {record.user.credit_balance} lei</p>}
          {record.classification.reason&&<p><b><UiText text="Motivul clasificării"/>:</b> {record.classification.reason}</p>}
          {record.permissions.annotate&&<details className="customer-account-actions"><summary><UiText text="Editează clasificarea"/></summary><form key={'tags'+record.user.id+record.classification.revision} className="space-y-3 mt-4" onSubmit={event=>{event.preventDefault();void save(event.currentTarget,'classify');}}><label className="block"><UiText text="Etichete separate prin virgulă"/><UiElement as="input" className={inputClass} name="tags" maxLength={730} defaultValue={record.classification.tags.join(', ')} placeholder="nou, recurent, corporate" disabled={busy}/></label><label className="block"><UiText text="Motivul clasificării"/><input className={inputClass} name="reason" maxLength={2000} required disabled={busy}/></label><button className="v2-btn v2-btn-primary" disabled={busy}><UiText text="Salvează clasificarea"/></button></form></details>}
        </section>
        {record.value.completedServiceValueBani!==null&&<section className="design-panel"><h3><UiText text="Valoarea serviciilor finalizate"/></h3><strong>{formatBani(record.value.completedServiceValueBani)}</strong><p><UiText text="Suma prețurilor brute înregistrate ale lucrărilor finalizate, din tot istoricul. Nu reprezintă încasări nete după credit sau rambursări."/></p></section>}
        {record.value.margin&&<section className="design-panel"><h3><UiText text="Marja operațională cumulată"/></h3><strong>{record.value.margin.totalBani===null?<UiText text="Incompletă: nu există costuri confirmate pentru toate lucrările finalizate."/>:formatBani(record.value.margin.totalBani)}</strong><dl className="admin-customer-record-fields"><div><dt><UiText text="Subtotal confirmat"/></dt><dd>{formatBani(record.value.margin.knownConfirmedBani)}</dd></div><div><dt><UiText text="Lucrări cu costuri confirmate"/></dt><dd>{record.value.margin.confirmedJobs}</dd></div><div><dt><UiText text="Cu estimări"/></dt><dd>{record.value.margin.estimatedJobs}</dd></div><div><dt><UiText text="Date lipsă sau incomplete"/></dt><dd>{record.value.margin.missingOrIncompleteJobs}</dd></div></dl><p><UiText text="Marja nu este profit contabil net."/></p><Link className="v2-btn v2-btn-secondary" href={`/admin/rapoarte?clientId=${encodeURIComponent(record.user.id)}`}><UiText text="Deschide performanța"/></Link></section>}
        {record.permissions.restrict&&<details className="design-panel customer-account-actions"><summary><UiText text="Restricții pentru cereri noi"/></summary><form key={'restriction'+record.user.id+record.restriction.revision} className="space-y-3 mt-4" onSubmit={event=>{event.preventDefault();void save(event.currentTarget,'restrict');}}><p><UiText text="Accesul la lucrările existente, sesizări, mesaje și operațiunile de plată rămâne disponibil. Organizațiile Pro se administrează separat."/></p><label className="block"><input type="checkbox" name="blockBookings" defaultChecked={!!record.restriction.block_bookings} disabled={busy}/> <UiText text="Blochează rezervările noi Standard și Express, inclusiv ofertele asistate și vizitele recurente"/></label><label className="block"><input type="checkbox" name="blockAssessments" defaultChecked={!!record.restriction.block_assessments} disabled={busy}/> <UiText text="Blochează cererile noi de evaluare"/></label><label className="block"><UiText text="Motivul aplicării sau ridicării restricțiilor"/><textarea className={inputClass} name="reason" required maxLength={2000} disabled={busy}/></label><button className="v2-btn v2-btn-primary" disabled={busy}><UiText text="Salvează restricțiile"/></button></form></details>}
      </div>}
      {detail!=='overview'&&<section className="design-panel admin-customer-history">
        {detail==='history'&&<UiElement as="nav" className="workspace-redesign-section-nav" aria-label="Tip de istoric">{(['notes','ratings','restrictions'] as Group[]).map(key=><button type="button" key={key} aria-pressed={history===key} disabled={busy} onClick={()=>chooseHistory(key)}><UiText text={label[key]}/></button>)}</UiElement>}
        <div className="board-card-heading"><h3><UiText text={label[activeGroup??'history']}/></h3><span className="text-sm text-muted"><UiText text="Pagina"/> {(visiblePage?.offset??0)/50+1}</span></div>
        {detail==='history'&&history==='notes'&&record.permissions.annotate&&<form className="space-y-3 mb-6" onSubmit={event=>{event.preventDefault();void save(event.currentTarget,'note');}}><label className="block"><UiText text="Notă internă cu autor și dată"/><textarea className={inputClass} required name="note" maxLength={4000} disabled={busy}/></label><button className="v2-btn v2-btn-primary" disabled={busy}><UiText text="Adaugă nota internă"/></button></form>}
        {activeGroup==='payments'&&<p className="text-sm text-muted"><UiText text="Stările plății și referințele Stripe sunt doar citite; nu sunt recalculări contabile."/></p>}
        {activeGroup&&visiblePage?.rows.map((row,index)=><CustomerHistoryRow key={String((row as Record<string,unknown>).id??index)} row={row as Record<string,unknown>} group={activeGroup} jobRoute={record.permissions.annotate?"/admin/lucrari?jobId=":record.permissions.financial?"/admin/financiar?tab=lucrari&jobId=":null}/>)}
        {!visiblePage?.rows.length&&<p className="empty-workspace"><UiText text="Nicio înregistrare pe această pagină."/></p>}
        <div className="workspace-redesign-toolbar justify-between mt-5"><button className="v2-btn v2-btn-secondary" disabled={busy||!activeGroup||!visiblePage?.offset} onClick={()=>activeGroup&&void loadPage(activeGroup,(visiblePage?.offset??0)-50)}><UiText text="Istoric anterior"/></button><span className="text-sm text-muted"><UiText text="Maximum 50 de înregistrări pe pagină"/></span><button className="v2-btn v2-btn-secondary" disabled={busy||!activeGroup||!visiblePage?.hasMore} onClick={()=>activeGroup&&void loadPage(activeGroup,(visiblePage?.offset??0)+50)}><UiText text="Istoric următor"/></button></div>
      </section>}
    </article>}
  </section>;
}

function CustomerHistoryRow({row,group,jobRoute}:{row:Record<string,unknown>;group:Group;jobRoute:string|null}) {
  const jobId=typeof row.job_id==='string'?row.job_id:group==='jobs'&&typeof row.id==='string'?row.id:null;
  return <article className="admin-customer-history-row"><div className="board-card-heading"><b>{group==='notes'?<UiText text="Notă internă"/>:<><UiText text={label[group]}/> · {String(row.id??row.revision??'')}</>}</b>{jobId&&jobRoute&&<Link className="v2-btn v2-btn-secondary" href={jobRoute+encodeURIComponent(jobId)}><UiText text="Deschide lucrarea"/><DesignIcon name="arrow" size={15}/></Link>}</div><dl className="admin-customer-record-fields">{Object.entries(row).map(([key,value])=><div key={key}><dt><UiText text={fieldNames[key]??key.replaceAll('_',' ')}/></dt><dd>{value===null?<UiText text="Neînregistrat"/>:key==='block_bookings'||key==='block_assessments'?<UiText text={value?'Da':'Nu'}/>:['status','refund_status','moderation_status','mode'].includes(key)&&stateLabels[String(value)]?<UiText text={stateLabels[String(value)]}/>:String(value)}</dd></div>)}</dl></article>;
}

const stateLabels:Record<string,string>={...JOB_STATUS,authorized:'Sumă autorizată',captured:'Plată încasată',refunded:'Plată rambursată',failed:'Nereușit',pending:'În așteptare',none:'Fără rambursare',standard:'Standard',express:'Express',published:'Publicat',approved:'Aprobat',rejected:'Respins',open:'Deschis',resolved:'Rezolvat',closed:'Închis',in_review:'În verificare'};
const fieldNames:Record<string,string>={revision:'Revizie',block_bookings:'Rezervări noi blocate',block_assessments:'Cereri de evaluare blocate',reason:'Motiv',id:'Referință',job_id:'Lucrare',city:'Localitate',status:'Stare',mode:'Mod',price_gross:'Valoare lucrare (lei)',created_at:'Data înregistrării (UTC)',amount_gross:'Sumă plată (lei)',stripe_payment_intent_id:'Referință Stripe',refund_status:'Stare rambursare',category:'Categorie',stars:'Stele',moderation_status:'Moderare',body:'Notă',actor_id:'Autor (sesiune verificată)'};
const formatBani=(bani:number)=>new Intl.NumberFormat('ro-RO',{style:'currency',currency:'RON'}).format(bani/100);
