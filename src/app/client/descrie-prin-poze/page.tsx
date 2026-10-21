import Link from 'next/link';
import {PhotoDescription} from '@/components/PhotoDescription';
import {NewBadge} from '@/components/NewBadge';
export const metadata={title:'Descrie lucrarea prin poze — NÍTIDO',robots:{index:false,follow:false}};
export default function Page(){return <main className="design-container max-w-3xl py-10"><Link href="/client">Contul meu</Link><h1 className="text-2xl font-bold my-6">Descrie lucrarea prin poze <NewBadge/></h1><PhotoDescription/></main>}
