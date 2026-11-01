import {requireAdminWorkspacePermission} from '@/components/AdminWorkspacePage';
import {AdminWorkspaceShell} from '@/components/AdminWorkspaceShell';
import {AdminInternationalCosts} from '@/components/AdminInternationalCosts';
export const dynamic='force-dynamic';
export default async function Page(){
 const identity=await requireAdminWorkspacePermission('finance');
 return <AdminWorkspaceShell identity={identity} title="Costuri internaționale" description="Cost complet și oferte locale în pregătire. Publicarea rămâne blocată."><AdminInternationalCosts/></AdminWorkspaceShell>;
}
