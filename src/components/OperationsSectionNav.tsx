import Link from 'next/link';
import {DesignIcon,type DesignIconName} from './DesignIcon';
export function OperationsSectionNav({screen}:{screen:'host'|'business'}){
 const items:{label:string;href:string;icon:DesignIconName}[]=screen==='host'?[
 {label:'Proprietăți',href:'#locatii',icon:'home'},
 {label:'Calendar și pregătire',href:'#pregatire',icon:'calendar'},
 {label:'Curățenie',href:'/client#sec-lucrari',icon:'broom'},
 {label:'Lenjerie și consumabile',href:'#inventar',icon:'check'},
 {label:'Integrări',href:'#calendar-import',icon:'calendar'},
 ]:[
 {label:'Portofoliu',href:'#locatii',icon:'building'},
 {label:'Aprobări',href:'#aprobari',icon:'check'},
 {label:'Bugete',href:'#bugete',icon:'chart'},
 {label:'Documente',href:'#rapoarte',icon:'briefcase'},
 {label:'Membri',href:'/colaborari',icon:'users'},
 ];
 return <nav className="operations-section-nav" aria-label={screen==='host'?'Meniu gazdă':'Meniu business'}>{items.map(i=><Link href={i.href} key={i.label}><DesignIcon name={i.icon} size={20}/>{i.label}</Link>)}<Link href="/client"><DesignIcon name="arrow" size={20}/>Înapoi în cont</Link></nav>;
}
