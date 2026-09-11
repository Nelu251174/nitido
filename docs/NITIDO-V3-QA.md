# NITIDO v3 — verificare integrată și corecții

Bază verificată: PR #49, pornind de la `de6fa8c`. Această etapă nu reprezintă publicarea în producție sau închiderea întregului brief.

## Probleme reproduse și corectate

| Problemă | Reproducere | Corecție |
|---|---|---|
| Control de origine ocolit prin antet Authorization arbitrar | Sesiune cookie validă + origine străină + Basic returna 200 la modificarea bugetului | Excepția de origine este permisă numai pentru autentificarea Bearer activată și validată; cookie-urile păstrează verificarea originii |
| Raport modificabil după trimitere | Checklistul putea fi schimbat prin API după raport | Verificările raportate sunt blocate, răspuns 409 |
| Ora depindea de fusul serverului | Ora 10:00 devenea 13:00 în România când serverul rula în UTC | Conversie explicită Europe/Bucharest pentru rezervări programate și ASAP; reutilizare în recurență |
| Pierderea rezervării la creare cont | În browser, linkul de înregistrare pierdea next cu tipul și suprafața | Autentificarea și înregistrarea păstrează o destinație internă validată, inclusiv invitații și aprobări |
| Imagine trunchiată acceptată ca dovadă | Semnătura PNG fără date imagine era suficientă pentru VALID | Decodare completă, eliminarea metadatelor, limită 40 MP și redimensionare maximum 2560 px; fișierul invalid nu se salvează |
| Pornire și resurse interactive în mediul de preview | Parametri incompatibili cu Next.js; resurse de dezvoltare blocate pentru originea internă | Wrapper care păstrează Next.js și traduce parametrii; allowedDevOrigins limitat la domeniul intern de preview, fără modificarea regulilor de producție |

## Dovezi de verificare

