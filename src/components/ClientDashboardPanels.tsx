'use client';

import Link from 'next/link';
import {useLocale} from 'next-intl';
import {UiMoney} from './UiMoney';
import {UiSpaceType, UiText, UiElement} from './UiText';
import {DesignIcon} from './DesignIcon';
import {JOB_STATUS} from '@/lib/workspaceShared';
import type {JobRow} from '@/lib/types';
import {inputClass} from './ui';

type ListProps = {
  jobs: JobRow[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  compact?: boolean;
  query?: string;
  onQuery?: (value: string) => void;
  onSelect: (job: JobRow) => void;
  onBook: () => void;
};

export function ClientReservationList({jobs, loading = false, error, onRetry, compact = false, query = '', onQuery, onSelect, onBook}: ListProps) {
  const locale = useLocale();
  const ordered = [...jobs].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const matches = ordered.filter(job => `${job.city} ${job.street} ${JOB_STATUS[job.status]} ${job.id}`.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale)));
  const visible = compact ? matches.slice(0, 3) : matches;

  return <section id={compact ? undefined : 'sec-lucrari'} className="design-panel client-bookings-list" aria-busy={loading}>
    <div className="board-card-heading"><h2><UiText text={compact ? 'Rezervări recente' : 'Istoricul rezervărilor'}/></h2>{compact ? <Link href="/client/rezervari"><UiText text="Vezi toate"/><DesignIcon name="arrow" size={16}/></Link> : <span>{jobs.length}<UiText text=" înregistrate"/></span>}</div>
    {!compact&&<label className="client-bookings-search"><span className="text-sm font-semibold"><UiText text="Caută în rezervările tale"/></span><UiElement as="input" className={inputClass} maxLength={150} value={query} onChange={event=>onQuery?.(event.target.value)} placeholder="Localitate, adresă, stare sau referință"/></label>}
    {loading ? <p role="status" className="client-empty-state"><UiText text="Se încarcă rezervările…"/></p> : error ? <div role="alert" className="client-empty-state"><p><UiText text={error}/></p><button type="button" className="v2-btn v2-btn-secondary" onClick={onRetry}><UiText text="Încearcă din nou"/></button></div> : visible.length ? <ul className="client-reservation-rows">{visible.map(job=><li key={job.id} className="client-reservation-row">
      <UiElement as="button" type="button" className="client-reservation-open" onClick={()=>onSelect(job)} aria-label={`Vezi rezervarea ${job.id}`}>
        <span className="client-reservation-icon"><DesignIcon name="home" size={21}/></span>
        <span className="client-reservation-copy"><b><UiSpaceType value={job.space_type}/> · {job.city}</b><small>{job.street}</small><small>{job.scheduled_at ? new Date(job.scheduled_at).toLocaleString(locale, {timeZone:'Europe/Bucharest',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : <UiText text="Program în curs de stabilire"/>}</small></span>
        <span className="client-reservation-state"><span className="board-status" data-tone={job.status === "completed" ? "success" : ["cancelled", "no_show"].includes(job.status) ? "neutral" : "pending"}><UiText text={JOB_STATUS[job.status]}/></span><b><UiMoney ron={job.price_gross}/></b></span>
        <DesignIcon name="arrow" size={17}/>
      </UiElement>
      {job.status==='completed'&&!compact&&<Link className="client-reservation-repeat" href={`/client?repeatJobId=${encodeURIComponent(job.id)}#sec-form`}><UiText text="Rezervă din nou"/><DesignIcon name="arrow" size={15}/></Link>}
    </li>)}</ul> : <div className="client-empty-state"><DesignIcon name="calendar" size={28}/><h3><UiText text={query ? 'Nicio rezervare nu corespunde căutării.' : 'Nu ai rezervări încă.'}/></h3><p><UiText text={query ? 'Încearcă o altă adresă, localitate sau stare.' : 'Alege locuința și programul, apoi verifică prețul.'}/></p>{!query&&<button type="button" className="v2-btn v2-btn-primary" onClick={onBook}><UiText text="Configurează o rezervare"/></button>}</div>}
  </section>;
}

const paymentLabels: Record<string, string> = {authorized:'Sumă autorizată',captured:'Plată încasată',refunded:'Plată rambursată',cancelled:'Autorizare anulată',failed:'Plată nereușită',pending:'Plată în așteptare'};

export function ClientPaymentHistory({jobs, loading, error, onRetry, onSelect}: Pick<ListProps, 'jobs' | 'loading' | 'error' | 'onRetry' | 'onSelect'>) {
  return <section className="design-panel client-payments-history" aria-busy={loading}>
    <div className="board-card-heading"><h2><UiText text="Plățile rezervărilor"/></h2><DesignIcon name="card" size={21}/></div>
    <p className="booking-muted"><UiText text="Valoarea unei lucrări și starea plății sunt afișate separat. Finalizarea lucrării nu confirmă încasarea."/></p>
    {loading ? <p role="status"><UiText text="Se încarcă plățile…"/></p> : error ? <div role="alert"><p><UiText text={error}/></p><button type="button" onClick={onRetry}><UiText text="Încearcă din nou"/></button></div> : !jobs.length ? <p className="client-empty-state"><UiText text="Plățile vor apărea aici după prima rezervare."/></p> : <ul className="client-reservation-rows">{jobs.map(job=><li key={job.id} className="client-reservation-row"><button type="button" className="client-reservation-open" onClick={()=>onSelect(job)}><span className="client-reservation-icon"><DesignIcon name="card" size={21}/></span><span className="client-reservation-copy"><b>{job.city} · {job.street}</b><small><UiText text={paymentLabels[job.financial?.paymentStatus??'']??'Starea plății nu este confirmată'}/></small>{job.financial?.refundStatus&&job.financial.refundStatus!=='none'&&<small><UiText text="Rambursare: "/>{job.financial.refundStatus}</small>}</span><span className="client-reservation-state"><small><UiText text="Valoarea lucrării"/></small><b><UiMoney ron={job.price_gross}/></b></span><DesignIcon name="arrow" size={17}/></button></li>)}</ul>}
  </section>;
}
