# NITIDO — situația celor 6 etape din brief

Sursa numerotării: `NITIDO-MASTER-SOURCE.md`, §18. Documentul urmărește execuția și acceptarea separat. Nu reprezintă acceptarea beneficiarului.

Actualizare operațională 13 septembrie 2026: candidatul `356fade` este instalat în sandbox și healthy, inclusiv configuratorul public în trei pași și păstrarea formularului la adăugarea cardului. Restaurarea izolată a copiei producției a fost verificată pe candidatul anterior `c04d0d4`; dovezile nu sunt atribuite automat candidatului nou. Webhookurile Stripe și schedulerul financiar sunt configurate în sandbox. Producția rulează încă `f3584d3`. Dovezi, limite și restanțe: [NITIDO-STAGING-20260913.md](NITIDO-STAGING-20260913.md).

| Etapă | Starea execuției | Condiție rămasă pentru închidere |
|---|---|---|
| E0 — Audit P0 | Audit tehnic și probleme documentate în mai multe continuări | Consolidarea matricei integrale existent/parțial/lipsă/defect și a dependențelor; închiderea formală nu este consemnată |
| E1 — Design P1 | Redesign web/mobil implementat parțial față de întregul brief | Toate stările și ecranele principale demonstrate și acceptate vizual |
| **E2 — Nucleu P0/P1** | **Etapa activă: fluxuri, acces, plăți, notificări și admin; rezervare atomică a firmei, recuperare periodică sandbox și MFA admin adăugate** | Fluxuri complete pe staging, provocări Stripe, QA autentificat și probe de integritate/concurență; restul cerințelor nucleului |
| E3 — Recurență P2 | Proprietăți, serii și calendar implementate parțial | Completare și acceptare a politicii financiare pe vizită, anulărilor, preferințelor și capacității |
| E4 — Business P3 | Locații, aprobări, rapoarte și Host implementate parțial | Funcții organizaționale/integrări rămase și pilot cu izolare și sincronizare validate |
| E5 — Lansare | Proceduri, gate și instrumente de pregătire existente; aprobarea de publicare este primită | Dovezile tehnice restante, backup off-site și probe foto, acceptare finală și promovarea candidatului în producție |

După E2 urmează 3 etape principale: E3, E4 și E5. Rămân de închis și restanțele E0/E1. Dezvoltarea unor componente din E3/E4 nu echivalează cu acceptarea acelor etape.

## Livrarea curentă în E2

- Cererea de actualizare producție verificată direct pe server: backup proaspăt și pornire izolată pe candidatul actual trecute; promovare blocată de configurația live și gate-uri neînchise. [Rezultate concrete](NITIDO-PRODUCTION-PREFLIGHT-20260913.md).

- Calendarul clientului folosește ora României și reverifică intervalele expirate înainte de publicare. Instalat în sandbox; 62 teste de regresie trecute. [Dovezi și limite](NITIDO-CLIENT-CALENDAR.md).

- Continuitatea formularului la adăugarea cardului implementată, testată și instalată în sandbox; proba autentificată completă rămâne deschisă. [NITIDO-CARD-BOOKING-CONTINUITY.md](NITIDO-CARD-BOOKING-CONTINUITY.md).

- Configurator public `/rezervare` transformat în trei pași funcționali, cu validări, editarea alegerilor și păstrarea programării până la login. Instalat în sandbox; probe și limite: [NITIDO-BOOKING-WIZARD.md](NITIDO-BOOKING-WIZARD.md).

- API-urile private trimit no-store; accesul fără sesiune validă este refuzat. Loginul păstrează rolul și destinația firmei/spațiilor operaționale, inclusiv query și fragment. Probe HTTP și browser executate pe sandbox: [NITIDO-DASHBOARD-ACCESS.md](NITIDO-DASHBOARD-ACCESS.md). Acceptarea după autentificare rămâne deschisă.
- Healthcheck HTTP + citiri SQLite inclus în imagine și activat în Coolify; container healthy și pagină disponibilă. Restaurare izolată cu păstrarea celor 9 înregistrări de plată din copia producției; fără promovare în producție și fără a declara reconcilierea Stripe închisă.
- Recuperare financiară periodică instalată în Coolify sandbox la fiecare minut; prima rulare automată și istoricul SQLite confirmate. Lotul era gol: recuperarea unei operațiuni Stripe rămâne de demonstrat. [Dovezi și limite](NITIDO-FINANCIAL-RECOVERY.md).
- Webhook Connect separat, cu secret propriu, verificarea modului test/live și a contului firmei, instalat și verificat în sandbox. CI verde; livrarea reală Stripe și reconcilierea financiară rămân deschise. [Contract și acceptare](NITIDO-STRIPE-CONNECT-WEBHOOK.md).

## Livrarea precedentă: recuperarea selecției

- Dovadă durabilă a selecției Standard salvată împreună cu autorizarea locală a plății.
- Recuperare după restart, fără o nouă autorizare sau încasare; verificări de identitate, sumă, token și stare, cu audit idempotent.
- Acțiune de recuperare în detaliul lucrării pe web și mobil; acces numai pentru clientul proprietar.
- Limite, migrare și probe: [NITIDO-SELECTION-RECOVERY.md](NITIDO-SELECTION-RECOVERY.md). Cazurile fără dovadă și recuperarea automată integrală rămân deschise.

## Livrarea precedentă: integritatea alocării

- Disponibilitatea firmei și rezervarea lucrării sunt verificate în aceeași tranzacție SQLite, inclusiv la selecția Standard.
- Durata și timpul de deplasare salvate pe lucrare determină suprapunerile; planificările active incomplete nu sunt tratate drept capacitate liberă.
- Retragerea ofertelor este coordonată cu selecția și autorizarea; actualizările finale ale ofertelor sunt atomice.
- Mesaj distinct pentru lipsa disponibilității în API și mobil. Limite și probe: [NITIDO-ALLOCATION-INTEGRITY.md](NITIDO-ALLOCATION-INTEGRITY.md).
- Aprobarea de publicare a fost primită. Backupurile locale și deploymentul sandbox sunt confirmate; înrolarea MFA și promovarea candidatului în producție rămân deschise. Vezi actualizarea operațională de mai sus.

## Livrările precedente păstrate

- MFA obligatoriu pentru contul admin configurat: parolă + TOTP sau cod de recuperare de unică folosință.
- Sesiuni legate de configurația factorilor, revocare după rotație și refuzul sesiunilor vechi fără MFA.
- Limită de login persistentă, audit fără credențiale și utilitar offline de înrolare în fișier privat.
- Înrolarea reală și verificările MFA în staging nu sunt efectuate; trebuie pregătite înainte de instalarea versiunii pe țintă.
- Livrarea precedentă a adăugat recuperarea periodică sandbox, cu restart, retry și istoric în admin. Schedulerul este acum activ pe țintă; probele cu restanțe financiare și verificarea autentificată a istoricului în admin rămân deschise.

MFA, înrolare, migrare și recuperare: [NITIDO-ADMIN-MFA.md](NITIDO-ADMIN-MFA.md).
Operare și limite: [NITIDO-FINANCIAL-RECOVERY.md](NITIDO-FINANCIAL-RECOVERY.md).
Condițiile externe încă deschise: [NITIDO-RELEASE-GATE.md](NITIDO-RELEASE-GATE.md).
SHA-ul candidatului și CI-ul aferent sunt consemnate în PR #49; rezultatele etapelor anterioare nu se atribuie automat candidatului nou.

Nu se raportează un procent de finalizare din numărul testelor. E2 rămâne deschisă până la probele cerute de brief.
