import { publicPageMetadata } from "@/lib/publicSeo";
import { InformationPage } from "@/components/InformationPage";
export const metadata = publicPageMetadata("/cum-functioneaza");
const content = {
  "eyebrow": "GHID NITIDO",
  "title": "Cum rezervi curățenia și urmărești lucrarea, pas cu pas",
  "intro": "De la alegerea serviciului până la evaluarea firmei, fiecare etapă are un scop clar. Mai jos afli ce completezi, când este confirmată rezervarea, cine vede adresa și ce verifici înainte de plată. Pentru portofolii cu lucrări recurente, NITIDO Pro are un parcurs separat de evaluare și activare.",
  "sections": [
    {
      "title": "1. Descrii spațiul și serviciul de care ai nevoie",
      "paragraphs": [
        "Începe din Configurează curățenia. Alege tipul spațiului, localitatea, suprafața și programarea. Folosește suprafața reală a zonei care trebuie curățate și explică particularitățile care pot influența intervenția: accesul, suprafețele fragile sau zonele care necesită atenție. Adresa trebuie verificată înainte de publicare, inclusiv atunci când este completată cu ajutorul localizării.",
        "Curățenia obișnuită și o intervenție după constructor nu reprezintă același serviciu. Pentru lucrări speciale sau spații foarte mari, solicită o evaluare înainte de rezervare. Fotografiile relevante ajută la înțelegerea cerinței; evită documentele, persoanele și obiectele personale care nu au legătură cu lucrarea."
      ]
    },
    {
      "title": "2. Verifici prețul și rezumatul rezervării",
      "paragraphs": [
        "Calculatorul folosește tipul spațiului și suprafața. Spălarea geamurilor se adaugă separat dacă o selectezi. Citește rezumatul complet: serviciu, dată, adresă, opțiuni și suma de plată. Un exemplu din calculator nu înlocuiește prețul confirmat pentru configurația ta.",
        "Dacă modifici suprafața sau opțiunile înainte de publicare, verifică din nou totalul. Pentru cerințe care nu apar în configurator, cere clarificări; o observație scrisă nu adaugă automat un serviciu suplimentar în preț."
      ]
    },
    {
      "title": "3. Alegi între Standard și Express",
      "paragraphs": [
        "La Standard, firmele eligibile își exprimă interesul, iar tu alegi firma dintre candidaturile primite. Compară profilul, ratingul și experiențele asociate lucrărilor finalizate. Prețul este cel calculat în platformă; selecția nu este o licitație pentru cel mai mic tarif.",
        "La Express, atunci când opțiunea este disponibilă, preluarea se face de prima firmă eligibilă a cărei acceptare este confirmată. Citește condițiile și eventualul supliment înainte de alegere. Publicarea unei cereri nu înseamnă că o echipă este deja alocată; disponibilitatea se confirmă în detaliile lucrării."
      ]
    },
    {
      "title": "4. Primești confirmarea firmei alocate",
      "paragraphs": [
        "Deschide lucrarea din cont pentru a vedea dacă alocarea este confirmată și care este firma responsabilă. O alertă sau o candidatură nu este echivalentă cu preluarea. Dacă o operațiune de plată necesară nu reușește, urmează mesajul afișat și verifică starea înainte de a repeta acțiunea.",
        "Înainte de alocare, firmele au acces la informațiile generale necesare deciziei. Adresa exactă și detaliile protejate sunt disponibile participanților autorizați după alocare. Nu publica un cod de acces sau date personale în descrieri destinate mai multor firme."
      ]
    },
    {
      "title": "5. Pregătești accesul și urmărești intervenția",
      "paragraphs": [
        "Asigură accesul la spațiu în intervalul rezervat și comunică din timp particularitățile relevante. Verifică detaliile lucrării pentru actualizările de sosire și finalizare. Acestea descriu evoluția serviciului; urmărirea statusului nu reprezintă o localizare GPS permanentă a echipei.",
        "Dacă firma întârzie, nu se prezintă sau apar diferențe față de serviciul rezervat, contactează suportul cu identificatorul lucrării. Păstrează mesajele și fotografiile relevante. Nu confirma o finalizare doar pentru a închide o notificare dacă problema nu este clarificată."
      ]
    },
    {
      "title": "6. Verifici finalizarea, plata și evaluarea",
      "paragraphs": [
        "Autorizarea unei sume pe card și încasarea efectivă sunt etape diferite. Plata este procesată prin fluxul platformei, iar starea ei se verifică în cont. Eliberarea unei sume blocate sau afișarea unei rambursări în extras poate depinde de procesator și de bancă.",
        "După finalizare, verifică rezultatul și lasă o evaluare bazată pe experiența reală. Descrie punctual ce a mers bine și ce ar fi putut fi îmbunătățit, fără informații personale. Dacă ai o reclamație, transmite separat suportului numărul lucrării, situația și dovezile, pentru ca aceasta să poată fi analizată."
      ]
    }
  ],
  "cta": {
    "label": "Configurează curățenia",
    "href": "/rezervare"
  }
};
export default function Page() { return <InformationPage {...content} />; }
