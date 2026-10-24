import { notFound } from 'next/navigation';
import { marketingEnabled } from '@/lib/adminMarketing';
import { MarketingUnsubscribe } from '@/components/MarketingUnsubscribe';
export const metadata={robots:{index:false,follow:false},referrer:'no-referrer' as const};
export const dynamic='force-dynamic';
export default function Page(){if(!marketingEnabled())notFound();return <MarketingUnsubscribe/>;}
