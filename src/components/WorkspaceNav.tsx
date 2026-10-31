'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useId,useRef,useState,useSyncExternalStore} from 'react';
import {UiText,UiElement} from '@/components/UiText';
import {hasAdminPermission,type AdminIdentity,type AdminPermission,type AdminRole} from '@/lib/adminRolesShared';
import {CLIENT_NAVIGATION_ITEMS,clientActiveNavigationHref} from '@/lib/clientNavigation';
import {DesignIcon,type DesignIconName} from './DesignIcon';
import {NewBadge} from './NewBadge';
import {OperationalInbox} from './OperationalInbox';
import {useMessageInbox} from './useMessageInbox';

type NavItem = {label:string;href:string;icon:DesignIconName};
type AdminNavItem = NavItem & {permission:AdminPermission;group:'operations'|'administration'};
const adminItems: readonly AdminNavItem[] = [
  {label:'Azi',href:'/admin',icon:'home',permission:'operations',group:'operations'},
  {label:'Lucrări',href:'/admin/lucrari',icon:'briefcase',permission:'operations',group:'operations'},
  {label:'Clienți',href:'/admin/clienti',icon:'users',permission:'incidents',group:'operations'},
  {label:'Firme',href:'/admin/firme',icon:'building',permission:'manage',group:'operations'},
  {label:'Suport și calitate',href:'/admin/suport',icon:'shield',permission:'incidents',group:'operations'},
  {label:'Financiar',href:'/admin/financiar',icon:'card',permission:'finance',group:'administration'},
  {label:'Marketing',href:'/admin/marketing',icon:'chart',permission:'super_admin',group:'administration'},
  {label:'Rapoarte',href:'/admin/rapoarte',icon:'chart',permission:'reports',group:'administration'},
];

export function adminNavigationItems(role?:AdminRole) {
  return role ? adminItems.filter(item=>hasAdminPermission(role,item.permission)) : [];
}

const clientIcons: readonly DesignIconName[] = ['home','calendar','building','chat','card','user'];
const firmItems: readonly NavItem[] = [
  {label:'Oportunități',href:'/firma',icon:'search'},
  {label:'Calendar',href:'/firma/calendar',icon:'calendar'},
  {label:'Programări și reamintiri',href:'/firma/programari',icon:'bell'},
  {label:'Intervale libere',href:'/firma/intervale-libere',icon:'calendar'},
  {label:'Planificare',href:'/firma/planificare',icon:'chart'},
  {label:'Lucrări',href:'/firma#lucrari-active',icon:'briefcase'},
  {label:'Execuție',href:'/firma/executie',icon:'check'},
  {label:'Mesaje',href:'/firma/mesaje',icon:'chat'},
  {label:'Câștiguri',href:'/firma#castiguri',icon:'chart'},
  {label:'Echipe',href:'/firma/echipe',icon:'users'},
  {label:'Angajați',href:'/echipa',icon:'users'},
  {label:'Profil',href:'/firma#profil',icon:'user'},
  {label:'Setări',href:'/firma/setari',icon:'settings'},
  {label:'Dosarele mele',href:'/dosare',icon:'briefcase'},
  {label:'Remedieri',href:'/remedieri',icon:'shield'},
];

