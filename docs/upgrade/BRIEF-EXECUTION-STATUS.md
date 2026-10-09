# NITIDO Upgrade v1.1 — situație consolidată

Data: 09.10.2026. Candidat: ramura `codex/nitido-operational-completion`, continuare din PR #86 / `97938ad4f58f7d5a890cae0c1cc7dbd00dceec0f`, peste PR #85 / `4c8315148504bc2edd98a5d9b155763db987b339`. Reconcilierea istoriei main este commitul candidat `dd74c22`; pachetul operațional nou este grupat în această ramură, împreună cu probele sale.

Brieful integral primit de la proprietar este păstrat în [MASTER-BRIEF-v1.1.md](MASTER-BRIEF-v1.1.md), SHA-256 `1bdd7c191df26cd3445cb1e09d4baca44fc6379e1d8670276bc70e8f7ec65024`. Documentul este referința cerințelor; afirmarea dintr-un brief nu constituie dovadă de implementare.
Referință normativă: MASTER BRIEF v1.1, amendamentele A–H din 24.09.2026. Documentele A0–A4 descriu probele la momentul fiecărui pachet; acest inventar le reunește și explică limitele actuale. Un PR, o schemă sau un test unitar nu constituie acceptanță live.

## Ce include această livrare

Ramura continuă PR #86 și PR #85, care includ PR #84 (`66ab20494b54f11a547207e70063afd4dace5429`) și istoricul pachetelor anterioare. Nu este nevoie să se copieze manual fișierele din fiecare PR pentru a evalua candidatul. Merge-ul `dd74c22` aduce istoria main în candidat; nu publică schimbările în `origin/main` sau în producție.

1. Raport administrativ Marketplace cu selecție coerentă, costuri confirmate separate de cele necunoscute și indicatori ai prestatorilor în observare.
2. Fișă client cu căutare, clasificări, note, restricții explicite versionate, istorice paginate și valoare/marjă cumulate.
3. Severitate, responsabil intern, versiuni SLA și termene urmărite în dosarul de incident, fără valori activate implicit.
4. Instrumente pentru backup SQLite și restaurare izolată; manifestul de recuperare v2 include și `public/uploads`, `data/uploads`, `data/pro-uploads`, cu integritate, relații, schema, numere de rânduri și hashuri verificate.
5. Editor administrativ de checklisturi Marketplace cu liste înghețate pe lucrare și păstrarea regulilor istorice; `CRM-AND-EXECUTION-CONTROLS.md`.
6. Checklisturi Pro administrabile pe proprietate și serviciu, istoric paginat și snapshot la crearea lucrării, inclusiv recurențe; `PRO-PROPERTY-CHECKLISTS.md`.
7. Roluri nominale Operator/Manager/Financiar/Super Admin cu MFA și revocare, reguli foto Marketplace/Pro, indicatori suplimentari și rezoluții auditate; `INTERNAL-ROLES-PHOTOS-AND-RESOLUTIONS.md`.
8. Delegare granulară a CRM și Pro pentru rolurile nominale, inclusiv redacție server-side și audit; `INTERNAL-DELEGATION-COMPLETION.md`.
9. Recurență Pro zilnică, pauză/reluare, dată finală inclusivă și migrare aditivă 14 compatibilă cu rollback; `PRO-DAILY-RECURRENCE.md`.
10. Registru deduplicat al invitațiilor trimise confirmate și KPI cu cohorte explicite; `PROVIDER-INVITATIONS-AND-KPI.md`.
11. Provider Score configurabil numai pentru observare, fără ponderi implicite sau impact automat; `PROVIDER-SCORE-OBSERVATION.md`.
12. O singură comandă de regresie și un workflow CI care include etapele precedente și modulele noi; documentație consolidată de operare și lansare.
13. Jurnal prospectiv de **pregătire operațională pentru planul verificat**, verificări nominale atomice, snapshoturi și revalidare/staleness; raport separat cu cohorta completă, fără backfill sau eligibilitate comercială presupusă; `ASSESSMENT-OPERATIONAL-QUALIFICATION.md`.
14. Worker și inbox de alerte/escaladări SLA interne, cu deduplicare, cursor, audit și preluare nominală. Workerul este **dezactivat implicit**; `INCIDENT-SLA-INTERNAL-ALERTS.md`.
15. Dashboard Pro cu agregări server-side pe întregul scope autorizat, filtre, calendar București, paginare și costuri necunoscute explicite; `PRO-PORTFOLIO-DASHBOARD.md`.
16. Canonicaluri și sitemap public Pro condiționate de flaguri, robots cu separarea suprafețelor private și imagine Open Graph în designul crem; indexarea cere activare explicită pe domeniul LIVE.
17. Planuri de release offline separate pentru sandbox/producție și simulator local de backup/restaurare/migrare, fără apeluri remote; `RELEASE-PREPARATION.md`.

