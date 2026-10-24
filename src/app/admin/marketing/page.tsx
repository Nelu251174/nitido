import { notFound, redirect } from 'next/navigation';
import { isAdmin } from '@/lib/adminAuth';
import { marketingEnabled } from '@/lib/adminMarketing';
import { AdminMarketing } from '@/components/AdminMarketing';

export const dynamic = 'force-dynamic';
export default async function MarketingPage() {
  if (!marketingEnabled()) notFound();
  if (!await isAdmin('super_admin')) redirect('/admin');
  return <AdminMarketing testEnvironment={process.env.NEXT_PUBLIC_SITE_URL !== 'https://nitido.ro'} />;
}
