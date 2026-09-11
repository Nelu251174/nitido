import type { Metadata } from "next";
import { SupportCenter } from "@/components/SupportCenter";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Contact și suport | NITIDO.RO",
  description: "Asistent AI, suport telefonic și email pentru clienții și firmele NITIDO.RO.",
};

export default function ContactPage() {
  return <main className="bg-[#f7f9fc] text-[#111827]"><SiteHeader/><div className="contact-page-top-spacer" aria-hidden="true"/><div className="contact-page-content"><SupportCenter/></div><SiteFooter/></main>;
}
