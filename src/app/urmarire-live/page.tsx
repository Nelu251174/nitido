import { publicPageMetadata } from "@/lib/publicSeo";
import { InformationPage } from "@/components/InformationPage";
export const metadata = publicPageMetadata("/urmarire-live");
const content = {
  "eyebrow": "GHID NITIDO",
  "title": "Urmărește starea lucrării și află ce înseamnă fiecare etapă",
  "intro": "Urmărirea lucrării îți arată confirmările înregistrate în NITIDO, de la publicare până la finalizare. Este un istoric al rezervării și al acțiunilor relevante, nu o promisiune de monitorizare GPS continuă a persoanelor sau de sosire garantată la minut.",
  "sections": [
    {
      "title": "Unde găsești lucrarea",
      "paragraphs": [
        "Autentifică-te cu rolul folosit la rezervare și deschide lista lucrărilor din panoul contului. Selectează lucrarea după dată, adresă sau identificator, astfel încât să nu confunzi două solicitări apropiate. Detaliile afișate depind de rolul tău și de etapa în care se află lucrarea.",
        "Dacă ai deschis un link dintr-un mesaj și ești trimis la autentificare, intră în contul asociat rezervării. Nu crea o a doua lucrare doar fiindcă prima nu apare imediat; verifică întâi contul și lista existentă."
      ]
    },
    {
      "title": "În așteptare: publicată, dar încă nealocată",
      "paragraphs": [
        "O lucrare în așteptare nu are încă o firmă confirmată. La Standard, urmărește candidaturile și alege firma potrivită. La Express, preluarea depinde de disponibilitatea și acceptarea unei firme eligibile. O notificare trimisă firmelor nu reprezintă o confirmare de deplasare.",
        "Dacă programarea se apropie și nu există o alocare, contactează suportul pentru clarificarea opțiunilor. Nu presupune că o firmă este pe drum doar pentru că formularul de publicare s-a încheiat fără eroare."
      ]
    },
    {
      "title": "Acceptată: firma responsabilă este confirmată",
      "paragraphs": [
        "În această etapă verifici firma alocată, data și detaliile rezervării. Adresa exactă este pusă la dispoziția participanților autorizați pentru executarea serviciului. Asigură-te că informațiile de acces sunt corecte și că spațiul poate fi deschis la ora convenită.",
        "Un pin de intrare, dacă l-ai adăugat, ajută navigarea către spațiu. Nu reprezintă poziția în timp real a echipei. Dacă observi o adresă greșită sau ai nevoie de o modificare, solicită clarificarea înainte de deplasare."
      ]
    },
    {
      "title": "Sosire și execuție: urmărește confirmările",
      "paragraphs": [
        "Actualizarea de sosire indică înregistrarea etapei de către firmă prin fluxul disponibil. Verifică informațiile și dovezile asociate lucrării. Un SMS poate anunța un eveniment, însă detaliile actuale rămân în cont. Întârzierile de rețea pot face ca mesajele să ajungă mai târziu.",
        "Dacă starea afișată nu corespunde situației de la locație, notează ora și descrie diferența suportului. Nu este necesar să comunici parole sau coduri bancare pentru verificarea unui status."
      ]
    },
    {
      "title": "Finalizată, anulată sau neprezentare",
      "paragraphs": [
        "Finalizarea indică încheierea fluxului operațional înregistrat. Verifică separat rezultatul serviciului și starea plății. O anulare ori un incident de neprezentare are un context propriu; impactul asupra unei autorizări sau încasări se verifică în rezervare, nu se deduce din culoarea unui indicator.",
        "Dacă nu s-a executat lucrarea, dar apare finalizată, sau dacă ai o problemă privind suma, contactează echipa cu numărul lucrării și dovezile relevante. Nu marca intenționat o etapă incorectă pentru a încerca să modifici plata."
      ]
    },
    {
      "title": "Ce faci când informațiile nu se actualizează",
      "paragraphs": [
        "Reîncarcă pagina și verifică conexiunea. Confirmă că te afli în contul potrivit și că privești rezervarea corectă. Dacă problema persistă, notează mesajul afișat și momentul ultimei acțiuni, apoi contactează 0341.402.403 sau contact@nitido.ro.",
        "Trimite o captură care arată problema, dar ascunde informațiile care nu sunt necesare analizei. Suportul poate verifica situația unei lucrări concrete; Asistentul AI oferă explicații și nu poate schimba singur alocarea, statusul sau plata."
      ]
    }
  ],
  "cta": {
    "label": "Autentifică-te pentru a vedea lucrările",
    "href": "/login"
  }
};
export default function Page() { return <InformationPage {...content} />; }
