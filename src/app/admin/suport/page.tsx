import {requireAdminWorkspacePermission} from '@/components/AdminWorkspacePage';
import {AdminWorkspaceShell} from '@/components/AdminWorkspaceShell';
import {AdminWorkspaceSupport} from '@/components/AdminWorkspaceSections';
export const dynamic='force-dynamic';
export default async function Page(){const identity=await requireAdminWorkspacePermission('incidents');return <AdminWorkspaceShell identity={identity} title="Suport și calitate" description="Sesizări, dovezi și următorul pas pentru fiecare lucrare."><AdminWorkspaceSupport identity={identity}/></AdminWorkspaceShell>;}
