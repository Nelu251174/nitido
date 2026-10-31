import {requireAdminWorkspacePermission} from '@/components/AdminWorkspacePage';
import {AdminWorkspaceShell} from '@/components/AdminWorkspaceShell';
import {AdminNotificationBell} from '@/components/AdminNotificationBell';
export const dynamic='force-dynamic';
export default async function Page(){const identity=await requireAdminWorkspacePermission('super_admin');return <AdminWorkspaceShell identity={identity} title="Notificări" description="Evenimente, probleme și starea verificării lor."><AdminNotificationBell full/></AdminWorkspaceShell>;}
