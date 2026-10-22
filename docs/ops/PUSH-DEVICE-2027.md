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

## Dovezi actualizate — 22 octombrie 2026, UTC

- Contul support@nitido.ro există: verificare numai în citire reușită la 20:32:07.
- Niciun dispozitiv Android sau iPhone activ nu a îndeplinit verificarea de înregistrare pentru acest cont la 20:33:13. Nu au fost citite sau afișate tokenuri.
- Există firme verificate. Verificarea intervalelor active aprobate și a echipelor active pentru martie–august 2027 nu a trecut; nu se declară disponibilitate reală confirmată.
- 65 de teste push/interfață și 3 teste ale configurației Firebase au trecut local. Buildul web, TypeScript și lintul au trecut. Testele providerilor folosesc simulări; recepția fizică rămâne NETESTATĂ.
- GitHub Actions nu a pornit joburile: «The job was not started because your account is locked due to a billing issue.» Dovadă: https://github.com/Nelu251174/nitido/actions/runs/39849441149 . Din acest motiv, prezența credențialelor în GitHub și starea actuală Apple nu au putut fi reverificate prin joburile pregătite.
- Nu s-a schimbat configurația push LIVE, nu s-a trimis un nou build în magazine și nu s-au trimis notificări de demonstrație utilizatorilor. Corecțiile sunt în PR-ul 135; publicarea se face după verificarea candidatului.

## Reluare — 23 octombrie 2026, Europe/Bucharest

Verificare din mediul cloud reluat (22 octombrie, aproximativ 22:10 UTC), prin proxy-ul configurat și cu verificarea TLS activă:

| Destinație | Răspuns HTTPS fără autentificare | Interpretare |
|---|---|---|
| `https://auth.firebase.tools/` | 302 | Serviciul de conectare este accesibil |
| `https://accounts.google.com/` | 302 | Serviciul Google de autentificare este accesibil |
| `https://oauth2.googleapis.com/token` | 404 pentru GET fără parametri | Domeniul răspunde; schimbul OAuth nu a fost verificat |
| `https://firebase.googleapis.com/v1beta1/projects` | 401 | API-ul răspunde și cere autentificare |

Prima încercare, fără acces de rețea acordat comenzii, nu a putut conecta proxy-ul. Aceeași verificare a reușit după acordarea accesului de rețea comenzii, păstrând proxy-ul și politica de destinații. Răspunsurile de mai sus confirmă accesul HTTPS, nu drepturile asupra proiectului.

Node.js `24.19.0` și Firebase CLI `15.34.1` sunt disponibile. CLI-ul oficial a generat conectarea fără localhost. Finalizarea așteaptă autentificarea beneficiarului cu un cont Google care are acces la proiectul Firebase existent și codul de autorizare emis de Firebase. `support@nitido.ro` este contul aplicației pentru proba fizică; nu se presupune că este și administrator Firebase. Linkul temporar, codul de autorizare și credențialele CLI nu se salvează în Git.

Pluginul Firebase are instrucțiuni disponibile, dar catalogul de unelte al acestei sesiuni nu expune un server Firebase MCP. Generarea linkului prin CLI nu confirmă o conexiune a pluginului. Nu a fost creat sau selectat un proiect alternativ și identitatea `ro.nitido.app` este păstrată.

După autentificare: se identifică proiectul existent și aplicația Android exactă, se obține și se validează configurația Firebase prin canal securizat, apoi se verifică separat FCM și APNs. Pentru fiecare telefon se completează dovezile din «Proba fizică» înainte de închiderea probei native. Fluxul comercial folosește numai Stripe TEST; pilotul martie–august 2027 așteaptă confirmarea firmelor și verificarea capacității reale.

Starea acestei reluări: **rețea verificată; conectare generată, autentificare în așteptare; recepție Android/iPhone NETESTATĂ; pilot NEACTIVAT**. Constatările LIVE și blocajul GitHub Actions din secțiunea precedentă sunt dovezi istorice și nu au fost reverificate în această reluare.
