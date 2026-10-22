'use client';
import {SaveFavoriteButton} from './FavoriteFirms';
import {NewBadge} from './NewBadge';
import {UiSpaceType} from '@/components/UiText';
import {useLocale} from 'next-intl';
import {UiText,UiElement} from '@/components/UiText';
import {JobProofGallery} from './JobProofGallery';
import {SelectionRecovery} from './SelectionRecovery';
import type {JobRow} from '@/lib/types';
import {JOB_STATUS,money} from '@/lib/workspaceShared';
import {ExecutionChecklist} from './ExecutionChecklist';
import {JobMessages} from './JobMessages';
import {DesignIcon} from './DesignIcon';

const paymentLabels:Record<string,string>={authorized:'Sumă autorizată',captured:'Plată încasată',refunded:'Plată rambursată',cancelled:'Autorizare anulată',failed:'Plată nereușită',pending:'Plată în așteptare'};
export function JobExecutionDetail({job,firmName,onBack}:{job:JobRow;firmName:string|null;onBack:()=>void}){
 const locale=useLocale();
 const date=(value:string|null)=>value?new Date(value).toLocaleString(locale,{timeZone:'Europe/Bucharest',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'În așteptare';

 const proofs=job.proofs??[];
 const stages=[{label:job.selectionRecovery?'Confirmare în așteptare':'Confirmată',at:job.selectionRecovery?null:job.accepted_at,done:!job.selectionRecovery&&Boolean(job.accepted_at)},{label:'Echipa a sosit',at:job.arrived_confirmed_at,done:Boolean(job.arrived_confirmed_at)},{label:'În lucru',at:job.arrived_confirmed_at,done:Boolean(job.arrived_confirmed_at)},{label:'Raport foto',at:proofs.find(p=>p.type==='COMPLETION')?.createdAt??null,done:proofs.some(p=>p.type==='COMPLETION')},{label:'Finalizată',at:job.completed_at,done:job.status==='completed'}];
 const activeStage=job.status==='arrived'?(proofs.some(p=>p.type==='COMPLETION')?3:2):job.status==='accepted'?0:job.status==='completed'?4:-1;
 return <section className="execution-detail"><button className="execution-back" onClick={onBack}><DesignIcon name="arrow" size={18}/><UiText text={"Înapoi la rezervările mele"}/></button><header className="execution-heading"><div><h1 tabIndex={-1}><UiText text={"Curățenie · "}/><UiSpaceType value={job.space_type}/><span className="execution-reference">#{job.id.slice(0,8)}</span></h1><p><DesignIcon name="pin" size={18}/>{job.street}, {job.city}<span><DesignIcon name="calendar" size={18}/>{job.scheduled_at?date(job.scheduled_at):<UiText text={'Cât mai curând'}/>}</span></p></div><div className="execution-heading-badges"><span className={`eyebrow-pill ${job.mode==='express'?'execution-mode-express':''}`}><UiText text={job.mode==='express'?'Express':'Standard'}/></span><span className="eyebrow-pill"><UiText text={JOB_STATUS[job.status]}/></span></div></header>{job.selectionRecovery==='pending'&&<SelectionRecovery key={job.id} jobId={job.id}/>}<UiElement as="ol" className="execution-timeline" aria-label="Evoluția lucrării">{stages.map((s,index)=><li key={s.label} aria-current={index===activeStage?'step':undefined} className={`${s.done?'is-done':''} ${index===activeStage?'is-current':''}`}><span>{s.done?<DesignIcon name="check" size={18}/>:<DesignIcon name="clock" size={18}/>}</span><b><UiText text={s.label}/></b><small>{s.done?date(s.at):<UiText text={'În așteptare'}/>}</small></li>)}</UiElement>{['cancelled','no_show'].includes(job.status)&&<p role="status" className="workspace-error">{<UiText text={JOB_STATUS[job.status]}/>}<UiText text={". Etapele neatinse nu sunt confirmate."}/></p>}
 {job.bathroom_count!=null&&<p className="design-panel"><UiText text="Băi declarate: "/>{job.bathroom_count}<UiText text=" · o bucătărie inclusă, curățenie obișnuită."/></p>}
 {(job.windows_sqm??0)>0&&<p className="design-panel"><UiText text={"Spălare geamuri comandată separat: "}/>{job.windows_sqm}<UiText text={" m², ambele fețe accesibile și rame."}/></p>}
 {job.status==='completed'&&<section className="design-panel flex flex-wrap gap-4"><a className="v2-btn v2-btn-primary" href={'/client?repeatJobId='+encodeURIComponent(job.id)+'#sec-form'}>Rezervă din nou <NewBadge/></a>{job.accepted_firm_id&&<SaveFavoriteButton firmId={job.accepted_firm_id}/>}</section>}
 <div className="execution-detail-grid"><ExecutionChecklist key={job.id} jobId={job.id}/><JobProofGallery key={job.id} proofs={proofs} date={date}/><aside className="execution-detail-aside"><section className="design-panel"><h2><UiText text={"Firma parteneră"}/></h2><div className="execution-firm"><span>{firmName?.slice(0,1)||<UiText text={'N'}/>}</span><div><h3>{firmName|| (job.accepted_firm_id?<UiText text={'Se încarcă firma…'}/>:<UiText text={'Firma nu este încă alocată'}/>)}</h3><p>{job.duration_minutes}<UiText text={" minute estimate · "}/>{job.sqm}<UiText text={" m²"}/></p></div></div></section>{job.accepted_firm_id&&<JobMessages key={job.id} jobId={job.id}/>}<section className="design-panel"><h2><DesignIcon name="card"/><UiText text={"Detalii plată"}/></h2><strong className="execution-payment-total">{money(job.price_gross)}</strong><p><UiText text={paymentLabels[job.financial?.paymentStatus??'']??'Starea plății nu este confirmată'}/></p>{job.financial?.refundStatus&&job.financial.refundStatus!=='none'&&<p><UiText text={"Rambursare: "}/>{job.financial.refundStatus}</p>}<p className="booking-muted"><UiText text={"Starea plății este distinctă de starea lucrării. O bifă de progres nu confirmă încasarea."}/></p></section></aside></div></section>;
}
