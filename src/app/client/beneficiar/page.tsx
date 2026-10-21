import Link from 'next/link';
import {BeneficiaryVisits} from '@/components/FamilyBooking';
export const metadata={title:'Programări partajate — NÍTIDO',robots:{index:false,follow:false},referrer:'no-referrer'};
export default function Page(){return <main className="design-container max-w-3xl py-10"><Link href="/client">Contul meu</Link><h1 className="text-2xl font-bold my-6">Programări pentru mine</h1><BeneficiaryVisits/></main>}
