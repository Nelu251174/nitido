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

## Continuare: rollback la acceptare

Eșecul întârziat al autorizării nu mai suprascrie o anulare, un no-show, sosirea/finalizarea sau realocarea către altă firmă. Revenirea în waiting este condiționată de starea accepted și firma care a inițiat cererea. Erorile interne ale providerului nu mai sunt trimise utilizatorului.

Șapte teste noi folosesc o autorizare suspendată controlat și modifică starea înainte de eșec; împreună cu cele cinci teste existente de acceptare, 12/12 au trecut local. Aceasta verifică intercalarea cererilor într-un proces, nu concurența distribuită. Registrul durabil al încercărilor, realocarea repetată către aceeași firmă și reconcilierea unei autorizări confirmate după anulare rămân deschise.

## Continuare: notificări atomice și viramente bancare

- Citirile Stripe se termină înainte de tranzacția SQLite. Confirmarea evenimentului și toate modificările sale locale sunt salvate în aceeași tranzacție; o eroare anulează ambele. O cerere concurentă eșuată nu mai șterge confirmarea unei cereri reușite.
- Comisioanele sunt asociate prin PaymentIntent și charge, cu verificarea sursei tranzacției de balanță și monedei RON. Disputele sunt legate de charge și interogate în starea curentă. Metadatele singure nu mai aleg plata modificată.
- Evenimentele conturilor conectate nu pot modifica plățile platformei. O autorizare eșuată nu mai schimbă starea transferului firmei. Reversările parțiale nu sunt afișate ca reversări totale.
- O notificare payout.paid/failed nu mai marchează toate lucrările firmei paid/failed. Tabelul aditiv stripe_bank_payouts păstrează viramentul pe perechea cont Stripe + payout, cu sumă în unități minime, monedă, stare și sosire estimată. Sunt acceptate numai conturi asociate firmelor existente. Providerul este interogat în contextul acelui cont.
- Admin afișează ultimele 100 de viramente, firmă, sumă, monedă, stare și referință. Asocierea viramentelor cu lucrările necesită reconciliere separată. Nu sunt rescrise stările financiare istorice.
- 399 teste web/backend trecute în suita locală; 15 teste de webhook, inclusiv rollback prin eroare SQLite, livrări concurente, retrimitere după timeout, payout și limite între conturi. Testele folosesc provider simulat.
- Limite: verificarea vizuală autentificată a noului tabel și staging Stripe rămân necesare. Nu există încă un inbox complet cu payloaduri, reconciliere pentru resurse necunoscute, legături payout-lucrare sau ordonare strictă între evenimente diferite procesate concurent. Citirea stării curente reduce efectele notificărilor vechi, fără a reprezenta un registru financiar complet.
- Migrare: tabela nouă este creată prin SCHEMA_SQL fără modificarea datelor existente; poate rămâne la revenirea la versiunea anterioară.
- Referință: [procesarea notificărilor Stripe](https://docs.stripe.com/webhooks).

## Continuare: evidența persistentă a autorizărilor

- Tabelul aditiv payment_authorization_attempts păstrează câte o solicitare inițială pe lucrare, înainte de apelul extern: parametrii serverului, momentul, identificatorul Stripe și starea. Cheia Stripe nu este stocată; o amprentă SHA-256 împiedică reluarea automată cu altă cheie/context. Snapshotul nu conține PAN, CVC sau client_secret.
- Dacă identificatorul Stripe este cunoscut, se interoghează aceeași intenție de plată. Un eșec la inserarea plății locale nu mai obligă recrearea intenției. Inserările concurente ale aceleiași plăți sunt deduplicate prin ID-ul stabil și validate după salvare.
- Dacă rezultatul rămâne necunoscut, reluarea folosește aceiași parametri și aceeași cheie de idempotency numai în primele 20 de ore. După această limită conservatoare, la schimbarea cardului/sumei sau a cheii providerului, cererea este blocată pentru reconciliere. Limita este un control NITIDO; nu este durata autorizării cardului.
- O plată locală authorized este reverificată la Stripe înainte de reutilizare. Starea canceled este sincronizată în cancelled la acceptare/capturare și prin webhook. Nu se generează automat o nouă autorizare după expirare.
- Admin include lista autorizărilor care necesită verificare, cu lucrare, stare, moment și referință Stripe disponibilă. Snapshotul și amprenta cheii nu sunt expuse prin API-ul admin.
- Validare: 409 teste web/backend trecute în suita locală; build și lint reușite înaintea ajustării finale a etichetei de reconciliere. CI verifică versiunea finală. Scenarii noi: timeout, pragul de reluare, schimbare sumă/card/cheie, eșec SQLite după răspuns Stripe, concurență, autorizare anulată și notificare de anulare. Provider simulat.
- Limite: acesta este registrul solicitării inițiale, nu un registru complet cu generații de reautorizare. Confirmarea interactivă 3DS/SCA, anularea autorizării sosite după anularea lucrării, migrarea solicitărilor vechi neidentificate și reconcilierea asistată rămân de implementat. Rotirea cheilor necesită verificarea cererilor neînchise; nu se șterge registrul pentru a ocoli blocarea. Nu au fost testate tranzacții într-un cont Stripe sau interfața admin autentificată.
- Referințe: [idempotency Stripe](https://docs.stripe.com/api/idempotent_requests), [autorizări și expirare](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method).

## Continuare: confirmare interactivă 3DS

- Clientul vede solicitarea de confirmare lângă lucrările în așteptare. Pagina `/client/plata/[id]` prezintă suma și deschide confirmarea Stripe numai la apăsarea butonului. Mobilul deschide aceeași pagină HTTPS în browser, cu autentificare NITIDO separată; nu include tokenuri în URL și nu folosește încă un SDK Stripe nativ.
- API-ul permite numai proprietarul lucrării, verifică originea și limitează frecvența. Răspunsurile sunt private/no-store. Client secret este transmis numai sesiunii autorizate, fără stocare în registru sau în URL. Sunt verificate suma calculată pe server, moneda, clientul Stripe, cardul, metadatele și modul manual de capturare.
- Se reia exclusiv intenția existentă, inclusiv identificatorul recuperat dintr-o eroare authentication_required validată. După confirmarea în browser, serverul consultă Stripe din nou. Numai requires_capture cu întreaga sumă autorizată creează plata locală authorized, o singură dată. Nu se capturează bani în acest flux.
- Lucrarea rămâne waiting; alocarea firmei trebuie reluată explicit. Acest pas nu confirmă automat oferta care a eșuat anterior. Schimbările rezervării în timpul verificării blochează răspunsul; compensarea unei autorizări sosite după anularea lucrării rămâne necesară separat.
- Configurare: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY și cheia secretă trebuie să aparțină aceluiași cont Stripe; codul verifică și compatibilitatea test/live. Nicio cheie reală nu a fost adăugată și nicio configurație de producție nu a fost modificată.
- Validare locală: 423 teste web/backend în suita completă, apoi 10 teste suplimentare trecute împreună cu cele existente în cele două fișiere afectate (433 total). 57 teste mobile și verificarea TypeScript mobil au trecut. Build Next.js trecut; CI verifică versiunea finală inclusiv ajustarea efectului React.
- Limite: provider simulat; provocarea bancară, configurația contului Stripe, verificarea vizuală autentificată și revenirea din browser pe dispozitive reale necesită testare sandbox înainte de lansare. Nu este declarată validarea integrală a plăților în producție.
- Referință: [Stripe confirmCardPayment](https://docs.stripe.com/js/payment_intents/confirm_card_payment).
