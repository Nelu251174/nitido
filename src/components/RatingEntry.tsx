import {UiText,UiElement,useUiText} from '@/components/UiText';
import {ReviewEntryLink as Link} from './ReviewEntryLink';
export function RatingEntry({count,average}:{count:number;average:number|null}){
 const ui=useUiText();
 return <UiElement as="aside" className="home-rating-entry" aria-label="Rating și evaluări"><b><UiText text={"☆ Rating și evaluări"}/></b><p>{count&&average!==null?<><UiElement as="span" aria-label={ui("{p0} din 5 stele",[average.toFixed(1)])}>★ {average.toLocaleString('ro-RO',{maximumFractionDigits:1,minimumFractionDigits:1})} / 5</UiElement> · {count} {count===1?<UiText text={'recenzie verificată'}/>:<UiText text={'recenzii verificate'}/>}</>:<><span aria-hidden="true">☆☆☆☆☆</span><UiText text={" Nu există încă recenzii verificate."}/></>}</p><small><UiText text={"Firme și servicii prin NITIDO"}/></small><div><Link href="/#recenzii"><UiText text={"Vezi recenziile"}/></Link><Link href="/client/evaluari-lucrari"><UiText text={"Evaluează lucrarea"}/></Link></div></UiElement>;
}
