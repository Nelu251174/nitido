# Inventar de implementare

Stare la 09.10.2026: candidatul `codex/nitido-operational-completion` continuă PR #86 / `97938ad4f58f7d5a890cae0c1cc7dbd00dceec0f` peste PR #85 / `4c8315148504bc2edd98a5d9b155763db987b339`. Commitul `dd74c22` reconciliază istoria main în candidat; modulele operaționale noi descrise la final sunt grupate în ramura candidatului. `origin/main` rămâne `2101988542d989b46cb2c091922d16ddce334387`. Acest inventar nu declară integrarea candidatului în main, un deploy sandbox/LIVE sau migrări executate pe host.

## Fișiere noi în pachetul consolidat

| Fișier/modul | Rol |
|---|---|
| `src/lib/operationsSchema.ts` | Schema suplimentară ca modul fără dependențe runtime către servicii; evită cicluri în inițializarea Next |
| `src/lib/operationalReport.ts` | Raport coerent Marketplace, marjă documentată, observare prestatori |
| `src/lib/incidentTriage.ts` | Politici de termene, responsabilitate, severitate, revizii și alerte interne |
| `src/lib/customerOperations.ts` | Căutare client, fișă, clasificări, note, istorice paginate |
| `src/app/api/admin/operational-report/route.ts` | Citire raport numai pentru Admin autentificat |
| `src/app/api/admin/incident-triage/route.ts` | Configurare și preluare cu origine verificată și audit atomic |
| `src/app/api/admin/customers/route.ts` | Fișă internă și mutații administrative auditate |
| `src/components/AdminOperationalReport.tsx` | Raport și filtre, suprafețe crem |
| `src/components/AdminIncidentTriage.tsx` | Configurare termene și preluare dosar |
| `src/components/AdminCustomers.tsx` | Fișă client și istorice |
| Testele `.test.ts` aferente celor 6 module/rute | Logică, validare, acces, audit, concurență și păstrarea datelor |
| `scripts/verify-database-backup.mjs`, `.test.mjs` | Backup SQLite și restaurare izolată; teste WAL și refuzuri corecte |
| `.github/workflows/upgrade-consolidated.yml` | Regresie UTC/România, restaurare, TypeScript și build |
| Documentele din acest pachet | Inventar, operare, QA, deploy și restaurare |

Fișiere extinse: `src/lib/db.ts` (schema aditivă), `src/app/admin/page.tsx` și `src/components/WorkspaceNav.tsx` (intrări admin), `AdminIncidentReviews.tsx` (integrare triage), `package.json` (comenzi consolidate), `Dockerfile` (script disponibil în runtime).

## Gruparea etapelor precedente

- A0: `initializeDatabase` și fixture-urile pentru schema efectivă; teste Standard/Express, recuperare, calendar și Pro.
- A1: `managedPricing*`, `bookingQuotes`, Admin Pricing, API admin pricing și quote, legătura către snapshotul rezervării.
- A2: `assessments`, `assessmentEvidence`, `manualEstimates`, `operationalMargin`, `manualOffers`, `marginPolicy`, `manualOfferBooking`, `assessmentPlan`, `assistedOperations`, `jobActualCosts`.
- A3: `incidentReview`, `visitCare`, `workspace`, `proofOfWork`, `reportArchive`, eligibilitate oportunități/acțiuni și snapshot de execuție.
- A4: `src/lib/pro/core.ts`, `schema.ts`, API Pro, calendar, replanificare, rework, închidere, CSV și acces la notificări.
- Aspect: `workspace-theme.css`, componente workspace/Pro și corecții anterioare de meniu. Noile componente refolosesc tema crem.

Inventarul exact al modificărilor față de o versiune se obține din diff-ul Git pentru SHA-urile respective; lista nu pretinde că fiecare fișier al repository-ului a fost rescris sau reverificat în acest pachet.

## Extensie CRM și checklisturi

- `customerRestrictions.ts`, `customerOperations.ts`: controale versionate, păstrate în aceeași tranzacție cu rezervarea/evaluarea; recurența raportează seria blocată fără a avansa cursorul.
- `customerValue.ts`: valoarea serviciilor finalizate și marja pe întregul istoric, cu necunoscutele păstrate.
- `executionTemplates.ts`, `executionTemplatesShared.ts`, `AdminExecutionTemplates.tsx`: publicare administrativă, copii imuabile pe lucrare și randare coerentă în conturile autorizate.
- `CRM-AND-EXECUTION-CONTROLS.md`: scope, compatibilitate, limite Pro/foto și scenarii de acceptanță în sandbox.

## Checklisturi Pro pe proprietate

