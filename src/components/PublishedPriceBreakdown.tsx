import {readPublishedPrice} from '@/lib/publishedPrice';
const money=(bani:number)=>new Intl.NumberFormat('ro-RO',{style:'currency',currency:'RON'}).format(bani/100);
const labels:Record<string,string>={cleaning:'Serviciu de curățenie',express60:'Supliment Express 60',platform_credit:'Credit aplicat'};
export function PublishedPriceBreakdown({snapshot}:{snapshot?:string|null}){
 const price=readPublishedPrice(snapshot);
 return <section className="design-panel published-price"><h2>Prețul la publicare</h2>{price?<><p className="booking-muted">Înregistrat la {new Date(price.recordedAt).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest',dateStyle:'medium',timeStyle:'short'})}</p><dl>{price.lines.filter(l=>l.code==='cleaning'||l.amountBani!==0).map(l=><div key={l.code}><dt>{labels[l.code]}</dt><dd>{money(l.amountBani)}</dd></div>)}<div className="published-price-total"><dt>Total client la publicare</dt><dd>{money(price.clientTotalBani)}</dd></div></dl><p className="booking-muted">Aceasta este valoarea inițială a rezervării. Încasările, ajustările și rambursările sunt afișate separat în detaliile plății.</p></>:<p className="booking-muted">Defalcarea inițială nu este disponibilă pentru această rezervare. Consultă detaliile plății pentru starea actuală.</p>}</section>
}
