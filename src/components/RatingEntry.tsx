import {ReviewEntryLink as Link} from './ReviewEntryLink';
export function RatingEntry({count,average}:{count:number;average:number|null}){
 return <aside className="home-rating-entry" aria-label="Rating și evaluări"><b>☆ Rating și evaluări</b><p>{count&&average!==null?<><span aria-label={`${average.toFixed(1)} din 5 stele`}>★ {average.toLocaleString('ro-RO',{maximumFractionDigits:1,minimumFractionDigits:1})} / 5</span> · {count} {count===1?'recenzie verificată':'recenzii verificate'}</>:<><span aria-hidden="true">☆☆☆☆☆</span> Nu există încă recenzii verificate.</>}</p><small>Firme și servicii prin NITIDO</small><div><Link href="/#recenzii">Vezi recenziile</Link><Link href="/client/evaluari-lucrari">Evaluează lucrarea</Link></div></aside>;
}
