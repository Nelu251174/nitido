import {UiText} from '@/components/UiText';
import Link from 'next/link';
import {ProviderWeekSlots} from '@/components/WeekAvailability';
export default function Page(){return <main className="design-container max-w-4xl py-10"><Link href="/firma"><UiText text={"Contul firmei"}/></Link><h1 className="text-2xl font-bold my-6"><UiText text={"Intervale libere pentru săptămâna aceasta"}/></h1><Link className="v2-btn mb-6" href="/firma/planificare"><UiText text={"Vezi planificarea firmei · NEW"}/></Link><ProviderWeekSlots/></main>}
