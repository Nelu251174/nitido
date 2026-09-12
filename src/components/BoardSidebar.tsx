import Link from 'next/link';
import {WorkspaceNav} from './WorkspaceNav';
import {DesignIcon} from './DesignIcon';
export function BoardSidebar({role}:{role:'firma'|'admin'}){return <aside className="board-sidebar"><Link className="design-wordmark" href="/">NITIDO<span><span>.RO</span></span></Link><p className="board-role">{role==='firma'?'PARTENER':'ADMIN'}</p><WorkspaceNav role={role}/><div className="board-sidebar-note"><DesignIcon name="leaf" size={32}/><b>Împreună pentru spații mai curate.</b><p>Mai multă ordine, în fiecare zi.</p></div><Link className="board-help" href="/contact"><DesignIcon name="help" size={20}/>Ajutor</Link></aside>}
