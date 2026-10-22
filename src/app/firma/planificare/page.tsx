import Link from 'next/link';
import {ProviderPlanning} from '@/components/ProviderPlanning';
import {UiText} from '@/components/UiText';
export default function Page(){return <main id="main-content" className="design-container py-10"><Link href="/firma"><UiText text="Contul firmei"/></Link><h1 className="text-2xl font-bold my-6"><UiText text="Planificarea firmei"/></h1><ProviderPlanning/></main>}