Suprafețele noi folosesc crem, iar acțiunile păstrează verdele. Nu s-a modificat arhitectura Stripe, nu s-au activat ponderi de scor, tarife comerciale Pro sau praguri financiare presupuse.

## Stări verificate separat

| Stare | Dovadă și limită actuală |
|---|---|
| Implementat în candidat | Pachetul de mai sus este prezent local pe `codex/nitido-operational-completion`; include reconcilierea istorică `dd74c22` și modulele operaționale noi |
| Testat local | **1.743/1.743 teste Vitest trecute în UTC și Europe/Bucharest**, confirmate prin rapoartele JSON după fixul seedului estimatorului. 44/44 teste Node după corecția recovery WAL staging, 122 teste mobile și typecheck mobile au trecut. Buildul de producție webpack a încheiat cu exit 0, 148 de pagini, TypeScript și fonturi incluse; ESLint pe 39 de fișiere are zero avertismente. Buildul Docker pe bază nouă cu Turbopack a trecut; proba runtime Docker finală trece pe UID1001/Node22, fără rețea; browserul final trece 31/31 scenarii și 108/108 layouturi fără erori JavaScript. HTTP public Pro activ/dezactivat trece 8/8 și 5/5 verificări pe builduri separate. Simulatorul și cele 9 teste recovery/release au trecut pe date sintetice |
| Integrat în main | `origin/main` rămâne `2101988542d989b46cb2c091922d16ddce334387`; pachetul candidat nu este integrat în main. Reconcilierea din candidat nu schimbă această stare |
| Publicat sandbox / LIVE | Niciun deploy nou sau SHA instalat actual nu este verificat. Accesul Coolify și la domeniile țintă este blocat tehnic în mediul curent; instalațiile documentate anterior sunt dovezi istorice |
| Migrări pe infrastructură | Pro 13/14 și schemele aditive noi există în cod; simulatorul Pro 12 → 13/14 a trecut local. Nu este consemnată executarea lor pe baza sandbox/LIVE |

Rezultatele anterioare ale PR #86 — 1.661 teste în ambele fusuri și probele browser descrise în `V11-COMPLETION-QA.md`/`ENVIRONMENT-ACCEPTANCE.md` — rămân dovezi pentru acel pachet. Ele nu sunt declarate acceptanță a suprafețelor operaționale noi, a infrastructurii sau a dispozitivelor fizice.

## Acoperirea cerințelor

