// Sursă unică pentru paginile SEO pe oraș (/curatenie/[oras]) și pentru sitemap.
export type City = {
  slug: string;
  name: string;
  prepositional: string;
  county: string;
  intro: string;
  areas: string[];
};

export const CITIES: City[] = [
  { slug: "bucuresti", name: "București", prepositional: "în București", county: "București-Ilfov",
    intro: "Servicii de curățenie pentru apartamente, case și birouri. Disponibilitatea firmelor eligibile se confirmă pentru fiecare cerere, înainte de alocare.",
    areas: ["Sector 1", "Sector 2", "Sector 3", "Sector 4", "Sector 5", "Sector 6", "Pipera", "Militari"] },
  { slug: "cluj-napoca", name: "Cluj-Napoca", prepositional: "la Cluj-Napoca", county: "Cluj",
    intro: "Servicii de curățenie pentru apartamente, case și birouri. Disponibilitatea firmelor eligibile se confirmă pentru fiecare cerere, înainte de alocare.",
    areas: ["Centru", "Mărăști", "Mănăștur", "Gheorgheni", "Zorilor", "Bună Ziua", "Florești"] },
  { slug: "timisoara", name: "Timișoara", prepositional: "în Timișoara", county: "Timiș",
    intro: "Servicii de curățenie pentru apartamente, case și birouri. Disponibilitatea firmelor eligibile se confirmă pentru fiecare cerere, înainte de alocare.",
    areas: ["Cetate", "Fabric", "Iosefin", "Girocului", "Dumbrăvița", "Giroc"] },
  { slug: "iasi", name: "Iași", prepositional: "la Iași", county: "Iași",
    intro: "Servicii de curățenie pentru apartamente, case și birouri. Disponibilitatea firmelor eligibile se confirmă pentru fiecare cerere, înainte de alocare.",
    areas: ["Centru", "Copou", "Tătărași", "Păcurari", "Nicolina", "Bucium"] },
  { slug: "constanta", name: "Constanța", prepositional: "la Constanța", county: "Constanța",
    intro: "Servicii de curățenie pentru apartamente, case și birouri. Disponibilitatea firmelor eligibile se confirmă pentru fiecare cerere, înainte de alocare.",
    areas: ["Centru", "Tomis Nord", "Faleză Nord", "Mamaia", "Km 4-5", "Năvodari"] },
  { slug: "brasov", name: "Brașov", prepositional: "la Brașov", county: "Brașov",
    intro: "Servicii de curățenie pentru apartamente, case și birouri. Disponibilitatea firmelor eligibile se confirmă pentru fiecare cerere, înainte de alocare.",
    areas: ["Centrul Vechi", "Astra", "Răcădău", "Tractorul", "Bartolomeu", "Ghimbav"] },
  { slug: "oradea", name: "Oradea", prepositional: "la Oradea", county: "Bihor",
    intro: "Servicii de curățenie pentru apartamente, case și birouri. Disponibilitatea firmelor eligibile se confirmă pentru fiecare cerere, înainte de alocare.",
    areas: ["Centru", "Rogerius", "Nufărul", "Ioșia", "Velența"] },
  { slug: "sibiu", name: "Sibiu", prepositional: "la Sibiu", county: "Sibiu",
    intro: "Servicii de curățenie pentru apartamente, case și birouri. Disponibilitatea firmelor eligibile se confirmă pentru fiecare cerere, înainte de alocare.",
    areas: ["Centru", "Hipodrom", "Ștrand", "Terezian", "Șelimbăr"] },
];

export function getCity(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}
