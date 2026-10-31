import {requireAdminWorkspacePermission} from '@/components/AdminWorkspacePage';
import {AdminWorkspaceShell} from '@/components/AdminWorkspaceShell';
import {AdminWorkspaceClients} from '@/components/AdminWorkspaceSections';
export const dynamic='force-dynamic';
export default async function Page(){const identity=await requireAdminWorkspacePermission('incidents');return <AdminWorkspaceShell identity={identity} title="Clienți" description="Conturi, rezervări și istoric operațional, în fișa fiecărui client."><AdminWorkspaceClients identity={identity}/></AdminWorkspaceShell>;}