- `src/lib/pro/schema.ts`: migrare explicită aditivă 12, revizii imuabile; păstrează snapshoturile lucrărilor existente.
- `src/lib/pro/core.ts`: configurare pe proprietate/serviciu, scope Owner/Manager/Operator Pro, conflict de versiune, audit atomic, snapshot și referința reviziei la crearea lucrării.
- API Pro: citire/editor doar în scope, istoric paginat, autorizare inclusiv înainte de replay-ul noii comenzi.
- `PropertyChecklists.tsx`: formular crem, instrucțiuni, revenire la punctele standard printr-o publicare nouă, istoric.
- `propertyChecklists.test.ts` și testele API: migrare, concurență, izolare, audit și recurențe.

## Roluri, foto, indicatori și rezoluții

- `adminRolesShared.ts`, `adminStaff.ts`, `adminAuth.ts`: conturi nominale, MFA, matrice de permisiuni, revizii și revocarea sesiunilor.
- API `auth/me`, `staff`, `workbench`; `AdminStaff`, `AdminRoleWorkspace`, `AdminInternalJobs`: suprafețe crem, listare limitată și redacție financiară.
- `executionTemplates*`, `proofOfWork`, `collaborationAccess`, `TeamExecutionCard`: cerințe foto versionate și aplicate în fluxurile Marketplace.
- Schema Pro 13, `core.ts`, API media, `PropertyChecklists`, `Workspace`: reguli pe proprietate/serviciu, snapshot, upload la sosire și dovezi noi la remediere.
- `operationalReport`, `AdminOperationalReport`: cohortele și definițiile indicatorilor, filtre serviciu/cod poștal, necunoscute explicite.
- `incidentResolution*`, API și componentă; `VisitCare`: rezoluții, dovezi de finalizare, permisiuni și afișare publică fără note interne.
- `INTERNAL-ROLES-PHOTOS-AND-RESOLUTIONS.md`: configurare, migrare, limite și acceptanță.

## Completarea v1.1 din 09.10.2026, după PR #85

- `customerAccess.ts`, API Customers, `AdminCustomers`: delegare CRM și redacție financiară.
- `pro/internalAccess.ts`, API Pro, `Workspace`: allowlist implicit interzis pentru rolurile interne, autor nominal, replay autorizat, UI după drepturi.
- Pro schema/core și `pro-migrate.mjs`: migrare 14, recurență daily, pauză/reluare/end_date; compatibilitate cu vechiul runner.
- `providerInvitations.ts`, schema și hooks notificări/ofertare/alocare: jurnal deduplicat și atomic al invitațiilor trimise confirmate, fără backfill fictiv.
- `operationalReport`, `AdminOperationalReport`: KPI ale brief-ului și acoperire/date incerte explicite.
- `providerScore{Shared,Schema,Report}.ts`, `providerScore.ts`, API și `AdminProviderScore`: politică versionată în observare, fără alocare automată.
- `ids.ts`, `db.ts`, `proofOfWork.ts`: eliminarea ciclului de import observat în testele push.
- `firmAvailability.ts`: respingerea duratelor/bufferelor negative înainte de agregare, două cazuri de regresie.
- Fixture-uri și teste existente: inițializare reală și contracte actuale; fără modificări ale codului Stripe.
- `package.json`, workflow consolidat: toată suita Vitest în UTC/București, toate scripturile, TypeScript și build.
- `CatalogFirmCapacity.tsx`: corecție de overflow a controalelor native date/time, fără schimbarea aspectului.
- `qa-local-browser.mjs`: browser izolat cu MFA reală pentru cele patru roluri; nu modifică mediile instalate.
- Documentele de completare și brieful integral: trasabilitate, administrare, QA și limite de publicare.

## Completarea operațională prospectivă, după PR #86

