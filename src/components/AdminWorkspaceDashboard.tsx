'use client';
import {useEffect} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import type {AdminDashboard} from '@/lib/adminDashboard';
import {JOB_STATUS} from '@/lib/workspaceShared';
import {UiElement,UiText} from './UiText';
import {DesignIcon} from './DesignIcon';
import {useAdminWorkspaceResource} from './AdminWorkspaceResource';

const legacySections:Record<string,string>={operatiuni:'/admin/lucrari',lucrari:'/admin/lucrari',evaluari:'/admin/lucrari?tab=evaluari',clienti:'/admin/clienti',inscrieri:'/admin/clienti?tab=inscrieri',firme:'/admin/firme',plati:'/admin/financiar',calitate:'/admin/suport?tab=recenzii',incidente:'/admin/suport?tab=incidente',notificari:'/admin/suport?tab=notificari',catalog:'/admin/setari',performanta:'/admin/rapoarte','cereri-stergere':'/admin/clienti?tab=conturi'};
export function adminWorkspaceLegacyTarget(hash:string,focusJob:string|null){const base=legacySections[hash.replace(/^#/, '')];if(!base&&!focusJob)return null;const url=new URL(base??'/admin/lucrari','https://nitido.ro');if(focusJob)url.searchParams.set('jobId',focusJob);return url.pathname+url.search;}
const date=(value:string)=>new Date(value).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
const time=(value:string)=>new Date(value).toLocaleTimeString('ro-RO',{timeZone:'Europe/Bucharest',hour:'2-digit',minute:'2-digit'});

export function AdminWorkspaceDashboard({allAttention=false}:{allAttention?:boolean}){
  const params=useSearchParams(),view=params.get('view')??'all';
  const {data,error,busy,refresh}=useAdminWorkspaceResource<AdminDashboard>('/api/admin/dashboard'+(allAttention?'?attention=all':''));
  useEffect(()=>{if(allAttention)return;const target=adminWorkspaceLegacyTarget(window.location.hash,new URLSearchParams(window.location.search).get('focusJob'));if(target)window.location.replace(target);},[allAttention]);
  const items=data?.attention.items.filter(item=>view==='all'||item.severity===view)??[];
  const visible=allAttention?items:items.slice(0,6);
  return <>
    <div className="workspace-redesign-toolbar admin-preview-snapshot"><p><span className="admin-preview-snapshot-dot" data-state={error?'stale':busy||!data?'loading':'ready'} aria-hidden="true"/>{data?<><UiText text="Actualizat"/>: {date(data.checkedAt)} · <UiText text="ora României"/></>:<UiText text="Se încarcă situația actuală…"/>}</p><button type="button" className="admin-preview-refresh" disabled={busy} onClick={refresh}><DesignIcon name="clock" size={15}/><UiText text={busy?'Se actualizează…':'Actualizează'}/></button></div>
    {error&&<p className="workspace-redesign-context" role="alert"><UiText text={error}/>{data&&<> <UiText text="Ultimele date disponibile sunt păstrate; actualizarea nu este confirmată."/></>}</p>}
    {data&&<>
      <div className="workspace-redesign-metrics admin-preview-metric-strip">
        <Link className="workspace-redesign-metric" data-tone="urgent" href="/admin/azi?view=urgent"><span className="admin-preview-metric-icon"><DesignIcon name="shield" size={20}/></span><span className="admin-preview-metric-copy"><span><UiText text="Urgente"/></span><strong>{data.counts.urgent}</strong></span><small><UiText text="Dosare și semnale care cer intervenție"/></small></Link>
        <Link className="workspace-redesign-metric" data-tone="attention" href="/admin/azi?view=attention"><span className="admin-preview-metric-icon"><DesignIcon name="briefcase" size={20}/></span><span className="admin-preview-metric-copy"><span><UiText text="De verificat"/></span><strong>{data.counts.attention}</strong></span><small><UiText text="Motive reunite pentru fiecare lucrare"/></small></Link>
        <Link className="workspace-redesign-metric" href={'/admin/lucrari?date='+encodeURIComponent(data.date)+'&scheduled=1'}><span className="admin-preview-metric-icon"><DesignIcon name="calendar" size={20}/></span><span className="admin-preview-metric-copy"><span><UiText text="Programate azi"/></span><strong>{data.counts.scheduledToday}</strong></span><small><UiText text="Data programării · ora României"/></small></Link>
        {data.counts.financialIssues!==null&&<Link className="workspace-redesign-metric" href="/admin/financiar?tab=plati&issues=1"><span className="admin-preview-metric-icon"><DesignIcon name="card" size={20}/></span><span className="admin-preview-metric-copy"><span><UiText text="Plăți de verificat"/></span><strong>{data.counts.financialIssues}</strong></span><small><UiText text="Excepții înregistrate, nu sold financiar"/></small></Link>}
      </div>
      <div className={allAttention?'admin-preview-attention-page':'workspace-redesign-grid admin-preview-desk-grid'}>
        <section className="workspace-redesign-panel admin-preview-priority-panel">
          <div className="workspace-redesign-panel-heading"><div><div className="admin-preview-section-title"><h2><UiText text={allAttention?'Toate semnalele de atenție':'Atenție acum'}/></h2><span className="admin-preview-total">{allAttention?items.length:data.attention.total}</span></div><p><UiText text="Verifică situația înainte de orice acțiune."/></p></div>{!allAttention&&<Link href="/admin/azi"><UiText text="Vezi toate"/><DesignIcon name="arrow" size={15}/></Link>}</div>
          {allAttention&&<UiElement as="nav" className="workspace-redesign-section-nav" aria-label="Filtre de prioritate">{[['all','Toate'],['urgent','Urgente'],['attention','De verificat']].map(([key,label])=><Link key={key} href={'/admin/azi?view='+key} aria-current={view===key?'page':undefined}><UiText text={label}/></Link>)}</UiElement>}
          <div className="workspace-redesign-list admin-preview-attention-list">{visible.map(item=><article className="workspace-redesign-row admin-preview-attention-row" key={item.key}>
            <span className={'admin-preview-priority-icon '+(item.severity==='urgent'?'is-urgent':'is-attention')} aria-hidden="true"><DesignIcon name={item.severity==='urgent'?'shield':'briefcase'} size={19}/></span>
            <div className="workspace-redesign-row-main"><div className="admin-preview-row-title"><strong><UiText text={item.title}/></strong><span className={'workspace-redesign-status '+(item.severity==='urgent'?'is-urgent':'is-attention')}><UiText text={item.severity==='urgent'?'Urgent':'De verificat'}/></span></div><p><UiText text={item.nextAction}/></p><div className="admin-preview-row-location"><span>{item.city}</span>{item.since&&<time dateTime={item.since}>{date(item.since)}</time>}</div>{item.reasons.length>1&&<details><summary>{item.reasons.length} <UiText text="motive asociate"/></summary><ul>{item.reasons.map(reason=><li key={reason.key}><UiText text={reason.title}/></li>)}</ul></details>}</div>
            <Link className="admin-preview-open-item" href={item.href}><UiText text="Deschide"/><DesignIcon name="arrow" size={16}/></Link>
          </article>)}</div>
          {!visible.length&&<div className="admin-preview-empty-state"><span aria-hidden="true"><DesignIcon name="check" size={22}/></span><p><UiText text="Nu sunt semnale pentru această selecție. Verificarea nu reprezintă un audit complet al platformei."/></p></div>}
          <details className="admin-preview-scope"><summary><UiText text="Despre aceste informații"/></summary><p className="workspace-redesign-footnote"><UiText text={data.attention.limits}/></p></details>
        </section>
        {!allAttention&&<aside className="admin-preview-support">
          <section className="workspace-redesign-panel admin-preview-schedule-panel"><div className="workspace-redesign-panel-heading"><div><h2><UiText text="Programul zilei"/></h2><p><UiText text="Intervenții programate astăzi"/></p></div><span className="admin-preview-total">{data.schedule.total}</span></div>
            <div className="workspace-redesign-list">{data.schedule.jobs.slice(0,6).map(job=><Link className="workspace-redesign-row admin-preview-schedule-row" key={job.id} href={'/admin/lucrari?jobId='+encodeURIComponent(job.id)}><time className="admin-preview-schedule-time" dateTime={job.scheduled_at}>{time(job.scheduled_at)}</time><div className="workspace-redesign-row-main"><strong>{job.city}{job.street?' · '+job.street:''}</strong><small>{job.firm_name??<UiText text="Firmă nealocată"/>}</small><small>{job.client_name}</small><span className="workspace-redesign-status"><UiText text={JOB_STATUS[job.status as keyof typeof JOB_STATUS]??job.status}/></span></div><DesignIcon name="arrow" size={16}/></Link>)}</div>
            {!data.schedule.jobs.length&&<div className="admin-preview-empty-state"><span aria-hidden="true"><DesignIcon name="calendar" size={22}/></span><p><UiText text="Nu există intervenții programate astăzi."/></p></div>}
            <Link className="admin-preview-panel-footer" href={'/admin/lucrari?date='+encodeURIComponent(data.date)+'&scheduled=1'}><UiText text="Vezi toate"/> ({data.schedule.total})<DesignIcon name="arrow" size={15}/></Link>
          </section>
          <section className="admin-preview-shortcuts"><h2><UiText text="Acces rapid"/></h2><Link href="/admin/lucrari"><span><DesignIcon name="search" size={18}/><UiText text="Caută lucrarea"/></span><DesignIcon name="arrow" size={16}/></Link><Link href="/admin/azi"><span><DesignIcon name="shield" size={18}/><UiText text="Toate semnalele de atenție"/></span><DesignIcon name="arrow" size={16}/></Link></section>
        </aside>}
      </div>
    </>}
  </>;
}
