import {requireAdminWorkspacePermission} from '@/components/AdminWorkspacePage';
import {AdminWorkspaceShell} from '@/components/AdminWorkspaceShell';
import {AdminWorkspaceFinance} from '@/components/AdminWorkspaceSections';
export const dynamic='force-dynamic';
export default async function Page(){const identity=await requireAdminWorkspacePermission('finance');return <AdminWorkspaceShell identity={identity} title="Financiar" description="Plata, transferul și viramentul sunt urmărite separat."><AdminWorkspaceFinance identity={identity}/></AdminWorkspaceShell>;}
