'use client';

import {useState, type ReactNode} from 'react';
import Link from 'next/link';
import {BoardSidebar} from './BoardSidebar';
import {AdminNotificationBell} from './AdminNotificationBell';
import {UiElement,UiText} from './UiText';
import {ADMIN_ROLES, type AdminIdentity} from '@/lib/adminRolesShared';

export function AdminWorkspaceShell({identity,title,description,children}:{identity:AdminIdentity;title:string;description:string;children:ReactNode}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function logout(){
    if(busy)return;
    setBusy(true);setError('');
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- A document navigation drops all protected client state after logout.
    try{const r=await fetch('/api/admin/auth/logout',{method:'POST'});if(!r.ok)throw Error();window.location.assign('/admin');}
    catch{setError('Deconectarea nu a fost confirmată. Încearcă din nou.');setBusy(false);}
  }
  return <div className="workspace-redesign workspace-redesign-admin board-page board-admin">
    <BoardSidebar role="admin" marketing={identity.role==='super_admin'} adminIdentity={identity}/>
    <div className="workspace-redesign-main">
      <header className="workspace-redesign-header">
        <div><p className="workspace-redesign-eyebrow"><Link href="/admin"><UiText text="Administrare"/></Link><span aria-hidden="true"> / </span><UiText text={title}/></p><h1>{<UiText text={title}/>}</h1><p><UiText text={description}/></p></div>
        <div className="workspace-redesign-actions"><div className="workspace-redesign-identity"><strong>{identity.email}</strong><small><UiText text={ADMIN_ROLES[identity.role]}/></small></div>{identity.role==='super_admin'&&<AdminNotificationBell/>}<button type="button" className="v2-btn v2-btn-secondary" disabled={busy} onClick={()=>void logout()}><UiText text={busy?'Se închide sesiunea…':'Deconectare ADMIN'}/></button></div>
      </header>
      {error&&<p className="workspace-redesign-context" role="alert"><UiText text={error}/></p>}
      <main className="workspace-redesign-content" id="admin-content">{children}</main>
    </div>
  </div>;
}

export function AdminWorkspaceTabs({items,active}:{items:readonly {key:string;label:string;href:string}[];active:string}){
  return <UiElement as="nav" className="workspace-redesign-section-nav" aria-label="Secțiunile paginii">{items.map(item=><Link key={item.key} href={item.href} aria-current={active===item.key?'page':undefined}><UiText text={item.label}/></Link>)}</UiElement>;
}
