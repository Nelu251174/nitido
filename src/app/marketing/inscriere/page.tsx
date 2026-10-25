import {notFound} from 'next/navigation';
import {marketingEnabled} from '@/lib/adminMarketing';
import {MarketingSignup} from '@/components/MarketingSignup';
export const metadata={title:'Noutăți NITIDO pentru zona ta',referrer:'no-referrer' as const};
export const dynamic='force-dynamic';
export default function Page(){if(!marketingEnabled())notFound();return <MarketingSignup/>;}