const clientOptions: readonly {label:string;items:readonly NavItem[]}[] = [
  {label:'Rezervări și documente',items:[
    {label:'Evaluări și oferte',href:'/client/evaluari',icon:'briefcase'},
    {label:'Programări primite',href:'/client/beneficiar',icon:'calendar'},
    {label:'Dosarele mele',href:'/dosare',icon:'briefcase'},
    {label:'Remedieri',href:'/remedieri',icon:'shield'},
    {label:'Rapoarte și arhivă',href:'/client/rapoarte',icon:'chart'},
  ]},
  {label:'Planificarea locuinței',items:[
    {label:'Planul casei',href:'/client/planul-casei',icon:'home'},
    {label:'Rutina casei mele',href:'/client/rutina',icon:'calendar'},
    {label:'Firmele mele preferate',href:'/client/firme-preferate',icon:'building'},
  ]},
  {label:'Opțiuni pentru o rezervare nouă',items:[
    {label:'Curățenie de primăvară',href:'/curatenie-de-primavara',icon:'sparkles'},
    {label:'Pentru cei dragi',href:'/pentru-cei-dragi',icon:'home'},
    {label:'Intervale săptămâna aceasta',href:'/intervale-libere',icon:'calendar'},
    {label:'Descrie prin poze',href:'/client/descrie-prin-poze',icon:'search'},
    {label:'Alerte de disponibilitate',href:'/client/alerte-disponibilitate',icon:'bell'},
  ]},
  {label:'Opțiuni profesionale',items:[
    {label:'Organizații',href:'/client/organizatii',icon:'users'},
    {label:'Birouri și firme',href:'/client/business',icon:'building'},
    {label:'Curățenie între rezervări',href:'/client/host',icon:'home'},
    {label:'Pregătire pentru oaspeți',href:'/client/pregatire-oaspeti',icon:'home'},
    {label:'Aprobări și acces',href:'/colaborari',icon:'shield'},
    {label:'Lucrările echipei',href:'/echipa',icon:'users'},
  ]},
];

const subscribeHash=(notify:()=>void)=>{
  window.addEventListener('hashchange',notify);
  window.addEventListener('popstate',notify);
  return()=>{window.removeEventListener('hashchange',notify);window.removeEventListener('popstate',notify);};
};
const readHash=()=>window.location.hash;
const serverHash=()=>'';

function adminActiveHref(pathname:string,hash:string) {
  if(pathname==='/admin') {
    const legacy:Record<string,string>={
      '#lucrari':'/admin/lucrari','#operatiuni':'/admin/lucrari','#evaluari':'/admin/lucrari',
      '#clienti':'/admin/clienti','#firme':'/admin/firme','#calitate':'/admin/suport',
      '#incidente':'/admin/suport','#notificari':'/admin/suport','#performanta':'/admin/rapoarte',
      '#plati':'/admin/financiar','#catalog':'/admin/setari',
    };
    return legacy[hash]??'/admin';
  }
  if(pathname==='/admin/azi')return '/admin';
  if(pathname==='/admin/raport-rezervari')return '/admin/rapoarte';
  if(pathname==='/admin/notificari')return '/admin/suport';
  if(pathname==='/admin/recuperare')return '/admin/financiar';
  return pathname;
}

