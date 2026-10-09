# Metadate românești pregătite pentru magazine

Stare: **draft local, netrimis**. Textul descrie funcții existente în sursă; rămâne condiționat de verificarea lor în buildul mobil final și backendul care îl servește. Identitatea aplicației este `ro.nitido.app` pe iOS și Android. Nu este creată o aplicație nouă și nu se schimbă developerul legal.

Sursa structurată pentru completarea autorizată a consolelor este `METADATA-RO.json`. Lungimile au fost verificate local, inclusiv limita Apple de 100 **bytes** UTF-8 pentru keywords; nu se confundă cu 100 caractere.

| Câmp | Conținut |
|---|---|
| Nume Apple / titlu Google | NITIDO — Curățenie |
| Subtitlu Apple | Rezervări de curățenie |
| Descriere scurtă Google | Configurează curățenia și urmărește firma și etapele rezervării. |
| Keywords Apple | curatenie,apartament,casa,birou,rezervare,firme,servicii,Romania |
| Suport | https://nitido.ro/contact |
| Politica de confidențialitate | https://nitido.ro/confidentialitate |
| Contact suport din cod | support@nitido.ro |
| Marketing | https://nitido.ro |
| Nume legal developer / copyright / telefon review | Necunoscute; se completează numai din identitatea verificată a contului |
| URL ștergere cont propus | https://nitido.ro/stergere-cont — candidat local, disponibilitatea LIVE neconfirmată |

URL-urile există ca intenție în aplicația sursă. Disponibilitatea și conținutul efectiv al paginilor LIVE nu sunt confirmate în această sesiune. Nu se completează declarații legale sau review contact cu valori inventate.

## Descriere completă

NITIDO conectează clienții cu firme de curățenie și organizează rezervările într-un singur cont.

Pentru clienți:
• Configurezi serviciul, suprafața și programarea.
• Consulți suma afișată înainte de confirmare.
• În Standard, consulți ofertele și alegi firma. Express depinde de disponibilitatea firmelor eligibile.
• Urmărești starea rezervării și informațiile disponibile despre lucrare.
• Comunici în contextul rezervării și consulți fotografiile asociate etapelor autorizate.
• După finalizare, poți evalua serviciul prestat.

Pentru firme:
• Completezi profilul și zonele de acoperire și parcurgi verificarea necesară.
• Consulți lucrările eligibile și organizezi programările și echipa.
• Documentezi sosirea și finalizarea conform cerințelor lucrării.

Adresa exactă și fotografiile private sunt disponibile numai participanților autorizați. Locația pentru completarea rezervării este opțională; adresa poate fi introdusă manual.

Disponibilitatea serviciilor și preluarea unei lucrări depind de localitate, programare și firmele eligibile. NITIDO nu garantează o firmă disponibilă instant pentru orice solicitare.

Suport: support@nitido.ro
Informații și condiții: https://nitido.ro

## Limitele comunicării publice

Nu sunt promovate NITIDO Pro sau pilotul drept funcții accesibile universal. Nu sunt promise sunet push, localizare continuă, firmă garantată instant, rambursări automate sau verificarea plăților reale. Denumirea „urmărire” se referă la etapele rezervării, nu la GPS-ul prestatorului. Metadatele nu includ numere de clienți/firme, ratinguri, prețuri sau certificări inventate.

Cerințe și surse: `OFFICIAL-SUBMISSION-REQUIREMENTS.md`. Conturile de review, declarațiile de date și capturile mobile finale rămân probe distincte.

## Ștergere cont — condiție deschisă înainte de publicare

Ruta `/stergere-cont` și API-ul `/api/account/deletion` înregistrează cererea nominală, cu stări `requested`/`under_review`. Nu finalizează ștergerea datelor. URL-ul este pregătit în JSON cu `accountDeletionAvailableLive=false` și `accountDeletionFulfillmentVerified=false`. Termenul real al procesării, confirmarea către utilizator și rezultatul îndeplinirii cererii rămân nedemonstrate; nu se declară ștergere completă sau conformitate de store pe baza jurnalului. Acestea se validează înainte de trimiterea/publicarea în magazine, fără ștergerea datelor reale ca probă.
