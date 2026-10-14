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
  const description = t("Servicii de curățenie în {p0}: postezi lucrarea pentru apartament, casă sau birou și firmele verificate din {p1} sunt notificate instant. Preț afișat de la început, plată securizată.",[city.name,city.name]);
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
    description: t("Curățenie în {p0} — postezi lucrarea, firmele verificate din zonă sunt notificate instant.",[city.name]),
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
              "Firmele verificate din zonă sunt notificate. Primești oferte și alegi firma pe calitate — sau, pentru urgențe, prima firmă disponibilă preia instant cu Nitido Express.",
              "Plata se rezervă la acceptare și se decontează după finalizarea confirmată.",
            ],
          },
          {
            title: "Preț orientativ apartament",
            paragraphs: [
              t("Prețul e fix, calculat din suprafață — același pe care-l vede și firma. Orientativ în {p0}: până în 40 mp ~{p1} lei, până în 60 mp ~{p2} lei, până în 80 mp ~{p3} lei, până în 100 mp ~{p4} lei.",[city.name,...[40,60,80,100].map(sqm=>calcGrossPrice("apartament",sqm))]),
              "Case, birouri și alte spații se calculează pe metru pătrat. Vezi regulile complete de preț pe pagina de prețuri.",
            ],
          },
          {
            title: "Zone acoperite",
            paragraphs: [
              t("Firmele își setează aria de acoperire și primesc doar lucrările relevante. Acoperim printre altele: {p0}.",[city.areas.join(", ")]),
            ],
          },
          {
            title: "De ce NITIDO.RO",
            items: [
              "Firme verificate, cu rating public și istoric.",
              "Preț fix, fără licitație și fără negociere ulterioară.",
              "Plată securizată — banii se mișcă doar când lucrarea chiar se întâmplă.",
              t("Disponibil și în alte orașe: {p0}.",[otherCities]),
            ],
          },
        ]}
      />
    </>
  );
}
