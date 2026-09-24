import { publicPageMetadata } from "@/lib/publicSeo";
import { InformationPage } from "@/components/InformationPage";
export const metadata = publicPageMetadata("/cookie-uri");
const content = {
  "eyebrow": "COOKIE-URI ȘI STOCARE LOCALĂ",
  "title": "Cookie-uri și date păstrate în browser: ce fac și cum le controlezi",
  "intro": "Această pagină descrie mecanismele folosite de versiunea aplicației revizuită la 24 septembrie 2026: autentificare, preferințe locale, rezervări în curs și interacțiuni cu furnizori externi. Cookie-urile și stocarea locală au roluri diferite; ștergerea lor poate schimba modul în care funcționează contul pe dispozitivul respectiv.",
  "sections": [
    {
      "title": "Ce este un cookie și de ce este folosit",
      "paragraphs": [
        "Un cookie este o informație păstrată de browser și transmisă site-ului în condițiile pentru care a fost creată. Pentru autentificare, el permite recunoașterea sesiunii după schimbarea paginii. Fără acest mecanism, aplicația nu ar putea menține în mod obișnuit accesul la panoul contului.",
        "Stocarea locală a browserului este un mecanism diferit. Ea poate păstra preferințe ori informații temporare folosite de interfață, fără ca fiecare valoare să fie trimisă automat la fiecare solicitare, așa cum se întâmplă cu un cookie."
      ]
    },
    {
      "title": "Sesiunea clientului sau firmei: nitido_session",
      "paragraphs": [
        "Acest cookie este creat la autentificare și are o durată de aproximativ 30 de zile, dacă nu este eliminat mai devreme prin deconectare sau ștergerea datelor site-ului. El identifică sesiunea, nu conține parola în clar și nu reprezintă un instrument de publicitate.",
        "Cookie-ul este marcat httpOnly, ceea ce limitează citirea lui de către codul paginii, și folosește SameSite=Lax. În producție este marcat Secure, pentru transmitere prin HTTPS. Dacă îl blochezi sau îl ștergi, poate fi necesar să te autentifici din nou pentru a vedea lucrările și datele contului."
      ]
    },
    {
      "title": "Sesiunea administrativă: nitido_admin_session",
      "paragraphs": [
        "Accesul administrativ folosește o sesiune separată de cea a clientului sau firmei. Cookie-ul este destinat utilizatorilor autorizați pentru administrare, are o durată de aproximativ 8 ore și este configurat cu httpOnly, SameSite=Strict și Secure în producție.",
        "Prezența acestui cookie nu conferă singură permisiuni: aplicația verifică sesiunea și condițiile de acces. Un utilizator obișnuit nu are nevoie de autentificare administrativă pentru rezervare, iar echipa de suport nu îți va cere să trimiți valoarea cookie-ului."
      ]
    },
    {
      "title": "Preferințe și informații temporare pe dispozitiv",
      "paragraphs": [
        "Interfața poate memora local ascunderea invitației de instalare, preferința pentru sunetul alertelor și identificatorii alertelor deja afișate, pentru a evita repetarea lor. O rezervare în curs poate folosi stocarea sesiunii pentru a păstra temporar câmpurile formularului atunci când fluxul o cere.",
        "Versiunea pentru dispozitive mobile poate păstra un identificator tehnic pentru notificări atunci când funcția este utilizată. Stocarea locală poate persista până când aplicația o elimină sau până când ștergi datele site-ului. Stocarea de sesiune este legată de sesiunea filei din browser. Nu trata un formular temporar ca pe o rezervare confirmată."
      ]
    },
    {
      "title": "Analiză de trafic și publicitate",
      "paragraphs": [
        "În versiunea de cod revizuită nu sunt identificate integrări generale de analytics sau pixeli de marketing pe paginile informaționale. Acest lucru nu înseamnă că serverul nu prelucrează informații tehnice necesare funcționării și securității, cum ar fi solicitările și erorile.",
        "Un eventual instrument nou trebuie descris înainte de utilizare. Pentru stocarea ori accesarea informațiilor care nu sunt strict necesare serviciului solicitat, se aplică cerințele legale privind informarea și consimțământul. Cookie-urile necesare autentificării nu trebuie confundate cu cele pentru publicitate."
      ]
    },
    {
      "title": "Plăți, hărți și servicii externe",
      "paragraphs": [
        "Atunci când folosești o componentă sau o pagină de plată Stripe, furnizorul poate utiliza mecanisme proprii pentru operarea și protejarea serviciului. Politica sa este disponibilă la https://stripe.com/privacy. Interacțiunile cu localizarea și hărțile sunt explicate în politica de confidențialitate NITIDO.",
        "Permisiunea pentru locație sau notificări este administrată și prin browser ori sistemul de operare. Ștergerea cookie-urilor nu revocă neapărat toate aceste permisiuni. Verifică separat setările pentru site, mai ales pe un dispozitiv folosit în comun."
      ]
    },
    {
      "title": "Cum ștergi sau limitezi datele site-ului",
      "paragraphs": [
        "Deschide setările de confidențialitate ale browserului și caută datele pentru domeniul NITIDO folosit. Poți elimina cookie-urile și stocarea locală ori poți restricționa utilizarea lor. Denumirile meniurilor diferă în funcție de browser și dispozitiv.",
        "După ștergere, este posibil să pierzi autentificarea, preferințele și un formular nesalvat. Ștergerea din browser nu anulează o lucrare deja publicată și nu șterge contul de pe server. Pentru acestea folosește funcția corespunzătoare din cont sau cere clarificări suportului."
      ]
    },
    {
      "title": "Întrebări și informații suplimentare",
      "paragraphs": [
        "Dacă ai nelămuriri despre o valoare stocată sau o permisiune, scrie la contact@nitido.ro. Menționează browserul, dispozitivul și funcția utilizată, fără să trimiți tokenuri de sesiune sau parole. Aceste detalii ajută la identificarea mecanismului la care te referi.",
        "Politica de confidențialitate explică prelucrarea datelor din cont și din lucrări. Cadrul privind stocarea și accesarea informațiilor pe dispozitiv este descris, între altele, de Legea nr. 506/2004. Un control din browser și o cerere privind datele contului sunt acțiuni distincte."
      ]
    }
  ],
  "cta": {
    "label": "Citește politica de confidențialitate",
    "href": "/confidentialitate"
  }
};
export default function Page() { return <InformationPage {...content} />; }
