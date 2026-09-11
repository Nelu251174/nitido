'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {DesignIcon,type DesignIconName} from './DesignIcon';
export function WorkspaceNav({role='client',onNavigate}:{role?:'client'|'firma'|'admin';onNavigate?:(href:string)=>void}){
 const path=usePathname();
 const items: [string,string,DesignIconName][]=role==='client'?[
 ['Acasă','/client','home'],['Rezervări','/client#sec-lucrari','calendar'],['Proprietăți','/client/proprietati','building'],['Mesaje','/client/mesaje','chat'],['Plăți','/client#sec-plata','card'],['Cont','/client#sec-cont','user'],['Business','/client/business','chart'],['Gazde','/client/host','home'],['Aprobări și acces','/colaborari','shield'],['Lucrările echipei','/echipa','users']
 ]:role==='firma'?[
 ['Oportunități','/firma','search'],['Calendar','/firma/calendar','calendar'],['Lucrări','/firma#lucrari-active','briefcase'],['Echipe','/firma/echipe','users'],['Câștiguri','/firma#castiguri','chart'],['Profil','/firma#profil','user'],['Execuție','/firma/executie','check'],['Mesaje','/firma/mesaje','chat'],['Angajați','/echipa','users']
 ]:[['Operațiuni','/admin','home'],['Firme','/admin#firme','building'],['Lucrări','/admin#lucrari','briefcase'],['Calitate','/admin#calitate','shield'],['Plăți','/admin#plati','card'],['Catalog','/admin#catalog','settings'],['Website','/','home']];
 return <nav className="workspace-nav" aria-label={`Navigare ${role}`}>{items.map(([label,href,icon])=><Link key={href} href={href} onClick={()=>onNavigate?.(href)} aria-current={!href.includes('#')&&path===href?'page':undefined}><DesignIcon name={icon} size={22}/><span>{label}</span></Link>)}</nav>;
}
