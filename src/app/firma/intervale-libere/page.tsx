import Link from 'next/link';
import {ProviderWeekSlots} from '@/components/WeekAvailability';
export default function Page(){return <main className="design-container max-w-4xl py-10"><Link href="/firma">Contul firmei</Link><h1 className="text-2xl font-bold my-6">Intervale libere pentru săptămâna aceasta</h1><Link className="v2-btn mb-6" href="/firma/planificare">Vezi planificarea firmei · NEW</Link><ProviderWeekSlots/></main>}
