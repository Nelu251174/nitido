import {localizeMetadata} from '@/i18n/server';
import {UiText} from '@/components/UiText';
import Link from "next/link";
const sourceMetadata={title:"Carduri | NITIDO",robots:{index:false,follow:false}};
export default function CardReturn(){return <main className="mx-auto max-w-lg p-6 pt-24"><h1 className="text-2xl font-bold"><UiText text={"Revino în aplicația NITIDO"}/></h1><p className="mt-4"><UiText text={"După completarea formularului Stripe, revino la cardurile tale și apasă Verifică adăugarea. Cardul apare în cont după confirmare."}/></p><p className="mt-3"><UiText text={"Dacă ai anulat, cardurile existente sunt păstrate."}/></p><Link className="mt-6 inline-block underline" href="/client"><UiText text={"Deschide contul pe website"}/></Link></main>}

export async function generateMetadata() { return localizeMetadata(sourceMetadata); }