| Fișier/modul | Implementare și limite |
|---|---|
| `src/lib/assessmentQualification{Schema,Shared}.ts`, `assessmentQualification.ts` | Schema leaf aditivă, istoric imuabil și jurnal de pregătire operațională pentru planul verificat. Refolosește planul/capacitatea/dovezile existente; stări pending/ready/unavailable/legacy_unknown, snapshoturi și revalidare/staleness. Nu definește eligibilitatea comercială și nu rezervă capacitate |
| `src/lib/assessments.ts` | Marker prospectiv pending atomic numai la crearea cererii; replay-ul/cererile istorice nu fabrică marker sau backfill |
| `src/app/api/admin/assessment-qualification/route.ts`, `src/components/AdminAssessmentQualification.tsx`, `AdminAssessments.tsx` | Citire/verificare nominală cu drept operations, motiv, revizii și audit atomic; panou crem și raport separat pe cohorta completă Europe/Bucharest. Conversia pe cereri eligibile rămâne explicit indisponibilă |
| `src/lib/incidentSlaSchema.ts`, `incidentSla.ts`, `src/lib/db.ts` | Schema leaf aditivă pentru alerte/confirmări/cursor; verificarea termenelor existente, deduplicare, scanare în loturi și audit atomic. Fără praguri comerciale noi |
| `src/app/api/cron/incident-sla/route.ts` | Worker implicit dezactivat; cere flag explicit și CRON_SECRET existent valid. Nu demonstrează activarea unui scheduler pe infrastructură |
| `src/app/api/admin/incident-alerts/route.ts`, `src/components/AdminIncidentTriage.tsx` | Inbox crem și preluare nominală cu revalidare, roluri și conflict de versiune. Confirmarea urmăririi nu soluționează dosarul sau plata; fără transporturi externe |
| `src/lib/pro/portfolioReport.ts`, `reportPeriod.ts`, `src/lib/pro/core.ts` | Agregări Pro pe toate datele autorizate înaintea paginării; cohorte explicite, perioade București/DST și costuri/date necunoscute. Calendar comun pentru registru și CSV; marja internă Pro rămâne necunoscută |
| `src/app/api/pro/[...path]/route.ts`, `src/lib/pro/internalAccess.ts`, `src/components/pro/PortfolioDashboard.tsx`, `Workspace.tsx` | GET dashboard autorizat pe organizație/proprietate și scope financiar separat, filtre și paginare în tema existentă. Viewer și Operator intern fără costuri implicite; fără adrese/coduri/media/checklisturi în raport |
| `src/lib/publicSeo.ts`, `siteIndexing.ts`, `src/app/robots.ts`, `sitemap.ts`, paginile publice `nitido-pro` | Canonicaluri/sitemap Pro public condiționate de flaguri; indexare explicită numai pe domeniul LIVE, separare privat/public și sandbox neindexabil implicit |
| `src/app/opengraph-image.tsx` | Imagine Open Graph crem cu identitatea curentă; fără reintroducerea unei promisiuni Express universale |
| `scripts/recovery.mjs`, `recovery.test.mjs` | Manifest v2 SQLite + public/uploads, data/uploads și data/pro-uploads, hashuri/integritate/FK, restaurare exclusiv în director nou; păstrează compatibilitatea arhivelor v1. Corecția WAL staging este inclusă în regresia Node finală |
| `scripts/release-preparation.mjs`, `release-preparation.test.mjs`, `Dockerfile` | Planuri offline sandbox/producție și simulator cu migrare Pro 12 → 13/14 idempotentă pe copie, verificarea snapshoturilor și păstrarea datelor noi; zero apeluri remote. Instrumente incluse în imagine, construcția imaginii este probă separată |
| `src/lib/db.ts` și regresiile de inițializare | Seed estimator serializat în tranzacție immediate pentru startup concurent pe bază nouă; corecție identificată în proba Docker, cu două teste noi trecute |
| `assessmentQualification.test.ts` și ruta sa `.test.ts`; `incidentSla.test.ts` și testele celor două rute | SQLite real, atomicitate/audit/replay, revizii, permisiuni, date necunoscute, staleness, concurență și absența mutațiilor de ofertare/alocare/plată |
| `src/lib/pro/portfolioReport.test.ts`, `src/app/api/pro/portfolioDashboard.test.ts`, `siteIndexing.test.ts`, `src/app/opengraphImage.test.ts` | Scope/RBAC/revocare, cohorte și volume fără trunchiere, DST și CSV, date financiare necunoscute, indexare condiționată și imagine OG |
| Ghidurile `ASSESSMENT-OPERATIONAL-QUALIFICATION.md`, `INCIDENT-SLA-INTERNAL-ALERTS.md`, `PRO-PORTFOLIO-DASHBOARD.md`, `RELEASE-PREPARATION.md` | Contracte, operare, rollback și criterii de acceptanță; nu înlocuiesc verificarea mediilor instalate |

Regresia completă după fixul seedului: **1.743/1.743 teste Vitest trecute în UTC și Europe/Bucharest**, confirmate prin rapoartele JSON. 44/44 teste Node după corecția recovery WAL staging, 122 teste mobile și typecheck mobile au trecut. Buildul de producție webpack a încheiat cu exit 0, 148 de pagini, verificarea TypeScript și fonturi incluse; ESLint pe 38 de fișiere are zero avertismente. Buildul Docker pe bază nouă cu Turbopack a trecut; proba runtime Docker este încă pending, browserul actual este în curs. Opt teste recovery/release și simulatorul local au trecut pe date sintetice. Cele 1.661 teste în ambele fusuri și verificările browser ale PR #86 sunt dovezi istorice pentru pachetul anterior, nu acceptanță implicită a suprafețelor noi. Dispozitivele și infrastructura se consemnează separat după execuție.

Rămân distincte: configurările comerciale/fiscale, politica de credit/penalizări, scorul/distribuția Express activă și pilotul, modelul/pilotul Pro, conversia exactă pe cereri eligibile, raportarea comună Marketplace/Pro, activarea și verificarea SLA pe mediu, compatibilitatea/distribuția mobile și release-ul cu backup/restaurare/migrări pe infrastructura reală. Instrumentarea prospectivă nu închide aceste lacune și nu reconstituie istoricul comercial. Schema legacy Pro de pe host trebuie inventariată; dacă există, migrarea fără pierderi se tratează separat, fără DROP sau forțarea versiunii.
