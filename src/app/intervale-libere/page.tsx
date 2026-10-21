import Link from 'next/link';
import {WeekAvailability} from '@/components/WeekAvailability';
import {NewBadge} from '@/components/NewBadge';
export const dynamic='force-dynamic';
export default function Page(){return <main className="design-container max-w-4xl py-10"><Link href="/">NÍTIDO · Acasă</Link><h1 className="text-3xl font-bold my-6">Am liber săptămâna aceasta <NewBadge/></h1><WeekAvailability/></main>}
