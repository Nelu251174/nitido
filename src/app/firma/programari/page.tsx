import Link from 'next/link';
import {FirmAppointments} from '@/components/FirmAppointments';
import {UiText} from '@/components/UiText';
export default function Page(){return <main id="main-content" className="design-container max-w-4xl py-10"><Link href="/firma"><UiText text="Contul firmei"/></Link><h1 className="text-2xl font-bold my-6"><UiText text="Programările mele"/></h1><FirmAppointments/></main>}
