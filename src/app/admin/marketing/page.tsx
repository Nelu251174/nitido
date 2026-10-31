import { notFound, redirect } from 'next/navigation';
import { getAdminIdentity } from '@/lib/adminAuth';
import { AdminWorkspaceShell } from '@/components/AdminWorkspaceShell';
import { marketingEnabled } from '@/lib/adminMarketing';
import { AdminMarketing } from '@/components/AdminMarketing';

export const dynamic = 'force-dynamic';
export default async function MarketingPage() {
  if (!marketingEnabled()) notFound();
  const identity = await getAdminIdentity();
  if (identity?.role !== 'super_admin') redirect('/admin');
  return <AdminWorkspaceShell identity={identity} title="Marketing" description="Contacte, colectare și campanii, organizate pe județe.">
    <AdminMarketing embedded testEnvironment={process.env.NEXT_PUBLIC_SITE_URL !== 'https://nitido.ro'} />
  </AdminWorkspaceShell>;
}
