import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InformationPage } from "@/components/InformationPage";
import { CITIES, getCity } from "@/lib/cities";
import { calcGrossPrice } from "@/lib/pricing";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nitido.ro";

export function generateStaticParams() {
  return CITIES.map((c) => ({ oras: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ oras: string }> }): Promise<Metadata> {
  const { oras } = await params;
  const city = getCity(oras);
  if (!city) return {};
  const title = `Curățenie ${city.prepositional} — firme verificate, preț fix`;
  const description = `Servicii de curățenie ${city.prepositional}: postezi lucrarea pentru apartament, casă sau birou și firmele verificate din ${city.name} sunt notificate instant. Preț afișat de la început, plată securizată.`;
  return {
    title,
    description,
    alternates: { canonical: `/curatenie/${city.slug}` },
    openGraph: { title: `${title} — NITIDO.RO`, description, url: `${SITE_URL}/curatenie/${city.slug}`, type: "website" },
  };
}

export default async function CityPage({ params }: { params: Promise<{ oras: string }> }) {
  const { oras } = await params;
  const city = getCity(oras);
  if (!city) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Servicii de curățenie la cerere",
    areaServed: { "@type": "City", name: city.name },
    provider: { "@type": "Organization", name: "NITIDO.RO", url: SITE_URL },
    url: `${SITE_URL}/curatenie/${city.slug}`,
    description: `Curățenie ${city.prepositional} — postezi lucrarea, firmele verificate din zonă sunt notificate instant.`,
  };

  const otherCities = CITIES.filter((c) => c.slug !== city.slug).map((c) => c.name).join(", ");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <InformationPage
        eyebrow={`Curățenie · ${city.county}`}
        title={`Curățenie ${city.prepositional}`}
        intro={city.intro}
        cta={{ label: "Postează o lucrare", href: "/signup?role=client" }}
        sections={[
          {
            title: "Cum funcționează",
            items: [
              `Postezi lucrarea (adresă ${city.prepositional}, tip spațiu, suprafață) și vezi prețul înainte de publicare.`,
              "Firmele verificate din zonă sunt notificate simultan. Prima care apasă Accept preia lucrarea.",
              "Plata se rezervă la acceptare și se decontează după finalizarea confirmată.",
            ],
          },
          {
            title: "Preț orientativ apartament",
            paragraphs: [
              `Prețul e fix, calculat din suprafață — același pe care-l vede și firma. Orientativ ${city.prepositional}: până în 40 mp ~${calcGrossPrice("apartament", 40)} lei, până în 60 mp ~${calcGrossPrice("apartament", 60)} lei, până în 80 mp ~${calcGrossPrice("apartament", 80)} lei, până în 100 mp ~${calcGrossPrice("apartament", 100)} lei.`,
              "Case, birouri și alte spații se calculează pe metru pătrat. Vezi regulile complete de preț pe pagina de prețuri.",
            ],
          },
          {
            title: "Zone acoperite",
            paragraphs: [
              `Firmele își setează aria de acoperire și primesc doar lucrările relevante. Acoperim printre altele: ${city.areas.join(", ")}.`,
            ],
          },
          {
            title: "De ce NITIDO.RO",
            items: [
              "Firme verificate, cu rating public și istoric.",
              "Preț fix, fără licitație și fără negociere ulterioară.",
              "Plată securizată — banii se mișcă doar când lucrarea chiar se întâmplă.",
              `Disponibil și în alte orașe: ${otherCities}.`,
            ],
          },
        ]}
      />
    </>
  );
}
