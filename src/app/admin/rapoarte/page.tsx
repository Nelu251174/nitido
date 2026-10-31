import {requireAdminWorkspacePermission} from '@/components/AdminWorkspacePage';
import {AdminWorkspaceShell,AdminWorkspaceTabs} from '@/components/AdminWorkspaceShell';
import {AdminWorkspaceReports} from '@/components/AdminWorkspaceSections';
import {RetentionOverview} from '@/components/RetentionOverview';
import {retentionMetrics} from '@/lib/retentionMetrics';
import {db} from '@/lib/db';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const identity=await requireAdminWorkspacePermission('reports'),query=await searchParams;return <AdminWorkspaceShell identity={identity} title="Rapoarte" description="Rezultate operaționale, calitate și evoluția rezervărilor.">{query.tab==='retentie'?<><AdminWorkspaceTabs active="retentie" items={[{key:'operational',label:'Performanță operațională',href:'/admin/rapoarte'},{key:'prestatori',label:'Calitatea prestatorilor',href:'/admin/rapoarte?tab=prestatori'},{key:'rezervari',label:'Progresul rezervărilor',href:'/admin/raport-rezervari'},{key:'retentie',label:'Revenire clienți',href:'/admin/rapoarte?tab=retentie'}]}/><RetentionOverview report={retentionMetrics(db)}/></>:<AdminWorkspaceReports identity={identity}/>}</AdminWorkspaceShell>;}
