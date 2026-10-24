import { notFound } from 'next/navigation';
import { adminPasswordRecoveryEnabled } from '@/lib/adminPasswordCredentials';
import { AdminPasswordRecovery } from '@/components/AdminPasswordRecovery';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Recuperare parolă ADMIN — NITIDO', referrer: 'no-referrer' as const, robots: { index: false, follow: false } };
export default function Page() {
  if (!adminPasswordRecoveryEnabled()) notFound();
  return <AdminPasswordRecovery/>;
}
