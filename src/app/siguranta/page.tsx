import { publicPageMetadata } from "@/lib/publicSeo";
import { InformationPage } from "@/components/InformationPage";
export const metadata = publicPageMetadata("/siguranta");
const content = {
  "eyebrow": "GHID NITIDO",
  "title": "Cum îți protejezi contul, datele și rezervările",
  "intro": "Siguranța unei rezervări depinde atât de controalele platformei, cât și de modul în care folosești contul. Acest ghid explică ce informații să păstrezi private, cum verifici o confirmare și ce faci dacă observi o situație neobișnuită.",
  "sections": [
    {
      "title": "Păstrează accesul la cont numai pentru tine",
      "paragraphs": [
        "Folosește o parolă distinctă pentru NITIDO și evită reutilizarea parolei de email sau a celei bancare. Dacă folosești un dispozitiv comun, deconectează-te la final. Protejează și adresa de email, deoarece mesajele de confirmare și recuperare a accesului pot ajunge acolo.",
        "Nu trimite altor persoane parola sau linkul de resetare. Dacă bănuiești că cineva îți cunoaște parola, schimb-o și contactează suportul dacă observi acțiuni neobișnuite. Descrie evenimentele, nu transmite datele de autentificare pentru verificare."
      ]
    },
    {
      "title": "Verifică mesajele înainte să deschizi un link",
      "paragraphs": [
        "Pentru orice solicitare neașteptată privind o rezervare sau o plată, deschide direct NITIDO în browser și verifică detaliile în cont. Un mesaj urgent nu dovedește că expeditorul reprezintă platforma. Citește cu atenție domeniul și evită fișierele ori linkurile suspecte.",
        "Dacă mesajul cere parole, coduri bancare sau o plată către un beneficiar necunoscut, cere confirmare prin datele de contact publicate pe site. Nu te baza doar pe numele expeditorului sau pe sigla din mesaj."
      ]
    },
    {
      "title": "Folosește plata din fluxul rezervării",
      "paragraphs": [
        "Introdu informațiile cardului numai în interfața de plată aferentă operațiunii pe care ai inițiat-o. Nu le trimite în chat, prin email sau în fotografii. Asistentul AI și suportul nu au nevoie de numărul complet al cardului ori de codul de securitate pentru a identifica lucrarea.",
        "Dacă o plată pare repetată sau neclară, verifică starea din cont și extrasul băncii: o autorizare temporară nu este întotdeauna o încasare finală. Cere analiza operațiunii înainte de a repeta confirmarea sau de a crea o rezervare nouă."
      ]
    },
    {
      "title": "Limitează datele din descrieri și fotografii",
      "paragraphs": [
        "Descrie serviciul și particularitățile spațiului fără a publica documente de identitate, informații medicale sau coduri de acces. Fotografiile trebuie să ajute la înțelegerea lucrării. Verifică fundalul imaginii înainte de încărcare, mai ales dacă apar documente, persoane sau obiecte personale.",
        "Adresa exactă se comunică prin fluxul autorizat al lucrării. Firmele care primesc detalii pentru execuție trebuie să le folosească în acest scop. Un cont de firmă nu oferă acces general la informațiile tuturor clienților."
      ]
    },
    {
      "title": "Pregătește spațiul și clarifică serviciul",
      "paragraphs": [
        "Înainte de sosire, stabilește cum se face accesul și semnalează suprafețele fragile, restricțiile și riscurile relevante. Păstrează în siguranță obiectele de valoare și documentele. Dacă există o situație care face intervenția nesigură, comunic-o înainte de începerea lucrării.",
        "Verificarea unei firme și existența unor recenzii oferă informații utile, dar nu elimină orice risc. Nu presupune existența unei asigurări sau a unei despăgubiri automate dacă acestea nu sunt confirmate în condițiile aplicabile serviciului tău."
      ]
    },
    {
      "title": "Raportează incidentele cu informații concrete",
      "paragraphs": [
        "Pentru o rezervare, transmite numărul lucrării, momentul incidentului, ce s-a întâmplat și dovezile relevante. Evită distribuirea publică a adresei sau a datelor personale ale altor participanți. Suportul este disponibil prin contact@nitido.ro și 0341.402.403.",
        "Într-o situație de pericol imediat, apelează serviciile de urgență; chatul NITIDO nu le înlocuiește. Pentru probleme de acces, fraudă suspectată sau date expuse, menționează explicit acest lucru în solicitare, ca echipa să poată înțelege natura incidentului."
      ]
    }
  ],
  "cta": {
    "label": "Contactează echipa NITIDO",
    "href": "/contact"
  }
};
export default function Page() { return <InformationPage {...content} />; }
