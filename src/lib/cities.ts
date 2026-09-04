// Sursă unică pentru paginile SEO pe oraș. Folosită atât de rutele
// /curatenie/[oras] cât și de sitemap.ts, ca lista să rămână sincronizată
// automat. Conținutul e diferențiat per oraș (nu pagini-doorway duplicate):
// fiecare are intro propriu, context local și zone reale.

export type City = {
  slug: string;
  name: string; // forma folosită în titluri: "București"
  prepositional: string; // "în București", "la Cluj-Napoca" — pentru fraze naturale
  county: string;
  intro: string;
  areas: string[];
};

export const CITIES: City[] = [
  {
    slug: "bucuresti",
    name: "București",
    prepositional: "în București",
    county: "București-Ilfov",
    intro:
      "Cel mai activ oraș pentru servicii de curățenie din România. Postezi lucrarea pentru apartament, garsonieră sau birou, iar firmele verificate din sectorul tău primesc alertă instant.",
    areas: ["Sector 1", "Sector 2", "Sector 3", "Sector 4", "Sector 5", "Sector 6", "Pipera", "Militari"],
  },
  {
    slug: "cluj-napoca",
    name: "Cluj-Napoca",
    prepositional: "la Cluj-Napoca",
    county: "Cluj",
    intro:
      "Cerere mare de curățenie pentru apartamente închiriate și birouri de IT. Firmele din zonă răspund rapid la lucrările postate pe Nitido.",
    areas: ["Centru", "Mărăști", "Mănăștur", "Gheorgheni", "Zorilor", "Bună Ziua", "Florești"],
  },
  {
    slug: "timisoara",
    name: "Timișoara",
    prepositional: "în Timișoara",
    county: "Timiș",
    intro:
      "De la garsoniere în centru la case în cartierele rezidențiale — postezi lucrarea și prima firmă disponibilă din Timișoara o preia.",
    areas: ["Cetate", "Fabric", "Iosefin", "Girocului", "Dumbrăvița", "Giroc"],
  },
  {
    slug: "iasi",
    name: "Iași",
    prepositional: "la Iași",
    county: "Iași",
    intro:
      "Curățenie pentru apartamente, cămine studențești și birouri. Firmele verificate din Iași primesc alerta imediat ce postezi.",
    areas: ["Centru", "Copou", "Tătărași", "Păcurari", "Nicolina", "Bucium"],
  },
  {
    slug: "constanta",
    name: "Constanța",
    prepositional: "la Constanța",
    county: "Constanța",
    intro:
      "Cerere sezonieră ridicată pentru curățenie de apartamente și spații de închiriat pe litoral. Postezi și firma potrivită acceptă în câteva minute.",
    areas: ["Centru", "Tomis Nord", "Faleză Nord", "Mamaia", "Km 4-5", "Năvodari"],
  },
  {
    slug: "brasov",
    name: "Brașov",
    prepositional: "la Brașov",
    county: "Brașov",
    intro:
      "De la apartamente în cartiere la spații de închiriat pentru turiști — Nitido conectează instant clienții cu firme de curățenie din Brașov.",
    areas: ["Centrul Vechi", "Astra", "Răcădău", "Tractorul", "Bartolomeu", "Ghimbav"],
  },
  {
    slug: "oradea",
    name: "Oradea",
    prepositional: "la Oradea",
    county: "Bihor",
    intro:
      "Servicii de curățenie pentru apartamente și birouri, cu firme verificate care răspund rapid la lucrările postate în Oradea.",
    areas: ["Centru", "Rogerius", "Nufărul", "Ioșia", "Velența"],
  },
  {
    slug: "sibiu",
    name: "Sibiu",
    prepositional: "la Sibiu",
    county: "Sibiu",
    intro:
      "Curățenie pentru apartamente, case și spații comerciale. Postezi lucrarea și firmele din Sibiu primesc alertă instant.",
    areas: ["Centru", "Hipodrom", "Ștrand", "Terezian", "Șelimbăr"],
  },
];

export function getCity(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}
