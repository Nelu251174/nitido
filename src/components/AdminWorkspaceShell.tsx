'use client';

import {useState, type ReactNode} from 'react';
import Link from 'next/link';
import {BoardSidebar} from './BoardSidebar';
import {AdminNotificationBell} from './AdminNotificationBell';
import {UiElement,UiText} from './UiText';
import {DesignIcon} from './DesignIcon';
import {LanguageSelector} from './LanguageSelector';
import {ADMIN_ROLES,hasAdminPermission, type AdminIdentity} from '@/lib/adminRolesShared';

export function AdminWorkspaceShell({identity,title,description,children}:{identity:AdminIdentity;title:string;description:string;children:ReactNode}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function logout(){
    if(busy)return;
    setBusy(true);setError('');
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- A document navigation drops all protected client state after logout.
    try{const r=await fetch('/api/admin/auth/logout',{method:'POST'});if(!r.ok)throw Error();window.location.assign('/admin');}
    catch{setError('Deconectarea nu a fost confirmată. Încearcă din nou.');setBusy(false);}
  }
  return <div className="workspace-redesign workspace-redesign-admin admin-preview board-page board-admin">
    <BoardSidebar role="admin" marketing={identity.role==='super_admin'} adminIdentity={identity}/>
    <div className="workspace-redesign-main">
      <div className="admin-preview-topbar">
        <div className="admin-preview-breadcrumb"><Link href="/admin"><UiText text="Administrare"/></Link><span aria-hidden="true">/</span><span><UiText text={title}/></span></div>
        {hasAdminPermission(identity.role,'operations')&&<form className="admin-preview-search" action="/admin/lucrari" method="get" role="search"><DesignIcon name="search" size={17}/><UiElement as="input" name="q" aria-label="Caută lucrarea" placeholder="Lucrare, client sau firmă" autoComplete="off"/><button type="submit" aria-label="Caută lucrarea"><DesignIcon name="arrow" size={16}/></button></form>}
        <div className="admin-preview-topbar-tools"><div className="admin-preview-language"><LanguageSelector/></div>{identity.role==='super_admin'&&<AdminNotificationBell/>}<details className="admin-preview-account"><UiElement as="summary" aria-label="Contul meu ADMIN"><span className="admin-preview-avatar" aria-hidden="true">{identity.email.slice(0,1).toUpperCase()}</span><span><strong><UiText text={ADMIN_ROLES[identity.role]}/></strong><small><UiText text="Contul meu"/></small></span><svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="m4 6 4 4 4-4"/></svg></UiElement><div className="admin-preview-account-menu"><strong>{identity.email}</strong><small><UiText text={ADMIN_ROLES[identity.role]}/></small><Link href="/" target="_blank" rel="noopener noreferrer"><DesignIcon name="home" size={16}/><UiText text="Website public ↗"/></Link><button type="button" disabled={busy} onClick={()=>void logout()}><DesignIcon name="arrow" size={16}/><UiText text={busy?'Se închide sesiunea…':'Deconectare ADMIN'}/></button></div></details></div>
      </div>
      <header className="workspace-redesign-header admin-preview-page-heading"><div><h1>{<UiText text={title}/>}</h1><p><UiText text={description}/></p></div></header>
      {error&&<p className="workspace-redesign-context" role="alert"><UiText text={error}/></p>}
      <main className="workspace-redesign-content" id="admin-content">{children}</main>
    </div>
  </div>;
}

export function AdminWorkspaceTabs({items,active}:{items:readonly {key:string;label:string;href:string}[];active:string}){
  return <UiElement as="nav" className="workspace-redesign-section-nav" aria-label="Secțiunile paginii">{items.map(item=><Link key={item.key} href={item.href} aria-current={active===item.key?'page':undefined}><UiText text={item.label}/></Link>)}</UiElement>;
}