export function WorkspaceNav({role='client',onNavigate,adminIdentity}:{
  role?:'client'|'firma'|'admin';
  onNavigate?:(href:string)=>void;
  marketing?:boolean;
  adminIdentity?:AdminIdentity;
}) {
  const path=usePathname();
  const hash=useSyncExternalStore(subscribeHash,readHash,serverHash);
  const [open,setOpen]=useState(false);
  const menuId=useId();
  const toggle=useRef<HTMLButtonElement>(null);
  const navigation=useRef<HTMLElement>(null);
  const unread=useMessageInbox(role!=='admin').reduce((sum,item)=>sum+item.unread,0);
  const activeHref=role==='client'?clientActiveNavigationHref(path,hash):role==='admin'?adminActiveHref(path,hash):null;

  useEffect(()=>{
    if(!open)return;
    navigation.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape') {setOpen(false);toggle.current?.focus();}
    };
    const outside=(event:PointerEvent)=>{
      if(event.target instanceof Node&&!navigation.current?.contains(event.target)&&!toggle.current?.contains(event.target))setOpen(false);
    };
    window.addEventListener('keydown',keydown);
    document.addEventListener('pointerdown',outside);
    return()=>{window.removeEventListener('keydown',keydown);document.removeEventListener('pointerdown',outside);};
  },[open]);

  const activate=(href:string)=>{setOpen(false);onNavigate?.(href);};
  function link(item:NavItem,secondary=false) {
    const [targetPath,targetHash='']=item.href.split('#');
    const selected=role==='firma'
      ? path===targetPath&&hash===(targetHash?'#'+targetHash:'')
      : activeHref===item.href||(!['/admin','/client'].includes(item.href)&&Boolean(activeHref?.startsWith(item.href+'/')));
    const current=secondary?(path===targetPath?'location':undefined):selected?'page':undefined;
    const content=<><DesignIcon name={item.icon} size={22}/><span className="workspace-nav-copy"><span className="workspace-nav-label"><UiText text={item.label}/></span>{role==='firma'&&['/dosare','/firma/programari','/firma/planificare','/firma/intervale-libere'].includes(item.href)&&<NewBadge/>}</span>{item.label==='Mesaje'&&unread>0&&<UiElement as="span" role="status" aria-label={`${unread} mesaje necitite`} className="workspace-unread-count ml-auto rounded-full bg-[var(--nitido-brand-dark)] px-2 py-0.5 text-xs font-bold text-white">{unread}</UiElement>}</>;
    if(targetHash)return <a key={item.href} className="workspace-nav-item" href={item.href} onClick={()=>activate(item.href)} aria-current={current}>{content}</a>;
    return <Link key={item.href} className="workspace-nav-item" href={item.href} onClick={()=>activate(item.href)} aria-current={current}>{content}</Link>;
  }

  const adminPrimary=adminNavigationItems(adminIdentity?.role);
  return <>
    {role==='firma'&&<OperationalInbox/>}
    <button ref={toggle} type="button" className="workspace-menu-toggle" aria-expanded={open} aria-controls={menuId} onClick={()=>setOpen(!open)}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
      <span><UiText text={open?'Închide meniul':'Meniu'}/></span>
    </button>
    <UiElement as="nav" ref={navigation} id={menuId} className={`workspace-nav ${open?'workspace-nav-open':''}`} aria-label={`Navigare ${role}`}>
      {role!=='firma'&&<div className="workspace-nav-primary">
        {role==='client'&&CLIENT_NAVIGATION_ITEMS.map((item,index)=>link({...item,icon:clientIcons[index]}))}
        {role==='admin'&&(['operations','administration'] as const).map(group=>{
          const items=adminPrimary.filter(item=>item.group===group);
          return items.length>0&&<div key={group} className="workspace-nav-group"><p className="workspace-nav-group-label"><UiText text={group==='operations'?'Operațiuni':'Administrare'}/></p>{items.map(item=>link(item))}</div>;
        })}
      </div>}
      {role==='firma'&&firmItems.map(item=>link(item))}
      {role==='client'&&<>
        <div className="workspace-nav-utilities">
          <Link className="workspace-booking-action" href="/client#sec-form" onClick={()=>activate('/client#sec-form')}><DesignIcon name="plus" size={18}/><UiText text="Rezervă o curățenie"/></Link>
        </div>
        <details className="workspace-nav-secondary">
          <summary><UiText text="Mai multe opțiuni"/></summary>
          {clientOptions.map(group=><details key={group.label} className="workspace-nav-secondary-group"><summary><UiText text={group.label}/></summary>{group.items.map(item=>link(item,true))}</details>)}
          {link({label:'Preferințe și notificări',href:'/client/setari',icon:'settings'},true)}
        </details>
        <OperationalInbox/>
      </>}
      {role==='admin'&&<div className="workspace-nav-utilities">
        {adminIdentity&&hasAdminPermission(adminIdentity.role,'manage')&&link({label:'Setări',href:'/admin/setari',icon:'settings'})}
        <UiElement as={Link} className="workspace-nav-item" href="/" target="_blank" rel="noopener noreferrer" aria-label="Website public — se deschide într-o filă nouă"><DesignIcon name="home" size={22}/><span className="workspace-nav-label"><UiText text="Website public ↗"/></span></UiElement>
      </div>}
    </UiElement>
  </>;
}
