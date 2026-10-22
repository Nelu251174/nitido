# Push, telefoane și pilot 2027 — execuție

Ordinea mandatului: (1) configurare și recepție push Android/iPhone, (2) flux complet pe telefoane, (3) pilot cu firme și capacitate reală. Contul indicat de beneficiar pentru test este `support@nitido.ro`.

## Situația confirmată la început

Pe LIVE nu există bindinguri pentru `PUSH_ENABLED`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID` sau `APNS_USE_SANDBOX`. Prezența credențialelor de publicare Apple în GitHub nu înseamnă acces APNs. Cheia Google Play este, de asemenea, diferită de Firebase/FCM.

Integrarea oficială Firebase a fost identificată ca disponibilă, dar conexiunea nu este confirmată. Aceasta permite verificarea proiectului Android existent și configurarea FCM fără a trimite chei în conversație. Nu se creează un proiect alternativ și nu se schimbă identitatea `ro.nitido.app`.

## Corecții pregătite

- Android: un build pentru magazin refuză absența sau identitatea greșită a `google-services.json`. Workflowurile pregătesc fișierul din secretul securizat `GOOGLE_SERVICES_JSON`, îl validează și nu îi publică API key-urile.
- APNs: mediul development/production trebuie ales explicit; aplicațiile App Store/TestFlight folosesc production. Validarea precedă deschiderea conexiunii. Erorile de configurare nu revocă dispozitivele; erorile de stream sunt închise controlat.
- FCM: un proiect inexistent sau un payload respins nu este echivalat cu un token de telefon expirat. Se cere un identificator de mesaj confirmat înainte de marcarea acceptării de către provider.
- Starea de activare este calculată separat pentru Android și iPhone; endpointul este privat, fără cache, și nu returnează tokenuri.
- Jobul GitHub de readiness raportează numai existența bindingurilor. Verificarea Apple citește versiunea oficială prin accesul existent, fără publicare. Nu trimite notificări.

## Proba fizică

Se trimite numai către dispozitivele contului de test autorizat, niciodată către coada generală. Pentru fiecare platformă se înregistrează versiunea aplicației, modelul/OS-ul, mediul APNs, ora și identificatorul mesajului de test. Acceptarea FCM/APNs nu dovedește recepția pe ecran.

Se confirmă separat: prim-plan, fundal, aplicație închisă când OS-ul permite, atingerea notificării și destinația corectă, permisiune refuzată/reluată, ieșire din cont fără notificări ulterioare. Volumul și modul silențios rămân controlate de telefon.

## Flux pe telefon

Cu conturi de test și plăți Stripe TEST: autentificare → rezervare și preț → acceptare de către firma eligibilă → programare/reminder → supliment separat → sosire/dovezi → finalizare validă/capturare TEST → evaluare unică. Se verifică izolarea rolurilor, refuzul duplicatelor și revenirea după lipsa rețelei. Nu se fac plăți reale sau modificări la rezervările utilizatorilor pentru demonstrație. Un test în browser la dimensiune de telefon nu închide această probă nativă.

## Pilot cu firme

Se folosește un oraș cu furnizori verificați și disponibilități confirmate. Pentru fiecare firmă se consemnează acoperirea, tipurile de servicii, ferestrele martie–august 2027, durata/deplasarea și numărul de lucrări pe care firma declară că le poate prelua. Firma își decide personalul; pilotul nu schimbă formula de preț pentru client.

Intervalele se verifică în planificare pentru conflicte și se aprobă numai după confirmare reală. Firmele nu sunt declarate înscrise, contactate sau disponibile doar pe baza înregistrării lor în aplicație. Mesajele către firme reale și lansarea comercială se documentează separat, cu destinatari și mandat explicit.

## Regula de acceptanță

Configurat ≠ provider acceptat ≠ telefon confirmat. Cele trei rezultate sunt păstrate separat. Zonele fără configurare ori dispozitiv rămân BLOCATE/NETESTATE, fără marcaj VERDE fabricat.
