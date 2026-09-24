import { publicPageMetadata } from "@/lib/publicSeo";
export const metadata = publicPageMetadata("/contact");
import { SupportCenter } from "@/components/SupportCenter";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";



export default function ContactPage() {
  return <main className="bg-[#f7f9fc] text-[#111827]"><SiteHeader/><div className="contact-page-top-spacer" aria-hidden="true"/><div className="contact-page-content"><section className="v2-container pb-10"><div className="v2-eyebrow">CONTACT ȘI SUPORT</div><h1 className="v2-h2 mt-4">Cu ce te putem ajuta?</h1><p className="mt-5 max-w-3xl leading-8 text-[#64748b]">Găsești aici ghidul NITIDO, Asistentul AI și datele de contact ale echipei. Pentru o lucrare existentă, pregătește identificatorul rezervării și descrie situația concretă, ca solicitarea să poată fi verificată în contextul potrivit.</p></section><SupportCenter/></div><SiteFooter/></main>;
}