| Domeniu din brief | Cod și dovezi existente | Ce rămâne deschis |
|---|---|---|
| A0 — baza de verificare | Inițializare comună, fixture migrate, recuperare acceptare/plată, calendar în UTC/România; `A0-validation.md` | Standard/Express/Pro pe roluri în sandbox și proba de infrastructură |
| A1 — pricing configurabil | `managedPricing*`, `bookingQuotes`, Admin Pricing; paritate, simulator, conflict de publicare, audit atomic, expirare, snapshot; `A1-pricing.md`, `A1-booking-quotes.md` | Configurarea și parcurgerea checkout-ului real în sandbox; activarea producției nu este făcută |
| A2 — ofertare, marjă și excepții | Evaluare → dovezi → estimare → ofertă → programare → rezervare; marjă estimată/efectivă și policy/excepții auditate | Valori comerciale/fiscale aprobate și testare operațională; costurile necunoscute rămân necunoscute |
| Capacitate și alocare | `assessmentPlan`, `assistedOperations`, verificare/rezervare atomică; `A2-atomic-team-allocation.md` | Configurarea echipelor și capacității reale; proba concurentă pe mediul țintă |
| Pregătirea operațională a cererilor | Marker prospectiv la creare, jurnal imuabil, plan/capacitate/dovezi din regulile existente, audit atomic și stare stale la schimbări; cohortă completă inclusiv `pending`, `unavailable`, `legacy_unknown` | Nu certifică eligibilitatea comercială, nu rezervă capacitate și nu autorizează ofertare/alocare. Conversia exactă pe cereri eligibile rămâne indisponibilă; fără reconstrucție fictivă a istoricului |
| Express și oportunități | Eligibilitate la citire și mutație, minimizare înainte de alocare, izolare ofertă asistată, un câștigător; documentele A3 de eligibilitate | Validare pe configurația reală de documente/zone/servicii; distribuția după un scor nou nu este activată |
| Provider Score | Politici configurabile versionate/imuabile, perioadă comună București, volume minime și date lipsă explicite; Quality Index păstrat | Configurarea politicii pentru pilot și validarea înainte de impact automat; distribuția graduală nouă nu este implementată |
| Incidente/remedieri | `visitCare`, verificări și rezoluții versionate/auditate, severitate, responsabil, termene; worker/inbox SLA interne deduplicate, verificare curentă și preluare nominală | Worker implicit off; schedulerul, configurația reală, destinatarii și acceptanța trebuie verificate pe mediu. Transporturile externe și creditul/penalizarea efectivă conform politicii comerciale rămân deschise |
| Dovezi/checklist | Editor Marketplace pe Standard/Express și categorii de evaluare, revizii auditate, copii imuabile pe lucrare, sarcini nerealizabile, raport/finalizare coerente; editor Pro pe proprietate/serviciu cu revizii și istoric | Reguli foto diferențiate implementate cu snapshot Marketplace/Pro; rămân executarea migrărilor Pro 13–14 pe infrastructură și validarea în sandbox/dispozitive |
| CRM operațional | Fișă internă, etichete, note, restricții tranzacționale la rezervări/evaluări/recurențe, valoare și marjă pe întregul istoric, costuri lipsă explicite | Delegare nominală CRM/Pro implementată; segmentarea avansată și validarea reală a restricțiilor și totalurilor rămân deschise |
| Organizații/proprietăți Pro | Scope pe organizație/proprietate, roluri Pro, acces sensibil în fereastra lucrării; `NITIDO-PRO-V11-IMPLEMENTATION.md` | Pilot real cu portofolii, echipe și acces verificat; model comercial încă neactivat |
| Recurență/aprobări/rapoarte Pro | Daily/weekly/biweekly/monthly, retry fără duplicate, DST București, pauză/reluare, limite calendar, rework și închidere, CSV autorizat; dashboard de portofoliu fără trunchierea agregărilor, scope financiar separat | Executarea migrației 14 pe mediu țintă, validare browser/dispozitive și pilot; marja internă Pro rămâne explicit necunoscută în lipsa componentelor financiare necesare |
| Roluri interne NITIDO | Conturi nominale cu MFA, roluri și drepturi server-side, revocare și audit | Delegare CRM/Pro nominală implementată; provisionare conturi MFA și acceptanță sandbox rămân deschise |
| KPI și A5 | Stări Marketplace, reclamații distincte, mediane/rate, marjă documentată, valoare istorică, filtre serviciu/cod poștal și registru invitații; dashboard Pro pe cohorte explicite; raport prospectiv de pregătire operațională separat | Conversia exactă pe cereri eligibile rămâne indisponibilă: jurnalul operațional nu definește denominatorul comercial. Marketplace și Pro păstrează cohorte distincte; raportarea comună, validarea pe date reale și pilotul rămân deschise |
| SEO public | Canonicaluri/sitemap pentru paginile Pro publice, robots și Open Graph crem; teste ale flagurilor și separării public/privat | Indexarea cere `SITE_PUBLIC_INDEXING=true` pe domeniul LIVE și flagul public Pro; configurația și răspunsurile instalate nu sunt verificate. Suprafețele private/sandbox nu devin indexabile implicit |
| Mobil | Cod Capacitor existent și corecțiile de aspect anterioare sunt păstrate; suprafețe crem | Parcurgere reală iOS/Android; build încărcat, procesat și distribuit separat în TestFlight/Google Play. Un deploy web nu dovedește un update în magazin |
| Backup/deploy | Manifest v2 DB + toate cele trei rădăcini de upload, compatibilitate v1, restaurare exclusiv în director nou; simulator local Pro 12 → 13/14, păstrarea datelor noi și planuri offline separate | Sursa/imaginea/schema/volumele reale, oprirea scriitorilor, backupul și restaurarea host, migrarea, deployul și rollback-ul efectiv rămân de verificat; planurile au `readyForDeployment=false` |

**Brief-ul nu este închis integral.** Regresia completă după fixul de startup a trecut 1.743 teste în fiecare fus, UTC și Europe/Bucharest. Aceste rezultate nu înlocuiesc acceptanța sandbox/LIVE. Tabelul separă explicit lipsurile de cod de probele operaționale și de deciziile comerciale. Nu există o bază verificată pentru un procent de finalizare sau pentru afirmația „tot P0 este gata”. Distribuția graduală Express după Provider Score nu a fost implementată sau activată; necesită politica operațională și pilotul. Conversia exactă pe cereri eligibile nu poate fi dedusă din istoricul disponibil sau substituită cu pregătirea operațională. Aceste lacune nu sunt reclasificate drept simple aprobări lipsă.

## Livrabile obligatorii §30

