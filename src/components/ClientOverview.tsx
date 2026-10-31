'use client';

import Link from 'next/link';
import {useLocale} from 'next-intl';
import {UiSpaceType, UiText} from './UiText';
import {DesignIcon} from './DesignIcon';
import {JOB_STATUS} from '@/lib/workspaceShared';
import type {JobRow} from '@/lib/types';

type Props = {
  jobs: JobRow[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSelect: (job: JobRow) => void;
  onBook: () => void;
};

export function ClientOverview({jobs, loading = false, error, onRetry, onSelect, onBook}: Props) {
  const locale = useLocale();
  const next = [...jobs]
    .filter(job => ['accepted', 'arrived', 'waiting'].includes(job.status))
    .sort((a, b) => (a.scheduled_at ?? '9999').localeCompare(b.scheduled_at ?? '9999'))[0];

  return <section className="design-panel client-next-booking" aria-busy={loading}>
    <div className="board-card-heading">
      <p className="v2-eyebrow"><UiText text="URMĂTOAREA REZERVARE"/></p>
      <Link href="/client/rezervari"><UiText text="Toate rezervările"/><DesignIcon name="arrow" size={17}/></Link>
    </div>
    {loading ? <p role="status"><UiText text="Se încarcă rezervările tale…"/></p> : error ? <div role="alert"><h2><UiText text="Rezervările nu sunt disponibile momentan"/></h2><p><UiText text={error}/></p><button type="button" className="v2-btn v2-btn-secondary" onClick={onRetry}><UiText text="Încearcă din nou"/></button></div> : next ? <div className="client-next-booking-content">
      <div className="client-next-booking-symbol"><DesignIcon name="calendar" size={32}/></div>
      <div className="client-next-booking-copy">
        <span className="board-status" data-tone={next.status === "completed" ? "success" : ["cancelled", "no_show"].includes(next.status) ? "neutral" : "pending"}><UiText text={JOB_STATUS[next.status]}/></span>
        <h2><UiSpaceType value={next.space_type}/> · {next.city}</h2>
        <p><DesignIcon name="pin" size={17}/>{next.street} · {next.sqm}<UiText text=" m²"/></p>
        <p><DesignIcon name="calendar" size={17}/>{next.scheduled_at ? new Date(next.scheduled_at).toLocaleString(locale, {timeZone: 'Europe/Bucharest', dateStyle: 'medium', timeStyle: 'short'}) : <UiText text="Program în curs de stabilire"/>}</p>
      </div>
      <button type="button" className="design-button" onClick={() => onSelect(next)}><UiText text="Vezi rezervarea"/><DesignIcon name="arrow" size={18}/></button>
    </div> : <div className="client-next-booking-content client-empty-state">
      <div className="client-next-booking-symbol"><DesignIcon name="home" size={32}/></div>
      <div className="client-next-booking-copy"><h2><UiText text={jobs.length ? 'Casa ta, pregătită pentru următoarea vizită.' : 'Prima ta rezervare începe aici.'}/></h2><p><UiText text="Alege locuința și programul. Verifici prețul înainte să publici cererea."/></p></div>
      <button type="button" className="design-button" onClick={onBook}><UiText text="Configurează curățenia"/><DesignIcon name="arrow" size={18}/></button>
    </div>}
  </section>;
}
