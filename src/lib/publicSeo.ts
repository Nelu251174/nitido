import type { Metadata } from "next";

export const PUBLIC_SEO_PAGES = {
  "/": {
    "title": "Firme de curățenie în România",
    "description": "Configurează curățenia pentru apartament, casă sau birou. Compară firme verificate, vezi prețul și urmărește rezervarea în contul NITIDO."
  },
  "/cum-functioneaza": {
    "title": "Cum funcționează NITIDO",
    "description": "Află cum postezi o lucrare, alegi firma de curățenie și urmărești rezervarea, fotografiile și plata până la finalizare."
  },
  "/pentru-clienti": {
    "title": "Servicii de curățenie pentru clienți",
    "description": "Organizează curățenia casei sau biroului cu NITIDO: configurare, firme verificate, comunicare și evaluare după lucrare."
  },
  "/pentru-firme": {
    "title": "Lucrări pentru firme de curățenie",
    "description": "Descoperă cum poate firma ta de curățenie să primească lucrări prin NITIDO, să organizeze echipe și să își construiască reputația."
  },
  "/inscrie-firma": {
    "title": "Înscrie-ți firma de curățenie",
    "description": "Înregistrează firma în NITIDO, completează zonele de acoperire și parcurge verificarea pentru a accesa lucrările eligibile."
  },
  "/preturi": {
    "title": "Prețuri pentru servicii de curățenie",
    "description": "Află cum se calculează prețul curățeniei în funcție de spațiu și suprafață. Verifică estimarea și suma afișată înainte de rezervare."
  },
  "/incredere": {
    "title": "Încredere și verificarea firmelor",
    "description": "Cum funcționează verificarea firmelor, recenziile asociate lucrărilor și măsurile de încredere din platforma NITIDO."
  },
  "/siguranta": {
    "title": "Siguranța contului și a rezervărilor",
    "description": "Află cum sunt protejate accesul la cont, adresele, fotografiile și informațiile rezervărilor pe NITIDO."
  },
  "/urmarire-live": {
    "title": "Urmărirea lucrărilor de curățenie",
    "description": "Consultă etapele și informațiile disponibile în cont pentru urmărirea lucrării de curățenie și comunicarea cu firma alocată."
  },
  "/despre-noi": {
    "title": "Despre NITIDO",
    "description": "Descoperă NITIDO, platforma care conectează clienții cu firme de curățenie și organizează rezervările de la configurare la evaluare."
  },
  "/contact": {
    "title": "Contact și suport",
    "description": "Contactează NITIDO pentru întrebări despre cont, rezervări și servicii de curățenie. Suport telefonic, email și asistent AI."
  },
  "/cariere": {
    "title": "Cariere la NITIDO",
    "description": "Descoperă domeniile de colaborare și cum poți trimite candidatura pentru a contribui la dezvoltarea NITIDO."
  },
  "/termeni": {
    "title": "Termeni și condiții",
    "description": "Consultă termenii de utilizare NITIDO, rolurile clienților și firmelor, regulile rezervărilor și condițiile platformei."
  },
  "/confidentialitate": {
    "title": "Politica de confidențialitate",
    "description": "Află ce date prelucrează NITIDO, scopurile utilizării și informațiile despre protecția datelor personale."
  },
  "/cookie-uri": {
    "title": "Politica de cookie-uri",
    "description": "Consultă informațiile despre cookie-urile folosite pentru autentificare și funcționarea platformei NITIDO."
  }
} as const;

export function publicPageMetadata(path: keyof typeof PUBLIC_SEO_PAGES): Metadata {
 const {title,description}=PUBLIC_SEO_PAGES[path];
 return {title,description,alternates:{canonical:path},openGraph:{title,description,url:path,type:"website",locale:"ro_RO",siteName:"NITIDO.RO"},twitter:{card:"summary_large_image",title,description}};
}
