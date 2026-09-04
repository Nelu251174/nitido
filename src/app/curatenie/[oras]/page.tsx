import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { CITIES, getCity } from "@/lib/cities";
import { calcGrossPrice } from "@/lib/pricing";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nitido.ro";

// Pre-generează o pagină statică pentru fiecare oraș din lista comună.
export function generateStaticParams() {
  return CITIES.map((c) => ({ oras: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ oras: string }>;
}): Promise<Metadata> {
  const { oras } = await params;
  const city = getCity(oras);
  if (!city) return {};
  const title = `Curățenie ${city.prepositional} — firme verificate, preț fix`;
  const description = `Servicii de curățenie ${city.prepositional}: postezi lucrarea pentru apartament, casă sau birou și firmele verificate din ${city.name} primesc alertă instant. Preț afișat de la început, plată securizată prin Stripe.`;
  return {
    title,
    description,
    alternates: { canonical: `/curatenie/${city.slug}` },
    openGraph: { title: `${title} — Nitido`, description, url: `${SITE_URL}/curatenie/${city.slug}`, type: "website" },
  };
}

// Grilă de preț reală pentru apartamente (aceeași în toată țara) — din pricing.ts.
const APARTMENT_SAMPLES = [40, 60, 80, 100];

export default async function CityPage({
  params,
}: {
  params: Promise<{ oras: string }>;
}) {
  const { oras } = await params;
  const city = getCity(oras);
  if (!city) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Servicii de curățenie la cerere",
    areaServed: { "@type": "City", name: city.name },
    provider: {
      "@type": "Organization",
      name: "Nitido",
      url: SITE_URL,
    },
    url: `${SITE_URL}/curatenie/${city.slug}`,
    description: `Curățenie ${city.prepositional} — postezi lucrarea, firmele verificate din zonă primesc alertă instant.`,
  };

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="glass sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex gap-3 text-sm font-display font-bold items-center">
            <Link href="/login" className="px-4 py-2 rounded-full hover:bg-ink/5 transition">
              Autentificare
            </Link>
            <Link href="/signup?role=client" className="px-4 py-2 rounded-full btn-aurora text-white transition hover:-translate-y-0.5">
              Postează o lucrare
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mesh-dark relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 -right-16 w-[28rem] h-[28rem] rounded-full bg-aqua/25 blur-3xl animate-blob" />
        <div className="relative max-w-5xl mx-auto px-6 py-20 md:py-24">
          <nav className="text-sm text-white/50 mb-6" aria-label="breadcrumb">
            <Link href="/" className="hover:text-white/80 transition">Acasă</Link>
            <span className="mx-2">/</span>
            <span className="text-white/80">Curățenie {city.name}</span>
          </nav>
          <span className="inline-block glass-dark rounded-full px-3 py-1 text-[12px] font-display font-bold text-aqua mb-6">
            {city.county}
          </span>
          <h1 className="font-display font-extrabold text-4xl md:text-5xl text-white leading-tight max-w-3xl">
            Curățenie {city.prepositional} — <span className="text-gradient text-gradient-animated">prima firmă</span> care acceptă o preia
          </h1>
          <p className="text-white/60 text-lg mt-6 max-w-2xl leading-relaxed">{city.intro}</p>
          <div className="flex flex-wrap gap-4 mt-10">
            <Link href="/signup?role=client" className="px-6 py-3.5 rounded-full btn-aurora text-white font-display font-bold transition hover:-translate-y-0.5">
              Postează o lucrare
            </Link>
            <Link href="/signup?role=firma" className="px-6 py-3.5 rounded-full glass-dark text-white font-display font-bold hover:bg-white/10 transition">
              Înregistrează-ți firma {city.prepositional}
            </Link>
          </div>
        </div>
      </section>

      {/* PRET */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <span className="text-xs font-display font-bold text-aqua-deep uppercase tracking-wide">Preț transparent</span>
        <h2 className="font-display font-extrabold text-3xl text-ink mt-2">Cât costă curățenia unui apartament {city.prepositional}</h2>
        <p className="text-muted mt-4 max-w-2xl leading-relaxed">
          Prețul e fix, pe o grilă în funcție de suprafață — același pe care-l vede și firma care acceptă. Fără licitație, fără negociere după.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          {APARTMENT_SAMPLES.map((sqm) => (
            <div key={sqm} className="rounded-2xl border border-line bg-white p-5 text-center shadow-[0_1px_2px_rgba(20,37,48,0.04),0_8px_24px_-12px_rgba(20,37,48,0.1)]">
              <div className="text-xs text-muted">Apartament până în {sqm} mp</div>
              <div className="font-display font-extrabold text-2xl text-ink mt-1">{calcGrossPrice("apartament", sqm)} lei</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted mt-4">Case, birouri și alte spații se calculează pe mp. Vezi calculatorul complet pe <Link href="/#calculator" className="text-aqua-deep underline">pagina principală</Link>.</p>
      </section>

      {/* ZONE */}
      <section className="mesh-light border-y border-line">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="font-display font-extrabold text-2xl text-ink">Zone acoperite {city.prepositional}</h2>
          <p className="text-muted mt-3 max-w-2xl">Firmele își setează aria de acoperire, așa că primesc doar lucrările relevante pentru zona lor:</p>
          <div className="flex flex-wrap gap-2.5 mt-6">
            {city.areas.map((a) => (
              <span key={a} className="rounded-full border border-line bg-white px-4 py-1.5 text-sm text-ink">{a}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CUM FUNCTIONEAZA */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="font-display font-extrabold text-3xl text-ink mb-10">Cum funcționează {city.prepositional}</h2>
        <div className="grid md:grid-cols-3 gap-10">
          {[
            ["1", "Postezi lucrarea", `Adresă ${city.prepositional}, tip spațiu, suprafață — prețul apare instant.`],
            ["2", "O firmă acceptă", "Firmele verificate din zonă primesc alerta simultan. Prima care apasă „Accept” o preia."],
            ["3", "Plata se decontează", "Banii se rezervă la acceptare și ajung la firmă abia după finalizarea confirmată."],
          ].map(([n, t, d]) => (
            <div key={n}>
              <div className="w-10 h-10 rounded-full btn-aurora text-white font-display font-bold flex items-center justify-center mb-4">{n}</div>
              <h3 className="font-display font-bold text-lg text-ink mb-2">{t}</h3>
              <p className="text-sm text-muted leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap gap-4">
          <Link href="/signup?role=client" className="px-6 py-3.5 rounded-full btn-aurora text-white font-display font-bold transition hover:-translate-y-0.5">
            Postează o lucrare {city.prepositional}
          </Link>
        </div>
      </section>

      {/* ALTE ORASE */}
      <section className="border-t border-line bg-mist">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <h2 className="font-display font-bold text-sm uppercase tracking-wide text-muted mb-4">Curățenie în alte orașe</h2>
          <div className="flex flex-wrap gap-2.5">
            {CITIES.filter((c) => c.slug !== city.slug).map((c) => (
              <Link key={c.slug} href={`/curatenie/${c.slug}`} className="rounded-full border border-line bg-white px-4 py-1.5 text-sm text-ink hover:border-aqua transition">
                {c.name}
              </Link>
            ))}
          </div>
          <div className="mt-8 text-sm text-muted">
            <Link href="/" className="text-aqua-deep underline">← Înapoi la pagina principală Nitido</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
