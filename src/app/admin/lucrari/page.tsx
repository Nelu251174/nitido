import {requireAdminWorkspacePermission} from '@/components/AdminWorkspacePage';
import {AdminWorkspaceShell} from '@/components/AdminWorkspaceShell';
import {AdminWorkspaceJobs} from '@/components/AdminWorkspaceJobs';
export const dynamic='force-dynamic';
export default async function Page(){const identity=await requireAdminWorkspacePermission('operations');return <AdminWorkspaceShell identity={identity} title="Lucrări" description="Găsește rezervarea și păstrează toate detaliile în același context."><AdminWorkspaceJobs identity={identity}/></AdminWorkspaceShell>;}
