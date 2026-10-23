# Alternative de notificare — 23 octombrie 2026

Scop: continuarea notificărilor NÍTIDO folosind platforma existentă, cu rezultate distincte pentru aplicațiile native, versiunea web instalată și canalele operaționale. Acest document este analiza alternativelor cerută de beneficiar, nu o declarație de implementare sau recepție pe telefon.

## Variante verificate

| Rută | Ce poate oferi | Dovezi actuale | Lucru necesar / limită |
|---|---|---|---|
| Web Push cu VAPID, în PWA existentă | Notificări de sistem pe Android și iPhone compatibile, fără administrarea unui proiect Firebase propriu | LIVE răspunde 200 la `/manifest.webmanifest` (`display: standalone`) și `/sw.js`; există deja manifest și înregistrare service worker în cod | Nu este implementat: lipsesc abonamentele, transportul server și handler-ele `push`/`notificationclick`. Pe iPhone cere iOS 16.4+ și aplicația web adăugată pe ecranul principal. Nu înlocuiește transportul nativ al aplicației Capacitor din magazin |
| APNs direct pentru aplicația iPhone | Push nativ iOS, independent de Firebase | Transportul există în `src/lib/pushProviders.ts`, iar proiectul iOS declară entitlement APNs production | Bindingurile APNs lipsesc în LIVE și sandbox; cheia de publicare App Store nu dovedește existența unei chei APNs. Recepția nativă rămâne netestată |
| Email operațional și SMS existente | Alerte pe telefoane fără dependență de activarea Firebase | Bindingurile Resend există în LIVE și sandbox; bindingurile Twilio există în LIVE. Codul conține email pentru reamintiri și fallback SMS pentru oportunitate, acceptare și sosire | Bindingurile nu dovedesc validitatea credențialelor sau livrarea. SMS-ul poate implica costuri. Mesajele de conversație și finalizarea nu au fallback SMS complet. Nu s-au trimis mesaje de test și nu s-a procesat coada generală |
| Alerte în pagina deschisă | Popup și sunet pentru activitatea vizibilă în browser | `WebAlerts.tsx` folosește citire periodică, iar implementarea curentă este limitată la desktop | Nu asigură recepția când aplicația de telefon este închisă; nu este substitut pentru proba push nativă |

Recomandarea tehnică pentru o rută nouă independentă de activarea Firebase este **Web Push în PWA existentă**. Păstrează domeniul și produsul NÍTIDO; utilizatorul folosește versiunea web instalată. Pentru aplicațiile native deja distribuite, Android păstrează FCM, iar iPhone poate continua separat prin APNs.

## Pachet concret pentru Web Push, înaintea oricărei publicări

1. Chei VAPID pe backend, cu cheia publică expusă pentru abonare; cheia privată rămâne în configurație securizată.
2. Abonamente pe utilizator, cu înregistrare și revocare autentificate, validarea destinațiilor și eliminarea abonamentelor expirate.
3. Handler `push` cu `ServiceWorkerRegistration.showNotification()` și `notificationclick` cu navigare internă și reverificarea accesului la destinație.
4. Transport separat care păstrează eligibilitatea, preferințele, deduplicarea, încercările și stările de livrare existente. Nu se trimit automat mesaje către coada generală la activare.
5. Controale de instalare/permisiune numai pentru browsere compatibile. Se tratează distinct abonarea PWA și dispozitivele native.
6. Teste în sandbox și probă fizică pe contul `support@nitido.ro`, inclusiv fundal, atingere și revocare. Abia apoi poate fi evaluată publicarea.

Această analiză nu a schimbat schema, transportul, configurația LIVE, plățile sau programările. Nu au fost generate chei VAPID și nu s-au făcut abonări sau trimiteri.

## Rute de acces investigate

- Pluginul oficial Firebase este confirmat ca instalat și activ. Catalogul de unelte al sesiunii nu oferă o identitate Firebase separată; accesul CLI confirmat aparține contului indicat de beneficiar.
- Reînnoirea OAuth funcționează prin endpointul oficial deja permis. `addFirebase` este refuzat de Google cu `403 PERMISSION_DENIED`.
- Citirea aplicațiilor Android din proiectul existent este refuzată cu `404 NOT_FOUND`: «Firebase project 682573238031 not found». Nu există o configurație Firebase Android confirmată care să poată fi descărcată pe această rută.
- Descrierea oficială `projects.addFirebase` cere `firebase.projects.update`, `resourcemanager.projects.get`, `serviceusage.services.enable` și `serviceusage.services.get`. Răspunsul de eroare nu precizează care permisiune sau politică blochează operațiunea; nu s-au schimbat drepturi IAM și nu s-a creat alt proiect.
- Calea GitHub pentru verificarea bindingurilor și starea Apple rămâne blocată. Run-ul `39912891105`, pe SHA `b20fe075cf94e7b86eced1617dca8695498d88c8`, are joburi eșuate, fără pași pentru verificarea Apple și fără artefacte. Pagina run-ului confirmă mesajul «The job was not started because your account is locked due to a billing issue». Nu se presupune că secretele GitHub lipsesc și nu s-au extras valori de credențiale.

## Surse pentru probe

- [Compatibilitate PushManager — MDN](https://developer.mozilla.org/docs/Web/API/PushManager), verificată din pachetul public `@mdn/browser-compat-data` versiunea `8.1.7`: Chrome Android din 42; Safari iOS din 16.4, numai pentru web apps salvate pe ecranul principal.
- [Notificări prin service worker — MDN](https://developer.mozilla.org/docs/Web/API/ServiceWorkerRegistration/showNotification), aceeași bază de compatibilitate; constructorul `Notification` nu constituie implementarea transportului push pe telefon.
- [Descrierea oficială a API-ului Firebase](https://firebase.googleapis.com/$discovery/rest?version=v1beta1), metoda `projects.addFirebase` și permisiunile necesare.
- [Verificarea GitHub existentă](https://github.com/Nelu251174/nitido/actions/runs/39912891105).
- Fișierele existente: `public/sw.js`, `src/app/manifest.ts`, `src/components/PwaProvider.tsx`, `src/components/WebAlerts.tsx`, `src/lib/pushProviders.ts`, `src/lib/push.ts`, `src/lib/email.ts`, `src/lib/appointmentReminders.ts`, `ios/App/App/App.entitlements`.
