import {UiText} from '@/components/UiText';
import Link from 'next/link';
import {AvailabilityAlerts} from '@/components/AvailabilityAlerts';
import {NewBadge} from '@/components/NewBadge';
export const metadata={title:'Alerte de disponibilitate — NÍTIDO',robots:{index:false,follow:false}};
export default function Page(){return <main className="design-container max-w-3xl py-10"><Link href="/client"><UiText text={"Acasă în cont"}/></Link><h1 className="text-2xl font-bold my-6"><UiText text={"Alerte de disponibilitate "}/><NewBadge/></h1><AvailabilityAlerts/></main>}
