'use client';
import {useEffect} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import type {AdminDashboard} from '@/lib/adminDashboard';
import {JOB_STATUS} from '@/lib/workspaceShared';
import {UiElement,UiText} from './UiText';
import {useAdminWorkspaceResource} from './AdminWorkspaceResource';

const legacySections:Record<string,string>={operatiuni:'/admin/lucrari',lucrari:'/admin/lucrari',evaluari:'/admin/lucrari?tab=evaluari',clienti:'/admin/clienti',inscrieri:'/admin/clienti?tab=inscrieri',firme:'/admin/firme',plati:'/admin/financiar',calitate:'/admin/suport?tab=recenzii',incidente:'/admin/suport?tab=incidente',notificari:'/admin/suport?tab=notificari',catalog:'/admin/setari',performanta:'/admin/rapoarte','cereri-stergere':'/admin/clienti?tab=conturi'};
export function adminWorkspaceLegacyTarget(hash:string,focusJob:string|null){const base=legacySections[hash.replace(/^#/,'')];if(!base&&!focusJob)return null;const url=new URL(base??'/admin/lucrari','https://nitido.ro');if(focusJob)url.searchParams.set('jobId',focusJob);return url.pathname+url.search;}
const date=(value:string)=>new Date(value).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});

export function AdminWorkspaceDashboard({allAttention=false}:{allAttention?:boolean}){
  const params=useSearchParams(),view=params.get('view')??'all';
  const {data,error,busy,refresh}=useAdminWorkspaceResource<AdminDashboard>('/api/admin/dashboard'+(allAttention?'?attention=all':''));
  useEffect(()=>{if(allAttention)return;const target=adminWorkspaceLegacyTarget(window.location.hash,new URLSearchParams(window.location.search).get('focusJob'));if(target)window.location.replace(target);},[allAttention]);
  const items=data?.attention.items.filter(item=>view==='all'||item.severity===view)??[];
  const visible=allAttention?items:items.slice(0,6);
  return <>
    <div className="workspace-redesign-toolbar"><p>{data?<><UiText text="Actualizat"/>: {date(data.checkedAt)} · <UiText text="ora României"/></>:<UiText text="Se încarcă situația actuală…"/>}</p><button type="button" className="v2-btn v2-btn-secondary" disabled={busy} onClick={refresh}><UiText text={busy?'Se actualizează…':'Actualizează'}/></button></div>
    {error&&<p className="workspace-redesign-context" role="alert"><UiText text={error}/>{data&&<> <UiText text="Ultimele date disponibile sunt păstrate; actualizarea nu este confirmată."/></>}</p>}
    {data&&<>
      <div className="workspace-redesign-metrics">
        <Link className="workspace-redesign-metric" href="/admin/azi?view=urgent"><span><UiText text="Urgente"/></span><strong>{data.counts.urgent}</strong><small><UiText text="Dosare și semnale care cer intervenție"/></small></Link>
        <Link className="workspace-redesign-metric" href="/admin/azi?view=attention"><span><UiText text="De verificat"/></span><strong>{data.counts.attention}</strong><small><UiText text="Motive reunite pentru fiecare lucrare"/></small></Link>
        <Link className="workspace-redesign-metric" href={'/admin/lucrari?date='+encodeURIComponent(data.date)+'&scheduled=1'}><span><UiText text="Programate azi"/></span><strong>{data.counts.scheduledToday}</strong><small><UiText text="Data programării · ora României"/></small></Link>
        {data.counts.financialIssues!==null&&<Link className="workspace-redesign-metric" href="/admin/financiar?tab=plati&issues=1"><span><UiText text="Plăți de verificat"/></span><strong>{data.counts.financialIssues}</strong><small><UiText text="Excepții înregistrate, nu sold financiar"/></small></Link>}
      </div>
      <div className={allAttention?'':'workspace-redesign-grid'}>
        <section className="workspace-redesign-panel"><div className="workspace-redesign-panel-heading"><div><h2><UiText text={allAttention?'Toate semnalele de atenție':'Atenție acum'}/></h2><p><UiText text="Verifică situația înainte de orice acțiune."/></p></div>{!allAttention&&<Link href="/admin/azi"><UiText text="Vezi toate"/> ({data.attention.total})</Link>}</div>
          {allAttention&&<UiElement as="nav" className="workspace-redesign-section-nav" aria-label="Filtre de prioritate">{[['all','Toate'],['urgent','Urgente'],['attention','De verificat']].map(([key,label])=><Link key={key} href={'/admin/azi?view='+key} aria-current={view===key?'page':undefined}><UiText text={label}/></Link>)}</UiElement>}
          <div className="workspace-redesign-list">{visible.map(item=><article className="workspace-redesign-row" key={item.key}><div className="workspace-redesign-row-main"><span className={'workspace-redesign-status '+(item.severity==='urgent'?'is-urgent':'is-attention')}><UiText text={item.severity==='urgent'?'Urgent':'De verificat'}/></span><strong><UiText text={item.title}/></strong><small>{item.city}{item.since?' · '+date(item.since):''}</small><p><UiText text={item.nextAction}/></p>{item.reasons.length>1&&<details><summary>{item.reasons.length} <UiText text="motive asociate"/></summary><ul>{item.reasons.map(reason=><li key={reason.key}><UiText text={reason.title}/></li>)}</ul></details>}</div><Link className="v2-btn v2-btn-secondary" href={item.href}><UiText text="Deschide"/></Link></article>)}</div>
          {!visible.length&&<p className="workspace-redesign-empty"><UiText text="Nu sunt semnale pentru această selecție. Verificarea nu reprezintă un audit complet al platformei."/></p>}
          <p className="workspace-redesign-footnote"><UiText text={data.attention.limits}/></p>
        </section>
        {!allAttention&&<section className="workspace-redesign-panel"><div className="workspace-redesign-panel-heading"><div><h2><UiText text="Programul zilei"/></h2><p><UiText text="Intervenții programate astăzi"/></p></div><Link href={'/admin/lucrari?date='+encodeURIComponent(data.date)+'&scheduled=1'}><UiText text="Vezi toate"/> ({data.schedule.total})</Link></div><div className="workspace-redesign-list">{data.schedule.jobs.slice(0,6).map(job=><Link className="workspace-redesign-row" key={job.id} href={'/admin/lucrari?jobId='+encodeURIComponent(job.id)}><div className="workspace-redesign-row-main"><strong>{job.city} · {job.street}</strong><small>{date(job.scheduled_at)} · {job.firm_name??<UiText text="Firmă nealocată"/>}</small><small>{job.client_name}</small></div><span className="workspace-redesign-status"><UiText text={JOB_STATUS[job.status as keyof typeof JOB_STATUS]??job.status}/></span></Link>)}</div>{!data.schedule.jobs.length&&<p className="workspace-redesign-empty"><UiText text="Nu există intervenții programate astăzi."/></p>}</section>}
      </div>
    </>}
  </>;
}
