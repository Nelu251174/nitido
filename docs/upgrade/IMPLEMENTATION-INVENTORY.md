# Inventar de implementare

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
