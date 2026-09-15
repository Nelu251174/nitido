import { publicPageMetadata } from "@/lib/publicSeo";
export const metadata = publicPageMetadata("/contact");
import { SupportCenter } from "@/components/SupportCenter";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";



export default function ContactPage() {
  return <main className="bg-[#f7f9fc] text-[#111827]"><SiteHeader/><div className="contact-page-top-spacer" aria-hidden="true"/><div className="contact-page-content"><SupportCenter/></div><SiteFooter/></main>;
}
