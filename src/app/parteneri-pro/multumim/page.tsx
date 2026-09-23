import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";

export default function PartnerThanks() {
  return (
    <div>
      <SiteHeader />
      <main className="max-w-xl mx-auto px-6 py-20">
        <h1 className="font-display font-extrabold text-3xl text-ink">Candidatura a fost înregistrată.</h1>
        <p className="text-muted mt-4">
          Aplicarea nu activează automat colaborarea și nu garantează volum de lucrări.
          Un operator NITIDO verifică zona, categoria și datele transmise.
        </p>
        <Link href="/" className="inline-block mt-8 text-aqua-deep font-semibold">Înapoi acasă</Link>
      </main>
      <SiteFooter />
    </div>
  );
}
