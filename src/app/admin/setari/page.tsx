import {requireAdminWorkspacePermission} from '@/components/AdminWorkspacePage';
import {AdminWorkspaceShell} from '@/components/AdminWorkspaceShell';
import {AdminWorkspaceSettings} from '@/components/AdminWorkspaceSections';
export const dynamic='force-dynamic';
export default async function Page(){const identity=await requireAdminWorkspacePermission('manage');return <AdminWorkspaceShell identity={identity} title="Setări" description="Servicii, tarife, proceduri și accesul echipei interne."><AdminWorkspaceSettings identity={identity}/></AdminWorkspaceShell>;}