| Nr. | Livrabil și locație | Stare |
|---|---|---|
| 1 | `NITIDO_EXISTING_SYSTEM_AUDIT.md` în acest director | Audit inițial păstrat, cu referința și limitele lui; rezultatele vechi nu sunt starea de azi |
| 2 | Acest inventar + documentele A0–A4 | Plan corelat cu module și lacune explicite |
| 3 | `IMPLEMENTATION-INVENTORY.md` + diff-ul PR-ului | Fișierele noului pachet și modulele etapelor precedente |
| 4 | `BACKUP-RESTORE.md`, `RELEASE-PREPARATION.md`, documentele A1/A2/A3, `NITIDO-PRO-V11-IMPLEMENTATION.md` | Migrații și simulator local; rollback pe infrastructură neexecutat |
| 5 | Codul din ramura consolidată | P0 parțial; vezi matricea, nu etichetă de finalizare |
| 6 | `A1-pricing.md`, `A1-booking-quotes.md` | Ghid registru/simulator și rezervare cu ofertă versionată |
| 7 | `CONSOLIDATED-OPERATIONS.md`, `A3-opportunity-eligibility.md`, `A3-assisted-offer-eligibility.md` | Observare și eligibilitate; ponderi neactivate |
| 8 | `A3-incident-review.md`, `CONSOLIDATED-OPERATIONS.md`, `INCIDENT-SLA-INTERNAL-ALERTS.md` | Verificări, note interne, responsabilitate, termene și alerte interne implicit dezactivate |
| 9 | `NITIDO-PRO-V11-IMPLEMENTATION.md`, documentele A4, `PRO-PORTFOLIO-DASHBOARD.md` | Ghiduri, integritatea operațiilor și raportare de portofoliu; pilot deschis |
| 10 | `CONSOLIDATED-QA.md`, stările din acest document și ghidurile modulelor noi | 1.743 teste UTC și 1.743 București, 44 Node, 122 mobile, build/TypeScript/ESLint trecute. Runtime Docker final trecut; browser 31/31 și 108/108 layouturi, HTTP 8/8 + 5/5; fără PASS fictiv pe infrastructură/dispozitive |
| 11 | `INTEGRATION-AND-RELEASE.md`, `NITIDO-RELEASE-GATE.md` | Integrarea Stripe existentă păstrată; configurarea reală nu a fost schimbată |
| 12 | Backlogul de mai jos | P1/P2 și motive distincte de lacunele P0 |
| 13 | `INTEGRATION-AND-RELEASE.md`, `RELEASE-PREPARATION.md` | Candidat → sandbox → dovezi → producție; planuri offline fără publicare efectuată |
| 14 | `BACKUP-RESTORE.md`, `RELEASE-PREPARATION.md` + scripturi/teste | Probă sintetică DB + trei rădăcini făcută; restaurarea completă a infrastructurii rămâne deschisă |
| 15 | Secțiunea de acces din `INTEGRATION-AND-RELEASE.md` | Cod transmis în repository; accesul la servicii nu poate fi declarat predat/verificat în lipsa sesiunilor corespunzătoare |

## Backlog P1/P2

- Promoții și segmentare avansată: după stabilizarea clasificărilor și regulilor de preț; nu se activează discounturi fără politică.
- SLA intern: codul pentru alerte/escaladări este implementat, implicit off; activarea și execuțiile reale cer verificarea configurației/schedulerului și acceptanță. Transporturile externe email/SMS/WhatsApp rămân P1, cu infrastructura și regulile aplicabile verificate.
- Facturare/documente B2B: după model contractual și fiscal aprobat; marja operațională nu este profit contabil.
- Rapoarte și exporturi avansate: dashboardul Pro de portofoliu este implementat; raportarea comună Marketplace/Pro și extensiile se construiesc pe definiții de KPI și date de pilot. Exportul Pro existent rămâne disponibil conform permisiunilor.
- Conversia exactă pe cereri eligibile: necesită definiția comercială și instrumentarea ei verificabilă; jurnalul prospectiv de pregătire operațională nu o înlocuiește și nu fabrică un denominator istoric.
- Configurații comerciale/fiscale, credit/penalizări și model Pro: valorile aprobate, configurarea și pilotul real rămân necesare; codul nu a activat implicit tarife sau ponderi.
- Matching/recomandări/scor activ: după observație și validare; ofertele pierdute nu devin refuzuri.
- Integrare contabilă, API extern, automatizări B2B: necesită contracte și fluxuri validate. Nu se construiesc pe presupuneri.
- Aplicație nativă nouă: exclusă de amendamente. Compatibilitatea și distribuția actualei aplicații Capacitor rămân de verificat și nu sunt amânate fictiv la P2.
