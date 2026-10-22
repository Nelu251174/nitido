import Link from 'next/link';
import {NewBadge} from './NewBadge';
export function NewFeatures({compact=false}:{compact?:boolean}){return <section id="sec-noutati" className={compact?"mb-6":"design-container py-8"} aria-labelledby="new-features"><h2 id="new-features" className="text-2xl font-bold mb-5">Mai simplu, pentru tine și cei dragi</h2><div className="grid gap-4 md:grid-cols-3">{[
 ['/client#sec-lucrari','Rezervă din nou','Pornești dintr-o lucrare finalizată, alegi un program nou și verifici prețul actual.'],
 ['/client/alerte-disponibilitate','Anunță-mă când apare un loc','Primești o alertă pentru intervale verificate, numai după acordul tău.'],
 ['/client/firme-preferate','Firma mea preferată','Salvează firmele cu care ai finalizat lucrări și solicită-le candidatura pentru o rezervare nouă.'],
 ['/pentru-cei-dragi','Curățenie pentru cei dragi','Rezervi pentru cineva din România. Tu urmărești lucrarea, iar beneficiarul vede programarea partajată.'],
 ['/intervale-libere','Am liber săptămâna aceasta','Vezi intervalele publicate de firme și verificate pentru spațiul tău.'],
 ['/client/descrie-prin-poze','Descrie lucrarea prin poze','Încarci fotografii, verifici propunerea AI și continui rezervarea.']
].map(([href,title,text])=><Link key={href} href={href} className="v2-card p-5 block focus-visible:outline-2"><NewBadge/><h3 className="font-bold text-lg my-3">{title}</h3><p className="text-sm leading-6">{text}</p><span className="inline-block underline font-semibold mt-4">Descoperă →</span></Link>)}</div></section>}
