import { publicPageMetadata } from "@/lib/publicSeo";
import { InformationPage } from "@/components/InformationPage";
export const metadata = publicPageMetadata("/cariere");
const content = {
  "eyebrow": "GHID NITIDO",
  "title": "Contribuie la dezvoltarea NITIDO",
  "intro": "Construim un produs care leagă rezervarea unui serviciu de executarea și urmărirea lui. Dacă vrei să contribui, această pagină explică domeniile relevante și cum poți trimite o prezentare. Domeniile de mai jos sunt direcții de interes, nu o listă de posturi confirmate sau o promisiune de angajare.",
  "sections": [
    {
      "title": "Ce probleme încercăm să rezolvăm",
      "paragraphs": [
        "O rezervare de curățenie implică informații corecte, disponibilitate, comunicare și urmărirea rezultatului. Pentru client, procesul trebuie să fie ușor de înțeles. Pentru firmă, lucrarea trebuie să aibă un scop clar și o evidență utilă. NITIDO Pro extinde această nevoie către portofolii cu activități recurente.",
        "Ne interesează contribuțiile care fac experiența mai clară și operațiunile mai ușor de urmărit. O propunere bună explică problema observată, persoanele afectate și modul în care poate fi verificată o îmbunătățire."
      ]
    },
    {
      "title": "Produs, design și conținut",
      "paragraphs": [
        "Acest domeniu privește formularele, explicațiile, accesibilitatea și felul în care utilizatorii înțeleg următoarea acțiune. Dacă ai experiență în design sau redactare, arată cum ai simplificat un proces fără să ascunzi informații importante pentru utilizator.",
        "Poți include un studiu de caz, un portofoliu sau un exemplu de pagină îmbunătățită. Precizează contribuția ta concretă și rezultatul observat. Ne este mai util un exemplu explicat decât o listă lungă de instrumente fără context."
      ]
    },
    {
      "title": "Dezvoltare software și calitate",
      "paragraphs": [
        "Funcțiile care țin de conturi, programări, date și plăți trebuie să se comporte previzibil. Pentru o prezentare tehnică, explică ce ai implementat, cum ai verificat comportamentul și cum ai tratat erorile. Folosește proiecte pe care ai dreptul să le distribui.",
        "Nu trimite cod confidențial, chei de acces sau date reale ale clienților unui fost angajator. Un proiect public ori un exemplu anonimizat poate demonstra felul în care gândești și comunici o soluție."
      ]
    },
    {
      "title": "Operațiuni și relația cu partenerii",
      "paragraphs": [
        "Coordonarea presupune înțelegerea unei solicitări, comunicarea cu participanții și urmărirea rezolvării. Dacă ai experiență în servicii, suport sau relații comerciale, descrie situații concrete în care ai organizat activitatea ori ai clarificat o problemă dificilă.",
        "Pentru colaborări cu firme de curățenie, folosește pagina Înscrie-ți firma. Pentru furnizarea de servicii într-un portofoliu NITIDO Pro, consultă pagina dedicată partenerilor Pro. Acestea sunt parcursuri diferite de o candidatură pentru echipa NITIDO."
      ]
    },
    {
      "title": "Ce incluzi în prezentarea ta",
      "paragraphs": [
        "Trimite la support@nitido.ro o prezentare cu domeniul de interes, experiența relevantă și tipul de contribuție propus. Adaugă CV-ul sau portofoliul numai dacă sunt utile. Menționează disponibilitatea și modul de colaborare dorit, pentru a putea discuta pe o bază concretă.",
        "Nu sunt necesare copii de acte, date bancare sau informații personale sensibile în această etapă. Asigură-te că linkurile pot fi deschise și că documentele nu conțin date confidențiale ale altor persoane."
      ]
    },
    {
      "title": "Ce urmează după ce ne scrii",
      "paragraphs": [
        "Mesajul reprezintă o exprimare a interesului. Existența unei oportunități și condițiile unei eventuale colaborări trebuie confirmate direct; această pagină nu stabilește salarii, program, locație, beneficii sau termene de răspuns.",
        "Dacă ai trimis deja o prezentare și dorești să o actualizezi, răspunde în aceeași conversație pentru a păstra contextul. Pentru întrebări despre datele trimise sau solicitări privind confidențialitatea, folosește aceeași adresă de contact și consultă politica de confidențialitate."
      ]
    }
  ],
  "cta": {
    "label": "Trimite prezentarea ta",
    "href": "mailto:support@nitido.ro"
  }
};
export default function Page() { return <InformationPage {...content} />; }
