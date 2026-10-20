import type { Metadata } from "next";
import {getUiText} from "@/i18n/server";
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
  const t=await getUiText();
  const title = t("Curățenie în {p0} — firme verificate, preț fix",[city.name]);
  const description = t("Servicii de curățenie în {p0}: postezi lucrarea pentru apartament, casă sau birou cu disponibilitate confirmată pentru fiecare cerere. Preț afișat înainte de confirmare, plată securizată.",[city.name]);
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

  const t=await getUiText();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: t("Servicii de curățenie la cerere"),
    areaServed: { "@type": "City", name: city.name },
    provider: { "@type": "Organization", name: "NITIDO.RO", url: SITE_URL },
    url: `${SITE_URL}/curatenie/${city.slug}`,
    description: t("Curățenie în {p0} — publici cererea; alocarea depinde de disponibilitatea și acceptarea validă a unei firme eligibile.",[city.name]),
  };

  const otherCities = CITIES.filter((c) => c.slug !== city.slug).map((c) => c.name).join(", ");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g,"\\u003c") }} />
      <InformationPage
        eyebrow={t("Curățenie · {p0}",[city.county])}
        title={t("Curățenie în {p0}",[city.name])}
        intro={city.intro}
        cta={{ label: "Postează o lucrare", href: "/signup?role=client" }}
        sections={[
          {
            title: "Cum funcționează",
            items: [
              t("Postezi lucrarea (adresă în {p0}, tip spațiu, suprafață) și vezi prețul înainte de publicare.",[city.name]),
              "La Standard alegi firma dintre ofertele disponibile. La Express, lucrarea poate fi preluată de o firmă eligibilă, în funcție de disponibilitate și de acceptarea validă. Condițiile și costul sunt afișate înainte de confirmare.",
              "La acceptare se autorizează HOLD-ul. Capturarea plății urmează finalizarea validă a lucrării; sosirea banilor în contul bancar depinde de procesator și de bancă.",
            ],
          },
          {
            title: "Preț orientativ apartament",
            paragraphs: [
              t("Totalul clientului se calculează din suprafață; suma firmei ține cont de comisionul contractual. Orientativ în {p0}: până în 40 mp ~{p1} lei, până în 60 mp ~{p2} lei, până în 80 mp ~{p3} lei, până în 100 mp ~{p4} lei.",[city.name,...[40,60,80,100].map(sqm=>calcGrossPrice("apartament",sqm))]),
              "Case, birouri și alte spații se calculează pe metru pătrat. Vezi regulile complete de preț pe pagina de prețuri.",
            ],
          },
          {
            title: "Zone și disponibilitate",
            paragraphs: [
              t("Zone orientative: {p0}. Firmele își configurează aria de acoperire. Existența acestei pagini nu garantează acoperire operațională sau o echipă disponibilă; acestea se confirmă pentru cererea ta.",[city.areas.join(", ")]),
            ],
          },
          {
            title: "De ce NITIDO.RO",
            items: [
              "Firme verificate, cu rating public și istoric.",
              "Preț fix, fără licitație și fără negociere ulterioară.",
              "Plată securizată — banii se mișcă doar când lucrarea chiar se întâmplă.",
              t("Consultă și informațiile despre alte orașe: {p0}.",[otherCities]),
            ],
          },
        ]}
      />
    </>
  );
}
