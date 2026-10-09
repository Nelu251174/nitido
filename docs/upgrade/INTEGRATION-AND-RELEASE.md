# Integrare și lansare — candidat NITIDO operațional

Acesta este runbookul executat de agent prin conexiunile autorizate. Nu transferă utilizatorului comenzile de dezvoltare, migrare, backup sau publicare. Mandatul din conversație autorizează dezvoltarea și publicarea după verificări relevante, cu backup și posibilitate de revenire. Ștergerea datelor reale, cheltuielile noi și schimbările majore în afara brief-ului cer acord separat.

## Sursa și integrarea verificate

Ramura curentă este `codex/nitido-operational-completion`, continuare din PR #86 / `97938ad4f58f7d5a890cae0c1cc7dbd00dceec0f`. Commitul de reconciliere `dd74c22c0853262c63511a1d4a46359b6e474402` are părinții `97938ad` și `2101988542d989b46cb2c091922d16ddce334387`. El păstrează implementarea v1.1, istoria din main și protecțiile pentru fișiere locale; nu reintroduce Pro P0, analytics NEXUS sau endpointuri Stripe vechi. Detaliile sunt în `MAIN-RECONCILIATION.md`.

Reconcilierea de istorie este inclusă în ramura candidatului. **Nu înseamnă integrarea noului cod în `origin/main`**, care la ultima verificare rămâne la `2101988542d989b46cb2c091922d16ddce334387`. Operațiile locale și modificările încă necommituitate nu sunt o livrare remote. Agentul identifică SHA-ul final după commit și validează exact acel arbore în CI înaintea promovării.

Ramura de producție documentată anterior, `fix/windows-area-clear` / `9cbc59357c0a6b0aa29e91cdfb8d69c3de97ff35`, este strămoș al PR #85. Integrarea `59528ff` păstrează `docker-compose.production.yml`. Sursa efectiv instalată azi în Coolify rămâne neverificată; istoricul Git nu o dovedește.

## Module și limite funcționale

Pachetul continuă rolurile interne, regulile foto, KPI și rezoluțiile din PR #85, delegarea CRM/Pro, recurența zilnică și Provider Score în observare din PR #86. Extensiile operaționale sunt documentate în:

- `INCIDENT-SLA-INTERNAL-ALERTS.md`: inbox și escaladări interne, dezactivate implicit până la activarea cronului.
- `PRO-PORTFOLIO-DASHBOARD.md`: agregări server cu scope operațional/financiar separat, cohorte și calendar Europe/Bucharest; registrul Pro nu este presupus venit sau marjă NITIDO.
- `ASSESSMENT-OPERATIONAL-QUALIFICATION.md`: pregătire operațională prospectivă, fără backfill. Nu certifică eligibilitatea comercială; conversia exactă pe cereri eligibile rămâne `null`.
- `RELEASE-PREPARATION.md` și `BACKUP-RESTORE.md`: pregătire offline, backup complet v2 și restaurare izolată, distincte de acceptanța hostului.

Designul cream și fluxurile existente rămân baza. Nu se activează distribuția după Provider Score sau valori comerciale/fiscale neaprobate ca efect secundar al lansării.

## Puncte de integrare Stripe

Pachetul nu schimbă `payments`, autorizarea/capturarea, webhookurile, Connect, transferurile sau payouturile. Modulele existente rămân `payments.ts`, `authorizationAttempts.ts`, `paymentCancellation.ts`, `paymentConfirmation.ts`, `stripeInbox.ts` și rutele lor. Referințele de plată din fișa clientului sunt numai de citire; costul procesării din marjă se documentează, nu se presupune din suma capturată.

Oferta acceptată păstrează snapshotul. Motorul administrabil nu recalculează o comandă istorică înainte de plată. Schimbările de etichete, severitate sau termene și rularea SLA nu inițiază operațiuni financiare. Testele locale folosesc integrări simulate; nu certifică 3DS, webhook, refund sau reconciliere în contul real.

Agentul păstrează separarea test/live, cheile și conturile existente; nu copiază secrete de producție în sandbox și nu activează abonamente Pro. Regulile comerciale/fiscale și configurarea efectivă se verifică conform brief-ului și `../NITIDO-RELEASE-GATE.md`.

## Ordinea operării în sandbox

