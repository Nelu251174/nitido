import Link from "next/link";
export const metadata={title:"Carduri | NITIDO",robots:{index:false,follow:false}};
export default function CardReturn(){return <main className="mx-auto max-w-lg p-6 pt-24"><h1 className="text-2xl font-bold">Revino în aplicația NITIDO</h1><p className="mt-4">După completarea formularului Stripe, revino la cardurile tale și apasă Verifică adăugarea. Cardul apare în cont după confirmare.</p><p className="mt-3">Dacă ai anulat, cardurile existente sunt păstrate.</p><Link className="mt-6 inline-block underline" href="/client">Deschide contul pe website</Link></main>}
