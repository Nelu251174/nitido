import Link from 'next/link';
import {DesignIcon,type DesignIconName} from './DesignIcon';
export function OperationsSectionNav({screen,disabled=false}:{screen:'host'|'business';disabled?:boolean}){
 const items:{label:string;href:string;icon:DesignIconName}[]=screen==='host'?[
 {label:'Proprietăți',href:'#locatii',icon:'home'},
 {label:'Curățenie între rezervări',href:'#plan-curatenie',icon:'calendar'},
 {label:'Curățenie',href:'/client#sec-lucrari',icon:'broom'},
 {label:'Lenjerie și consumabile',href:'#inventar',icon:'check'},
 {label:'Import calendar',href:'#calendar-import',icon:'calendar'},
 ]:[
 {label:'Organizații',href:'/client/organizatii',icon:'building'},
 {label:'Portofoliu',href:'#locatii',icon:'building'},
 {label:'Calendar',href:'#calendar-business',icon:'calendar'},
 {label:'Aprobări',href:'#aprobari',icon:'check'},
 {label:'Bugete',href:'#bugete',icon:'chart'},
 {label:'Documente',href:'#rapoarte',icon:'briefcase'},
 {label:'Membri',href:'/colaborari',icon:'users'},
 ];
 return <nav className="operations-section-nav" aria-label={screen==='host'?'Meniu gazdă':'Meniu business'}>{disabled?<Link href="/client/organizatii"><DesignIcon name="settings" size={20}/>Modulele organizației</Link>:items.map(i=><Link href={i.href} key={i.label}><DesignIcon name={i.icon} size={20}/>{i.label}</Link>)}<Link href="/client"><DesignIcon name="arrow" size={20}/>Înapoi în cont</Link></nav>;
}
