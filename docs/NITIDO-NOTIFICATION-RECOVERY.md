# E2 — recuperarea notificărilor întrerupte

Continuare de la candidatul sandbox `4e561c7971b23e4965464adbfd5ef9428afc52e4`, PR #49. E2 rămâne deschisă. Filtrul ANAF rămâne obligatoriu; firma fictivă nu este aprobată pentru a trece testele.

## Contract

- Fiecare încercare push/SMS primește un token atomic și un termen de 120 de secunde. Momentul începerii apelului extern este salvat înainte de apel.
- După expirare, o încercare întreruptă înainte de apel revine în coada de retry, fără resetarea limitei de încercări. Un worker vechi nu mai poate trimite sau finaliza încercarea nouă.
- Dacă apelul extern a început ori o înregistrare veche nu are această dovadă, rezultatul devine `DELIVERY_UNKNOWN`. Retry automat și retry ADMIN exclud aceste mesaje. Un răspuns autoritativ întârziat poate rezolva numai propria încercare.
- Timeouturile și erorile fără dovadă de respingere nu sunt tratate ca nelivrare. Un identificator de confirmare gol nu marchează mesajul ca trimis. Fallbackul SMS este blocat cât timp rezultatul push este necunoscut.
- SMS este legat de identitatea destinatarului la creare, numai dacă numărul identifică un singur utilizator. Înainte de trimitere sunt reverificate numărul, preferințele, proprietatea lucrării și eligibilitatea firmei. SMS-urile vechi fără identitate sunt suprimate pentru verificare, fără atribuirea retroactivă unui utilizator.

## Migrare și operare sandbox

Migrarea este aditivă și idempotentă: tabelul `notification_delivery_claims` și coloana nullable `notification_outbox.recipient_user_id`. Mesajele existente sunt păstrate. Nu există reset de date sau ocolire ANAF.

Configurare runtime: `NITIDO_NOTIFICATION_RECOVERY_ENABLED=true`, `NEXT_PUBLIC_SITE_URL=https://sandbox.nitido.ro` și `CRON_SECRET` existent de minimum 32 de caractere. Nu se generează un secret suplimentar. Endpointul POST `/api/cron/notifications` verifică secretul cu comparație constantă și refuză alte medii.

Comanda Coolify: `node /app/scripts/notification-recovery-runner.mjs`, programare `* * * * *`. Executabilul folosește exclusiv loopback, refuză redirecturile și publică numai contoare. O rulare selectează cel mult un mesaj push și unul SMS; procesarea push poate iniția separat fallbackul eligibil. Revendicările serializează încercările concurente. Selectat nu înseamnă livrat.

Workerul recuperează revendicările expirate chiar dacă furnizorii sunt dezactivați. Nu consumă încercări de trimitere când niciun canal nu este configurat și activat. Activarea workerului nu activează `PUSH_ENABLED` sau `SMS_FALLBACK_ENABLED`.

La rollback, opriți întâi acest task și evitați workers vechi și noi simultani: codul vechi nu cunoaște izolarea `DELIVERY_UNKNOWN`. Păstrați schema aditivă și backupul; nu resetați coada pentru a forța retrimiterea. Rezultatele necunoscute necesită verificarea furnizorului înaintea oricărei decizii manuale.

## Probe executate înainte de publicare

- 68 teste în 7 fișiere: revendicări, restart cu bază pe disc, două conexiuni SQLite, migrare repetată pe schema veche, concurență, răspuns întârziat, destinatari schimbați, eligibilitate și endpointul periodic.
- 3 teste pentru executabil: configurație, loopback fără redirect, răspunsuri invalide și eliminarea detaliilor sensibile din erori.
- TypeScript și lint au trecut inclusiv după ultima verificare de migrare; CI pe candidatul publicat rămâne gate obligatoriu pentru instalare.

Auditul read-only al sandboxului a găsit push/SMS dezactivate, configurații APNs/FCM/Twilio lipsă, zero dispozitive active, zero firme verificate, zero plăți locale și ambele cozi goale. `CRON_SECRET` este configurat. Nu există notificări reale restante recuperate de demonstrat pe aceste date.

Contul Stripe sandbox `acct_1UE6GE8ARvpRkNS9` a returnat zero PaymentIntents, fără pagină suplimentară. Căutarea operațiunii de creare prin conector a expus numai operațiuni GET; nu a fost creată o plată. Acest rezultat nu validează autorizare, challenge 3DS, captură, refund sau payout.

## Gate rămas deschis

1. Firmă reală verificată prin fluxul ANAF, eligibilă pentru zona lucrării; fără bypass.
2. Furnizor de notificări configurat, dispozitiv înregistrat și probă de primire reală, inclusiv reluare după întrerupere și verificare fără duplicate.
3. Probe Stripe sandbox complete: challenge pe dispozitiv, autorizare, captură, anulare/refund, webhookuri și reconciliere/payout cu identificatori corelați.
4. Verificări autentificate client/firmă/ADMIN și confirmarea stării lucrării după fiecare tranziție.

SHA, CI și rezultatul instalării se consemnează în dovezile operaționale ale livrării. Un task pornit cu o coadă goală dovedește funcționarea programării, nu primirea pe telefon. Producția nu este promovată prin această livrare.
