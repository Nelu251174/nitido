# E2 — nucleu și criteriul de închidere

Sursa: `NITIDO-MASTER-SOURCE.md`, §18–19. E2 cuprinde Standard, Express, conturi, preț, execuție, plăți, notificări și admin esențial. E2 este deschisă; codul sau CI verde nu înlocuiesc traseele complete în staging.

## Livrare verificată anterior

Sandbox `12fdd8aa883a80e4f2b4e51e53e73638c090d228`, CI [34762818849](https://github.com/Nelu251174/nitido/actions/runs/34762818849), toate cele trei joburi reușite. Recuperarea notificărilor rulează la fiecare minut; prima execuție automată 2026-09-13 14:35:02 UTC a fost `completed`, cu toate contoarele zero. Container healthy, migrare aditivă prezentă, SQLite integrity OK și zero erori FK. Aceste dovezi nu înseamnă notificări primite pe telefon.

## Defecte mobile corectate în această continuare

- `push.native.ts` conținea o implementare veche, selectată de bundler în locul celei testate în `push.ts`. Lipsea `currentPushSettings`, cerută de ecranul Notificări; revocarea ștergea tokenul local inclusiv după eșec.
- Cele două puncte de intrare folosesc acum aceeași implementare. Varianta web expune explicit lipsa unei înregistrări native.
- Înregistrarea și rotația tokenului cer confirmarea serverului înainte de salvarea locală. Revocarea eșuată păstrează posibilitatea de retry; deconectarea nu abandonează sesiunea necesară acestei operațiuni.
- Atingerea notificării la pornire este păstrată până la login și deschide exact lucrarea, o singură dată. Evenimentele necunoscute sau destinate altui rol sunt ignorate. Listenerul este eliminat corect.
- Android pregătește canalul înainte de solicitarea permisiunii. Testele încarcă explicit punctul de intrare nativ și folosesc adaptoare OS/API simulate.
- CI exportă acum și pachetele Hermes iOS/Android. Exportul nu este semnare, distribuire TestFlight sau test pe telefon.

## Matricea probelor rămase

Toate rândurile de mai jos cer dovezi pe candidatul și mediul testat. Fișierele enumerate arată ce poate fi verificat în repository; nu declară PASS de staging.

| Domeniu E2 | Probe în repository | Ce mai trebuie demonstrat în staging |
|---|---|---|
| Preț și publicare, T01–T02 | pricing, pricingSnapshot, publishedPrice, jobs/quote | Același preț/versionare din estimare până la lucrarea publicată; respingere tarif modificat/expirat |
| Standard/Express și capacitate, T03–T05 | offers, acceptJob, allocationConcurrency, selectionRecovery | Trasee complete pentru ambele moduri; două cereri simultane, o singură firmă/plată, fără depășire de capacitate |
| Autorizare/3DS și timeout, T06–T09 | stripePayments, paymentConfirmation, acceptJobRecovery, stripeResourceFence | Succes, refuz, abandon, conexiune pierdută, aceeași intenție; expirare și compensare vizibile corect |
| Dovezi, execuție și anulare, T10–T11/T18 | proofOfWork, proofSecurity, collaborationFlow, refund webhook | Foto sosire/finalizare, upload întrerupt, captură blocată fără dovadă; anulare/refund corelat cu Stripe |
| ANAF, eligibilitate și acces, T12–T14 | cui, authorization, securityRoutes, privateContextAccess | Firmă reală verificată; conturi client/firmă/angajat/admin, izolare și revocare, protecția adresei |
| Notificări, T18/T21 | notificationClaims, notificationRecovery, pushDelivery, pushNative | Furnizori configurați, telefon înregistrat, primire reală, deschiderea lucrării și retry fără duplicate |
| Recenzii și suport, T19–T20 | reviews, referral, supportAi, support/ai | Recenzie eligibilă după lucrare, credit fără duplicare; suport fără operații financiare neautorizate |
| Reconciliere | payoutReconciliation, financialRecovery | Payout–transfer–plată–lucrare în sandbox, diferență neexplicată zero și excepții explicate |
| Restaurare/rollback, T22 | scripts/recovery.test.mjs și procedura de restaurare | Restaurare cu fotografii și totaluri, dovadă pe candidatul final; backupul DB singur nu închide proba foto |

T15–T17 aparțin recurenței/integrărilor din E3/E4. Publicarea în magazine și promovarea producției sunt E5; pentru acceptarea mobilă E2 este însă necesar un build de test instalabil.

## Dependențe externe concrete

1. **Firmă reală verificată ANAF.** Firma fictivă existentă rămâne neverificată. Nu se ocolește verificarea pentru a obține un test verde.
2. **Canal de notificare configurat și dispozitiv activ.** Ultimul audit sandbox: APNs/FCM/Twilio lipsesc, push și SMS dezactivate, zero dispozitive active. Înrolarea Google Authenticator pentru ADMIN nu înregistrează telefonul pentru push.
3. **Identitatea buildului mobil.** Shell-ul Capacitor din rădăcină indică producția; `mobile/` este Expo și are încă `OWNER_EAS_PROJECT_ID_REQUIRED`. Configurarea și semnarea buildului de test rămân neefectuate. Nu se afirmă că modificările Expo au ajuns în TestFlight.
4. **Operații Stripe sandbox și sesiuni QA.** Auditul contului sandbox a returnat zero PaymentIntents; suprafața conectorului nu a expus operațiuni de creare aplicabile. Browserul automatizat nu are sesiuni autentificate client/firmă/admin; loginul ADMIN confirmat de beneficiar nu dovedește accesul browserului automatizat.

## Închiderea E2

E2 se închide numai cu rezultate păstrate pentru traseele de mai sus, identificatori de lucrare/plată/eveniment, model și versiune de telefon, SHA, mediu și dovezi autentificate. Nu se marchează primirea push din răspunsul furnizorului și nu se marchează payout din simpla captură a plății.

Referințe tehnice: [API notificări Expo](https://docs.expo.dev/versions/latest/sdk/notifications/), [tratarea notificărilor primite](https://docs.expo.dev/push-notifications/receiving-notifications/). Contractul recuperării de server: [NITIDO-NOTIFICATION-RECOVERY.md](NITIDO-NOTIFICATION-RECOVERY.md).
