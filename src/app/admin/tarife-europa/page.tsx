import type {Metadata} from 'next';
import {requireAdminWorkspacePermission} from '@/components/AdminWorkspacePage';
import {AdminWorkspaceShell} from '@/components/AdminWorkspaceShell';
import {InternationalTariffReview} from '@/components/InternationalTariffReview';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Revizie tarife Europa',robots:{index:false,follow:false}};

export default async function Page(){
 const identity=await requireAdminWorkspacePermission('super_admin');
 return <AdminWorkspaceShell identity={identity} title="Tarife Europa" description="Dovezi locale, propuneri și verificări înainte de activarea piețelor noi."><InternationalTariffReview/></AdminWorkspaceShell>;
}