1. Agentul confirmă SHA-ul candidatului final, CI pe același SHA, identitatea aplicației sandbox și versiunea instalată. UUID-urile istorice din `RELEASE-PREPARATION.md` sunt numai repere până la reconfirmarea prin Coolify. Nu folosește Compose-ul producției pentru sandbox.
2. Inventariază baza, volumele, cele trei rădăcini de fișiere și scriitorii activi. Oprește toate procesele care pot modifica DB sau uploadurile. Pregătește backupul v2 și restaurarea izolată conform `BACKUP-RESTORE.md`; păstrează dovezile pe infrastructură protejată. `--quiesced` nu dovedește singur oprirea scriitorilor.
3. Păstrează configurațiile runtime specifice mediului, MFA și separarea Stripe test/live. Activările existente `NITIDO_MANAGED_PRICING_SANDBOX=true` și `NITIDO_MANUAL_OFFERS_SANDBOX=true` sunt valabile numai cu `NEXT_PUBLIC_SITE_URL=https://sandbox.nitido.ro` și fără secret Stripe live; nu se înlocuiesc automat variabilele existente.
4. Verifică schema Pro reală înaintea migrării. Dacă există Pro P0/legacy, refuzul migrării v1.1 nu se ocolește prin DROP sau marcarea artificială a versiunii. Este necesară analiza datelor efective și o migrare fără pierdere a istoricului. Dacă schema este v1.1 recunoscută, agentul migrează întâi copia izolată, apoi ținta după verificări, până la revizia 14. Se păstrează checklisturile, regulile foto, lucrările și aprobările existente. Documente: `PRO-PROPERTY-CHECKLISTS.md`, `INTERNAL-ROLES-PHOTOS-AND-RESOLUTIONS.md`, `PRO-DAILY-RECURRENCE.md`.
5. Inițializarea Marketplace adaugă prospectiv jurnalul pregătirii operaționale și schema SLA, fără a modifica deciziile sau datele istorice. Agentul instalează candidatul numai în aplicația identificată, verifică imaginea/SHA-ul servit, sănătatea containerului și scenariile din `CONSOLIDATED-QA.md`, inclusiv rolurile și noile panouri.
6. Pentru SLA, activează separat `NITIDO_INCIDENT_SLA_ALERTS_ENABLED=true` și configurează schedulerul autorizat pentru `POST /api/cron/incident-sla`, cu `x-cron-secret` din secretul existent `CRON_SECRET` (minimum 32 de caractere). Nu schimbă termenele configurate și nu inventează o cadență comercială; consemnează programarea tehnică și execuțiile efective. Fără flag, secret și scheduler confirmate, automatizarea rămâne neactivată. Nu există transport extern email/SMS/WhatsApp nou.
7. Repornește scriitorii existenți în mod controlat, verifică lipsa duplicărilor și consemnează rezultatele. „Success” la build nu închide acceptanța funcțională, iar existența endpointului nu dovedește un cron activ.

Căile de acceptanță includ `/admin#performanta`, `/admin#clienti`, `/admin#incidente`, evaluările și inboxul SLA, `/admin#catalog`, `/pro/dashboard`, `/pro/proprietati` și regulile foto/checklisturile proprietății, plus fluxurile Standard/Express/Pro existente. Aceste adrese nu sunt dovadă de publicare.

## Promovare și revenire

Agentul promovează același candidat verificat, după reconfirmarea aplicației LIVE, configurației, backupului complet și posibilității de revenire. `deploy.yml` și ținta webhookului generic nu se modifică pentru a testa un branch; un webhook cu țintă necunoscută nu este declanșat. Se păstrează configurațiile specifice mediului și volumul real; main, sandbox și LIVE se raportează separat.

Rollback-ul obișnuit revine la imaginea anterioară compatibilă, păstrând DB și fișierele actuale. Nu șterge tabelele sau evenimentele și nu suprascrie date noi cu un backup vechi. Dacă restaurarea datelor devine necesară, agentul oprește scriitorii, păstrează mai întâi starea curentă, restaurează într-un spațiu nou și reconciliază scrierile ulterioare înaintea comutării. Compatibilitatea imaginii vechi cu stările create după lansare se verifică efectiv.

Dezactivarea SLA înseamnă flag `false` și oprirea schedulerului acestui endpoint, păstrând alertele, confirmările și auditul. Revenirea codului pentru pregătirea cererilor sau dashboard nu șterge jurnalele, lucrările, costurile sau snapshoturile.

## Probe locale și acces efectiv — 09.10.2026

Simulatorul de release a fost executat local în `/workspace/nitido-release-simulation-20261009`. Raportul `simulation-report.json` are `status=passed`, `remoteCalls=0`, manifest v2 cu toate cele trei rădăcini și migrări Pro 12→13→14 idempotente, păstrând rândurile și snapshoturile sintetice. Planul folosește SHA `97938ad`; instrumentele aveau modificări locale în lucru. Aceasta este dovadă a simulatorului și a recuperării locale, **nu dovadă de backup, migrare sau publicare pe host** și nici certificarea noului SHA final.

GitHub este accesibil. Ultima încercare efectivă către Coolify a primit `CONNECT 403` înainte de autentificare; politica HTTP a mediului rămâne restricționată. Nu există sesiune/token Coolify sau secrete runtime configurate în acest mediu, nici un instrument expus agentului pentru a le configura. Nu se pretinde că autentificarea a fost încercată și respinsă: conexiunea este blocată înaintea ei.

Intervenția utilizatorului, dacă accesul nu poate fi pregătit prin conexiunile existente, se limitează la conectarea/autorizarea securizată: permiterea domeniilor `coolify.nitido.ro`, `sandbox.nitido.ro`, `nitido.ro` și furnizarea prin configurarea mediului a sesiunii/tokenului cu drepturi pentru aplicațiile și volumele relevante. Agentul execută apoi operațiunile tehnice. Nu se solicită parole sau chei în chat/repository.

Nu s-au confirmat backupul bazei reale, sursa instalată, migrarea pe host, un nou deploy sandbox/LIVE sau activarea cronului SLA. Rezultatele locale se consemnează în rapoartele QA; stările remote rămân neverificate până la acces și probe actuale.

## Mobil

NITIDO folosește aplicația Capacitor existentă. Un update web nu dovedește un build nou în TestFlight sau Google Play. Agentul folosește `../NITIDO-TESTFLIGHT-UPDATE.md` și ghidurile existente pentru App Store/Google Play și consemnează separat numărul buildului, procesarea și distribuția. Această distribuție nu a fost efectuată în sesiunea curentă.
