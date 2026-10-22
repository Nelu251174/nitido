import Link from 'next/link';
import {HomeRoutine} from '@/components/HomeRoutine';
import {UiText} from '@/components/UiText';
export default function Page(){return <main id="main-content" className="design-container max-w-4xl py-10"><Link href="/client"><UiText text="Contul meu"/></Link><h1 className="text-2xl font-bold my-6"><UiText text="Rutina casei mele"/></h1><p className="mb-6 leading-7"><UiText text="Planifici vizitele, verifici programul și pregătești pauza de vacanță. Alegerea firmei și confirmarea plății rămân separate pentru fiecare vizită."/></p><HomeRoutine/></main>}
