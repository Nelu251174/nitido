import Link from 'next/link';
import {requireAdminWorkspacePermission} from '@/components/AdminWorkspacePage';
import {AdminWorkspaceShell} from '@/components/AdminWorkspaceShell';
import {AdminWorkspaceDashboard} from '@/components/AdminWorkspaceDashboard';
import {RetentionOverview} from '@/components/RetentionOverview';
import {retentionMetrics} from '@/lib/retentionMetrics';
import {db} from '@/lib/db';
import {UiText} from '@/components/UiText';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const identity=await requireAdminWorkspacePermission('operations'),query=await searchParams;return <AdminWorkspaceShell identity={identity} title="Atenție azi" description="Semnale grupate pe lucrare, cu motiv și următorul pas."><nav className="workspace-redesign-section-nav"><Link href="/admin/azi" aria-current={query.tab!=='retentie'?'page':undefined}><UiText text="Semnale de atenție"/></Link><Link href="/admin/azi?tab=retentie" aria-current={query.tab==='retentie'?'page':undefined}><UiText text="Revenire clienți"/></Link></nav>{query.tab==='retentie'?<RetentionOverview report={retentionMetrics(db)}/>:<AdminWorkspaceDashboard allAttention/>}</AdminWorkspaceShell>;}
