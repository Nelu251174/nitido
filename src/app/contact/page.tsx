import type { Metadata } from "next";
import { SupportCenter } from "@/components/SupportCenter";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Contact și suport | NITIDO.RO",
  description: "Asistent AI, suport telefonic și email pentru clienții și firmele NITIDO.RO.",
};

export default function ContactPage() {
  return <main className="bg-[#f4f3ee] text-[#101711]"><SiteHeader/><div className="contact-page-top-spacer" aria-hidden="true"/><div className="contact-page-content"><SupportCenter/></div><SiteFooter/></main>;
}
