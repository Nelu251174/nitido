import { publicPageMetadata } from "@/lib/publicSeo";
import { InformationPage } from "@/components/InformationPage";
export const metadata = publicPageMetadata("/pentru-clienti");
const content = {
  "eyebrow": "GHID NITIDO",
  "title": "Ghidul clientului: de la prima rezervare la o lucrare finalizată",
  "intro": "Aici găsești informațiile de care ai nevoie înainte să rezervi, în timpul intervenției și după finalizare. Scopul este să alegi un serviciu potrivit spațiului tău și să știi unde verifici fiecare confirmare, fără să te bazezi pe presupuneri.",
  "sections": [
    {
      "title": "Ce pregătești înainte de rezervare",
      "paragraphs": [
        "Notează localitatea, adresa completă, tipul spațiului și suprafața de curățat. Alege o programare la care accesul poate fi asigurat. Dacă ai animale, obiecte fragile, restricții de acces sau cerințe speciale, descrie-le clar. O echipă poate pregăti mai bine intervenția atunci când informațiile sunt complete.",
        "Curățenia după renovare, murdăria dificilă sau solicitările care presupun echipamente speciale necesită clarificări suplimentare. Nu le include implicit într-o rezervare de curățenie obișnuită. Pentru o estimare adecvată, folosește opțiunea de evaluare disponibilă în cont sau contactează echipa."
      ]
    },
    {
      "title": "Cum citești prețul",
      "paragraphs": [
        "Verifică separat serviciul de bază, geamurile și orice opțiune suplimentară aleasă. Numărul camerelor nu adaugă singur un cost distinct; configurația și suprafața sunt cele care contează pentru grila standard. Suprafața geamurilor se măsoară separat și nu trebuie confundată cu suprafața apartamentului.",
        "Înainte de publicare, compară totalul cu opțiunile selectate. Dacă observi o diferență, corectează formularul înainte să confirmi. Solicitările ulterioare care schimbă volumul lucrării trebuie clarificate, nu presupuse ca fiind incluse în suma inițială."
      ]
    },
    {
      "title": "Cum alegi firma pentru o lucrare Standard",
      "paragraphs": [
        "Așteaptă candidaturile firmelor eligibile și citește informațiile disponibile despre fiecare. Ratingul este mai util împreună cu numărul și conținutul recenziilor, nu izolat. Un profil nou poate avea puține evaluări; acest lucru trebuie privit ca lipsă de istoric, nu ca o garanție pozitivă sau negativă.",
        "După selecție, verifică alocarea în cont. Express funcționează diferit: firma este atribuită prin prima acceptare eligibilă confirmată, atunci când această opțiune este disponibilă. Alege varianta potrivită nevoii tale înainte de publicare."
      ]
    },
    {
      "title": "Ce date vede firma și cum pregătești accesul",
      "paragraphs": [
        "Adresa exactă este protejată înainte de alocare. După confirmare, firma responsabilă primește detaliile necesare pentru deplasare și executare. Verifică strada, numărul, scara și informațiile de acces, dar evită introducerea datelor sensibile în câmpuri publice.",
        "La data rezervată, asigură accesul și explică suprafețele care necesită tratament atent. Păstrează separat documentele, banii și obiectele de valoare. Fotografiile utile pentru lucrare trebuie să surprindă spațiul sau problema, fără a expune inutil persoane sau documente."
      ]
    },
    {
      "title": "Ce verifici în timpul lucrării",
      "paragraphs": [
        "În cont poți urmări starea rezervării și confirmările disponibile. Dacă ai primit un SMS, deschide direct platforma pentru a verifica detaliile. O notificare întârziată nu schimbă de la sine programarea, iar absența unui mesaj nu dovedește anularea lucrării.",
        "Dacă echipa nu ajunge, accesul nu poate fi asigurat sau apar neînțelegeri privind serviciul, solicită ajutor. Trimite identificatorul lucrării, ora programată și o descriere exactă. Suportul poate analiza mai ușor situația dacă informațiile sunt legate de rezervarea corectă."
      ]
    },
    {
      "title": "Finalizare, feedback și ajutor după intervenție",
      "paragraphs": [
        "Verifică rezultatul în raport cu serviciul rezervat și cu particularitățile comunicate. O evaluare utilă menționează punctualitatea, comunicarea și calitatea observată. Nu include adrese, telefoane sau informații despre angajați care nu sunt necesare descrierii experienței.",
        "Pentru probleme de plată sau calitate, contactează support@nitido.ro. Menționează numărul lucrării și rezultatul dorit. Nu transmite parola, coduri bancare sau numărul complet al cardului. O reclamație este analizată în contextul lucrării; simpla trimitere a mesajului nu reprezintă confirmarea unei rambursări."
      ]
    }
  ],
  "cta": {
    "label": "Începe o rezervare",
    "href": "/rezervare"
  }
};
export default function Page() { return <InformationPage {...content} />; }
