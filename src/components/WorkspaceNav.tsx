'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {DesignIcon,type DesignIconName} from './DesignIcon';
export function WorkspaceNav({role='client',onNavigate}:{role?:'client'|'firma'|'admin';onNavigate?:(href:string)=>void}){
 const path=usePathname();
 const items: [string,string,DesignIconName][]=role==='client'?[
 ['Acasă','/client','home'],['Rezervări','/client#sec-lucrari','calendar'],['Proprietăți','/client/proprietati','building'],['Mesaje','/client/mesaje','chat'],['Plăți','/client#sec-plata','card'],['Cont','/client#sec-cont','user'],['Evaluări','/client/evaluari','briefcase'],['Business','/client/business','chart'],['Gazde','/client/host','home'],['Aprobări și acces','/colaborari','shield'],['Lucrările echipei','/echipa','users']
 ]:role==='firma'?[
 ['Oportunități','/firma','search'],['Calendar','/firma/calendar','calendar'],['Lucrări','/firma#lucrari-active','briefcase'],['Echipe','/firma/echipe','users'],['Câștiguri','/firma#castiguri','chart'],['Profil','/firma#profil','user'],['Execuție','/firma/executie','check'],['Mesaje','/firma/mesaje','chat'],['Angajați','/echipa','users']
 ]:[['Operațiuni','/admin','home'],['Firme','/admin#firme','building'],['Lucrări','/admin#lucrari','briefcase'],['Calitate','/admin#calitate','shield'],['Plăți','/admin#plati','card'],['Catalog','/admin#catalog','settings'],['Evaluări','/admin#evaluari','briefcase'],['Website','/','home']];
 const primary=role==='client'?items.slice(0,7):items;
 const professional:[string,string,string][]=[['Birouri și firme','/client/business','Locații de firmă, bugete și aprobări.'],['Închirieri și oaspeți','/client/host','Curățenie între sejururi pentru proprietarii de închirieri.'],['Aprobări și acces','/colaborari','Invitații și permisiuni pentru locațiile administrate.'],['Lucrările echipei','/echipa','Pentru membrii invitați să execute lucrări.']];
 return <nav className="workspace-nav" aria-label={`Navigare ${role}`}>{primary.map(([label,href,icon])=><Link key={href} href={href} onClick={()=>onNavigate?.(href)} aria-current={!href.includes('#')&&path===href?'page':undefined}><DesignIcon name={icon} size={22}/><span>{label}</span></Link>)}{role==='client'&&<details className="professional-nav" open={professional.some(([,href])=>path===href)}><summary>Opțiuni profesionale</summary><p>Ai o firmă, închiriezi proprietăți sau ai primit o invitație? Alege spațiul potrivit.</p>{professional.map(([label,href,description])=><Link key={href} href={href} onClick={()=>onNavigate?.(href)} aria-current={path===href?"page":undefined}><span><b>{label}</b><small>{description}</small></span></Link>)}</details>}</nav>;
}
