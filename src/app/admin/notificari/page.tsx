import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getAdminActorId} from '@/lib/adminAuth';
import {AdminNotificationBell} from '@/components/AdminNotificationBell';
export const dynamic='force-dynamic';
export default async function Page(){if(!await getAdminActorId())redirect('/admin');return <main className="design-container max-w-5xl py-8"><Link href="/admin" className="v2-btn v2-btn-secondary mb-5">← Înapoi în ADMIN</Link><AdminNotificationBell full/></main>;}
