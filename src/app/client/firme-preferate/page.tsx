import {UiText} from '@/components/UiText';
import Link from 'next/link';
import {FavoriteFirms} from '@/components/FavoriteFirms';
import {NewBadge} from '@/components/NewBadge';
export const metadata={title:'Firmele mele preferate — NÍTIDO',robots:{index:false,follow:false}};
export default function Page(){return <main className="design-container max-w-3xl py-10"><Link href="/client"><UiText text={"Acasă în cont"}/></Link><h1 className="text-2xl font-bold my-6"><UiText text={"Firmele mele preferate "}/><NewBadge/></h1><FavoriteFirms/></main>}
