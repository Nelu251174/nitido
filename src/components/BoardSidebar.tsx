import {UiText} from '@/components/UiText';
import Link from 'next/link';
import {WorkspaceNav} from './WorkspaceNav';
import {DesignIcon} from './DesignIcon';
import type {AdminIdentity} from '@/lib/adminRolesShared';

export function BoardSidebar({role,marketing=false,adminIdentity}:{role:'firma'|'admin';marketing?:boolean;adminIdentity?:AdminIdentity}) {
  return <aside className="board-sidebar">
    <Link className="design-wordmark" href={role==='admin'?'/admin':'/firma'} aria-label={role==='admin'?'NITIDO.RO — Panoul ADMIN':'NITIDO.RO'}><UiText text="NITIDO"/><span><span><UiText text=".RO"/></span></span></Link>
    <p className="board-role"><UiText text={role==='firma'?'PARTENER':'ADMIN'}/></p>
    <WorkspaceNav role={role} marketing={role==='admin'&&marketing} adminIdentity={adminIdentity}/>
    {role==='firma'&&<div className="board-sidebar-note"><DesignIcon name="leaf" size={32}/><b><UiText text="Împreună pentru spații mai curate."/></b><p><UiText text="Mai multă ordine, în fiecare zi."/></p></div>}
    <Link className="board-help" href="/contact" target={role==='admin'?'_blank':undefined} rel={role==='admin'?'noopener noreferrer':undefined} aria-label={role==='admin'?'Ajutor — se deschide într-o filă nouă':undefined}><DesignIcon name="help" size={20}/><UiText text="Ajutor"/></Link>
  </aside>;
}
