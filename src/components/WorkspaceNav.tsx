'use client';
import {OperationalInbox} from "./OperationalInbox";
import Link from 'next/link';
import {useMessageInbox} from './useMessageInbox';
import {useId,useState,useSyncExternalStore} from 'react';
const subscribeHash=(notify:()=>void)=>{window.addEventListener('hashchange',notify);window.addEventListener('popstate',notify);return()=>{window.removeEventListener('hashchange',notify);window.removeEventListener('popstate',notify)}};
const readHash=()=>window.location.hash;
const serverHash=()=>'';
import {usePathname} from 'next/navigation';
import {DesignIcon,type DesignIconName} from './DesignIcon';
export function WorkspaceNav({role='client',onNavigate}:{role?:'client'|'firma'|'admin';onNavigate?:(href:string)=>void}){
 const path=usePathname();
 const [open,setOpen]=useState(false);
 const menuId=useId();
 const unread=useMessageInbox(role!=="admin").reduce((sum,item)=>sum+item.unread,0);
 const hash=useSyncExternalStore(subscribeHash,readHash,serverHash);
 const items: [string,string,DesignIconName][]=role==='client'?[
 ['Acasă','/client','home'],['Rezervări','/client#sec-lucrari','calendar'],['Proprietăți','/client/proprietati','building'],['Mesaje','/client/mesaje','chat'],['Plăți','/client#sec-plata','card'],['Cont','/client#sec-cont','user'],['Evaluări și oferte','/client/evaluari','briefcase'],['Business','/client/business','chart'],['Curățenie între rezervări','/client/host','home'],['Aprobări și acces','/colaborari','shield'],['Lucrările echipei','/echipa','users']
 ]:role==='firma'?[
 ['Oportunități','/firma','search'],['Calendar','/firma/calendar','calendar'],['Lucrări','/firma#lucrari-active','briefcase'],['Execuție','/firma/executie','check'],['Mesaje','/firma/mesaje','chat'],['Câștiguri','/firma#castiguri','chart'],['Echipe','/firma/echipe','users'],['Angajați','/echipa','users'],['Profil','/firma#profil','user'],['Setări','/firma/setari','settings']
 ]:[['Operațiuni','/admin','home'],['Firme','/admin#firme','building'],['Lucrări','/admin#lucrari','briefcase'],['Calitate','/admin#calitate','shield'],['Incidente','/admin#incidente','shield'],['Performanță','/admin#performanta','chart'],['Clienți','/admin#clienti','users'],['Plăți','/admin#plati','card'],['Catalog','/admin#catalog','settings'],['Evaluări','/admin#evaluari','briefcase'],['Website public ↗','/','home']];
 const primary: [string,string,DesignIconName][]=role==='client'?[...items.slice(0,7),['Setări','/client/setari','settings']]:items;
 primary.push(['Remedieri','/remedieri','shield']);
 const professional:[string,string,string][]=[['Rapoarte și arhivă','/client/rapoarte','Intervale, totaluri și rapoarte salvate.'],['Organizații','/client/organizatii','Portofolii, roluri și praguri de aprobare.'],['Birouri și firme','/client/business','Locații de firmă, bugete și aprobări.'],['Curățenie între rezervări','/client/host','Pregătirea proprietății între plecarea și sosirea oaspeților.'],['Aprobări și acces','/colaborari','Invitații și permisiuni pentru locațiile administrate.'],['Lucrările echipei','/echipa','Pentru membrii invitați să execute lucrări.']];
 return <><OperationalInbox/><button type="button" className="workspace-menu-toggle" aria-expanded={open} aria-controls={menuId} onClick={()=>setOpen(!open)}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>{open?'Închide meniul':'Meniu'}</span></button><nav id={menuId} className={`workspace-nav ${open?'workspace-nav-open':''}`} aria-label={`Navigare ${role}`}>{primary.map(([label,href,icon])=>{const [targetPath,targetHash='']=href.split('#');const selected=path===targetPath&&hash===(targetHash?'#'+targetHash:'');const opensWebsite=role==='admin'&&href==='/';const NavLink=opensWebsite||targetHash||targetPath===path?'a':Link;return <NavLink key={href} href={href} target={opensWebsite?'_blank':undefined} rel={opensWebsite?'noopener noreferrer':undefined} aria-label={opensWebsite?'Website public — se deschide într-o filă nouă':undefined} onClick={()=>{setOpen(false);onNavigate?.(href)}} aria-current={selected?'page':undefined}><DesignIcon name={icon} size={22}/><span>{label}</span>{label==="Mesaje"&&unread>0&&<span role="status" aria-label={`${unread} mesaje necitite`} className="ml-auto rounded-full bg-[var(--nitido-brand-dark)] px-2 py-0.5 text-xs font-bold text-white">{unread}</span>}</NavLink>})}{role==='client'&&<details className="professional-nav" open={professional.some(([,href])=>path===href)}><summary>Opțiuni profesionale</summary><p>Ai o firmă, închiriezi proprietăți sau ai primit o invitație? Alege spațiul potrivit.</p>{professional.map(([label,href,description])=><Link key={href} href={href} onClick={()=>{setOpen(false);onNavigate?.(href)}} aria-current={path===href?"page":undefined}><span><b>{label}</b><small>{description}</small></span></Link>)}</details>}</nav></>;
}
