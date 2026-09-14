# NITIDO — telefon și acces, 14 septembrie 2026

## Rezultate executate

- Bază sandbox: `c1308835963b9a1a4476987b2a07820ea3d1c8d4`, verificată pe server.
- 109 teste trecute: securityRoutes, privateContextAccess, collaborationFlow, proofSecurity, collaborationAccess, auth, authorization, securityOrigin, admin/auth/login, pushDelivery și push.
- 37 teste mobile trecute: pushNative, pushSettingsCore și releaseReadiness. TypeScript mobil și rezolvarea configurației Expo au trecut.
- Pe sandbox, sesiunea cookie invalidă și Bearer invalid au primit 401 + `private, no-store` la jobs, workspace, collaboration, firm/earnings, account/client, account/firm, push/status, admin/overview și admin/payout-reconciliation.
- Probele automate includ fotografiile private, datele altui client, drepturile angajatului, revocarea/reasignarea și rezervarea capturii plății pentru firma alocată. Aceste rezultate nu reprezintă login real în cele patru interfețe.

## Configurare mobilă concretă

Autentificare Expo reușită; organizație `nitido-ro`, proiect `nitido-ro`, ID public `3887c4e7-445a-4954-9d04-7c8adc8519f9`. Nu există builduri, submissions sau credențiale iOS/Android în proiectul inspectat.

Codul este legat de proiectul real. Development și preview folosesc sandboxul HTTPS. Preview Android produce APK; configurația citește fișierul Firebase local sau variabila EAS de tip fișier GOOGLE_SERVICES_JSON. Identificatorul aplicației rămâne ro.nitido.app pe ambele platforme. Notificările preview au entitlement APNs production, care trebuie corelat cu providerul la configurare.

## Blocaje și următorii pași

- Server: PUSH_ENABLED=false, NITIDO_ENABLE_BEARER_AUTH=false, APNs și FCM incomplete. Nu au fost activate fără configurarea furnizorilor.
- Legătura Expo–GitHub cere autentificare/conectare separată. Nu este finalizată și nu s-au acordat permisiuni noi.
- Urmează semnarea iOS/Android, configurarea Firebase/APNs, build instalabil și înregistrarea telefonului prin contul său real.
- Probe fizice: mesaj și lucrare finalizată, aplicație deschisă/fundal/închisă, sunet, atingerea alertei, logout/relogin și lipsa duplicatelor.
- Accesul autentificat în sandbox rămâne deschis pentru CLIENT/FIRMĂ/ANGAJAT/ADMIN; nu s-au extras ori fabricat sesiuni de utilizator din baza sandbox.
- E2 rămâne deschisă. SMS amânat, producție și publicare în magazine neexecutate.
