import Link from 'next/link';
import {NewBadge} from './NewBadge';
import {UiText} from './UiText';
export function NewFeatures({compact=false}:{compact?:boolean}){if(compact)return <details className="design-panel client-more-options"><summary><span><b><UiText text="Mai multe opțiuni pentru casa ta"/></b><small><UiText text="Planuri, disponibilitate și rezervări pentru cei dragi"/></small></span><span aria-hidden="true">+</span></summary><div className="client-context-groups">{[
 ['Locuință și rutină', [['/client/planul-casei','Planul casei pentru tot anul'],['/client/rutina','Rutina casei mele'],['/client/firme-preferate','Firmele mele preferate']]],
 ['O rezervare potrivită', [['/curatenie-de-primavara','Curățenie de primăvară'],['/client/descrie-prin-poze','Descrie lucrarea prin poze'],['/pentru-cei-dragi','Curățenie pentru cei dragi']]],
 ['Disponibilitate', [['/intervale-libere','Intervale săptămâna aceasta'],['/client/alerte-disponibilitate','Alerte de disponibilitate']]],
 ['Proprietăți și oaspeți', [['/client/pregatire-oaspeti','Pregătirea locuinței pentru oaspeți'],['/client/host','Calendar între rezervări'],['/client/business','Birouri și firme']]]
].map(([title,links])=><section key={String(title)}><h3><UiText text={String(title)}/></h3>{(links as string[][]).map(([href,label])=><Link key={href} href={href}><UiText text={label}/><span aria-hidden="true">→</span></Link>)}</section>)}</div></details>;return <section id="sec-noutati" className={compact?"mb-6":"design-container py-8"} aria-labelledby="new-features"><h2 id="new-features" className="text-2xl font-bold mb-5"><UiText text="Mai simplu, pentru tine și cei dragi"/></h2><div className="grid gap-4 md:grid-cols-3">{[
 ['/client/planul-casei','Planul casei pentru tot anul','Alegi lunile dorite pentru locuințele tale; confirmi separat fiecare rezervare.'],
 ['/client/pregatire-oaspeti','Locuința pregătită pentru oaspeți','Urmărești ferestrele dintre sejururi, termenul de pregătire și raportul lucrării.'],
 ['/curatenie-de-primavara','Pregătește casa pentru primăvară','Configurezi curățenia generală, alegi suplimentele și verifici prețul înainte de publicare.'],
 ['/client/rutina','Rutina casei mele','Gestionezi vizitele recurente, firma preferată și pauza de vacanță.'],
 ['/client#sec-lucrari','Rezervă din nou','Pornești dintr-o lucrare finalizată, alegi un program nou și verifici prețul actual.'],
 ['/client/alerte-disponibilitate','Anunță-mă când apare un loc','Primești o alertă pentru intervale verificate, numai după acordul tău.'],
 ['/client/firme-preferate','Firma mea preferată','Salvează firmele cu care ai finalizat lucrări și solicită-le candidatura pentru o rezervare nouă.'],
 ['/pentru-cei-dragi','Curățenie pentru cei dragi','Rezervi pentru cineva din România. Tu urmărești lucrarea, iar beneficiarul vede programarea partajată.'],
 ['/intervale-libere','Am liber săptămâna aceasta','Vezi intervalele publicate de firme și verificate pentru spațiul tău.'],
 ['/client/descrie-prin-poze','Descrie lucrarea prin poze','Încarci fotografii, verifici propunerea AI și continui rezervarea.']
].map(([href,title,text])=><Link key={href} href={href} className="v2-card p-5 block focus-visible:outline-2"><NewBadge/><h3 className="font-bold text-lg my-3"><UiText text={title}/></h3><p className="text-sm leading-6"><UiText text={text}/></p><span className="inline-block underline font-semibold mt-4"><UiText text="Descoperă →"/></span></Link>)}</div></section>}