- 350 teste web/backend trecute local, în 46 fișiere; build Next.js și ESLint reușite.
- 8 teste de integrare API folosesc resolverul real de sesiuni, o bază SQLite în memorie cu schema aplicației și fișiere foto izolate. Nu folosesc datele clienților.
- Acoperire: invitație, acceptare, alocare, fotografii, sosire, checklist, raport, restricționarea finalizării la titularul firmei, revocare, realocare, buget, credit, consum unic și rollback.
- Verificări de fus orar: UTC, Europe/Bucharest și America/New_York; iarnă, vară, ambele schimbări de oră și trecerea între luni.
- Browser desktop: homepage randată, imagini încărcate, fără depășire orizontală la lățimea de 1348 px; estimatorul pentru birou 100 m² afișează 450 lei; selecția se păstrează în linkul către rezervare, apoi între login și signup în ambele direcții.
- Mesajele din ecranul de cont explică ambele moduri, Standard și Express.
- Sharp 0.35.3, deja prezent în dependențele Next.js, este declarat explicit pentru validarea uploadurilor. Configurarea intrărilor neîncrezute urmează [documentația constructorului Sharp](https://sharp.pixelplumbing.com/api-constructor/).

## Limite precise

Testele apelează handler-ele API cu NextRequest; nu sunt o sesiune completă de utilizare autentificată în browser și nu reprezintă un test Stripe de la cap la coadă. Capturarea și notificările sunt simulate la granița serviciilor externe. Alocarea marketplace este precondiție în scenariul de execuție; alocarea echipei este testată prin API.

Nu au fost efectuate încasări, rambursări sau plăți reale, autentificare manuală în conturi reale, teste pe dispozitive fizice, verificare vizuală integrală a dashboardurilor private, test de încărcare sau restaurare de backup. Validarea tehnică a imaginii nu dovedește că fotografia reprezintă lucrarea realizată.

Înainte de producție rămân necesare verificarea autentificată a dashboardurilor în staging, fluxul complet cu Stripe de test, verificarea mobilă pe dispozitive și backup/restore. Lista funcționalităților rămase din brief este în `NITIDO-V3-IMPLEMENTATION.md`.

## Continuare: confirmarea și recuperarea încasării

- Autorizarea verifică `requires_capture`, moneda RON și suma integrală capturabilă. O plată anulată/refundată nu este reutilizată drept autorizare validă. Identificatorul noilor plăți este stabil pentru reluarea aceleiași solicitări după timeout.
- Capturarea verifică mai întâi PaymentIntent-ul asociat: identificator, metadate lucrare/plată, monedă și sumă. Numai `succeeded` cu suma integrală încasată schimbă starea locală în `captured`. O încasare deja confirmată de Stripe este recuperată fără un nou apel de capturare.
- Lipsa identificatorului Stripe blochează capturarea și anularea când providerul este configurat. Anularea necesită confirmarea `canceled`.
- Finalizarea poate fi reapelată de firma titulară pentru recuperarea încasării unei lucrări deja finalizate, cu dovezi valide. Accesul angajaților nu este extins. Răspunsul de eroare nu expune mesajul intern Stripe.
- Website: secțiune pentru lucrări finalizate cu încasare neconfirmată și buton de reluare. Aplicația Expo: aceeași acțiune în istoricul firmei. Acțiunile au stare de așteptare și tratarea erorilor de conexiune.
- Verificare locală: 365 teste web/backend în 47 fișiere, inclusiv 14 scenarii cu răspunsuri Stripe simulate și 9 teste API de colaborare; 54 teste mobile, TypeScript mobil, build Next.js și ESLint reușite.

Aceste teste nu sunt tranzacții în Stripe sandbox. Nu există cheie Stripe configurată în mediul local; conectorul prezintă două contexte de test și cere selectarea contului înainte de operațiuni. Nu au fost efectuate mutații Stripe, încasări reale sau publicare în producție. Noile controale din dashboardurile private necesită încă verificare vizuală autentificată și pe dispozitiv.

Auditul financiar nu este închis: rambursările în așteptare, reconcilierea webhookurilor, autorizările expirate, reluarea după schimbarea cardului/sumei și concurența la acceptare necesită continuare. Identificatorul stabil nu înlocuiește un registru durabil al încercărilor și nu extinde perioada de păstrare a idempotency keys la Stripe. Datele financiare istorice nu sunt rescrise automat.

Referință pentru stările providerului: [ciclul PaymentIntent](https://docs.stripe.com/payments/paymentintents/lifecycle).

## Continuare: rambursări confirmate și recuperabile

- Rambursările pending/requires_action nu mai sunt înregistrate ca finalizate. Failed/canceled sunt raportate ca eșec, fără modificarea plății în refunded. API-ul admin răspunde 202 pentru pending și înregistrează starea corectă în audit.
- Identitatea rambursării și reversarea transferului sunt păstrate; la repetare se interoghează rambursarea existentă. O reversare confirmată nu este repetată după timeout la cererea de refund.
- Actualizările verifică PaymentIntent-ul, moneda RON și suma integrală. Succesul nu este degradat de un mesaj vechi. Transferurile noi sunt blocate după inițierea rambursării.
- Evenimentele refund.created/updated/failed și charge.refunded consultă starea curentă a rambursării cunoscute; o notificare de rambursare parțială nu închide automat întreaga plată. Erorile acestei reconcilieri permit retrimiterea evenimentului.
- Verificare locală: 377 teste în suita completă, plus 4 teste noi ale webhookului trecute separat (381 total); build Next.js și lint reușite. Providerul este simulat, fără mutații Stripe sau bani reali.
- Limite: rambursările externe necunoscute, notificarea sosită înainte de persistarea ID-ului, autorizările expirate și concurența distribuită necesită în continuare reconciliere operațională; nu sunt introduse încercări financiare noi automat după un refund eșuat.
- Stările sunt definite în [documentația Stripe Refund](https://docs.stripe.com/api/refunds/object).

Aplicația mobilă diferențiază explicit rambursarea eșuată de cea în procesare. Verificare: 57 teste mobile și TypeScript trecute.
