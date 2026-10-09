# NITIDO_EXISTING_SYSTEM_AUDIT

Data: 24.09.2026. Referință: commit 8a776e23e865fb4cba2725270e12449fd7c45605, ramura feat/nitido-pro-production-v11.

## Domeniu și limite

Audit static orientat pe mecanicile brief-ului + selecție de teste unitare/de integrare pe copie git izolată. Nu este audit complet de securitate, fiscal sau de producție. Nu am interogat baza live, Stripe, configurarea secretelor, cronurile sau starea magazinelor în această etapă. Nu am făcut modificări de aplicație/deploy. Rezultatele dintr-o primă rulare în workspace-ul vechi au fost excluse din evidența finală; cifrele de mai jos sunt de pe copia izolată a commitului.

## Matrice funcțională

| Funcție | Stare | Locație tehnică | Comportament actual | Risc și decizie |
|---|---|---|---|---|
| Standard | Există în cod; validare parțială | src/lib/offers.ts; src/lib/acceptJob.ts; api/jobs/[id]/offers | Candidatură la preț fix, clientul selectează; nu licitație. Quality Index sortează ofertele. | 5/8 teste offers eșuează; păstrăm semantica și investigăm baza de test. |
| Express atomic | Există; verificare automată blocată | src/lib/acceptJob.ts; src/lib/firmAvailability.ts | Tranzacție imediată, rezervare condiționată, token de revendicare; apel plată după rezervare. | 3/5 acceptJob și 13/13 recovery eșuează; nu modificăm autorizarea Stripe fără diagnostic. |
| Adrese/private | Există parțial verificat | src/lib/authorization.ts; src/app/api/proofSecurity.test.ts; src/lib/pro/core.ts | Proprietar și firmă atribuită; Pro limitează fereastra accesului și auditează credential.view. | 5 teste authorization și 5 proofSecurity trec; este necesară verificarea tuturor endpointurilor și stocării live. |
| Statusuri | Există; extindere necesară | src/lib/db.ts; src/lib/pro/schema.ts; src/lib/pro/core.ts | Marketplace și Pro au stări separate; Pro are financial_status distinct. | Nu înlocuim cu un enum unic din brief. Mapare explicită înaintea migrației. |
| Fotografii/dovezi | Există în cod, teste selectate trec | src/lib/proofOfWork.ts; src/lib/pro/core.ts | Sosirea/finalizarea cer dovezi; captura cere dovadă de finalizare validă. | 11 teste proofOfWork trec; nu relaxăm capturarea în noul checklist. |
| Eligibilitate firme | Parțial față de brief | src/lib/acceptJob.ts; src/lib/offers.ts; src/lib/firmAvailability.ts | Verificare, suspendare, acoperire și conflict de calendar. Capacitate conservatoare la nivel firmă. | Reguli pe documente expirate/scor/serviciu trebuie inventariate înainte de extindere. |
| Evaluări | Există; live neconfirmat | src/lib/authorization.ts; src/lib/qualityIndex.ts; src/app/api/jobs/[id]/rating/route.ts | Evaluare pentru lucrare finalizată; rating și strikes intră în Quality Index. | Nu declarăm Provider Score complet. Verificare separată a moderării și agregatelor. |
| Recurență | Există; teste blocate parțial | src/lib/recurring.ts; src/lib/pro/core.ts; src/lib/db.ts | weekly/biweekly/monthly, identitate occurrence, pauze; Pro are motor separat. | 24/44 teste Marketplace eșuează; Pro core 15/15 trec; zilnic nu este în schema Pro verificată. |
| Mesagerie contextuală | Există în cod | src/lib/workspace.ts; src/app/api/workspace/messages/route.ts | Mesaje asociate lucrării și cererilor cu cheie de reîncercare. | Nu construim chat nou; suita workspace este doar parțial verde. |
| Stripe | Există în cod; configurare live neconfirmată în audit | src/lib/payments.ts; src/lib/authorizationAttempts.ts; src/lib/paymentCancellation.ts | Autorizare, captură și referințe existente; transferuri controlate de flag. | Nicio cheie citită, nicio plată inițiată; suita Stripe nu a fost rulată aici. |
| No-show/remedieri | Există parțial față de brief | src/lib/noShow.ts; src/lib/visitCare.ts | No-show, dosare cu evenimente, propunere/acceptare remediere în condițiile existente. | 4/5 noShow eșuează. SLA, severitate și proprietar intern necesită analiză/extindere. |
| Catalog/pricing | Parțial | src/lib/serviceCatalog.ts; src/lib/pricing.ts; src/lib/pricingSnapshot.ts | Catalog draft+istoric; tarife încă în cod; snapshot publicat protejat. | 22 pricing, 5 snapshot, 4 catalog, 6 capacity și 2 route catalog trec. Publicarea tarifelor nu există în modulul draft. |
| CRM/marjă | Neconfirmat ca modul complet | src/lib/payments.ts; src/lib/pro/schema.ts | Există componente de sumă și costuri Pro; nu echivalează cu marjă consolidată/CRM din brief. | Definiții, surse cost și drepturi necesare; nu prezentăm lipsa unei căutări ca dovadă de absență totală. |
| Admin/roluri | Parțial | src/lib/adminAuth.ts; src/lib/pro/schema.ts; src/lib/pro/core.ts | Admin cu MFA; Pro membership și scope pe proprietăți, protecție autoaprobare. | Nu presupunem roluri distincte Operator/Manager/Financiar global; accesul financiar se auditează separat. |
| Pro | Există fundație implementată | src/lib/pro/schema.ts; src/lib/pro/core.ts; src/app/api/pro/[...path]/route.ts | Organizații, proprietăți, oferte, aprobări versionate, costuri, media, invitații, notificări și audit append-only. | 15 core +11 API trec. Nu se declară E2E complet sau disponibilitate în producție din aceste teste. |
| Mobil | Există | capacitor.config.ts; ios/; android/ | Shell Capacitor cu origine aprobată nitido.ro/sandbox. | Fără build iOS/Android sau verificare device în acest audit; compatibilitate obligatorie la lansare. |

## Rezultate reproductibile

186 teste: **119 trec, 67 eșuează**, în 16 fișiere: 10 trec integral, 6 au eșecuri. Nu sunt 67 defecte de produs distincte. Multe eșecuri au aceeași cauză de fixture/schema.

| Fișier | Trec | Eșuează |
|---|---:|---:|
| src/lib/acceptJob.test.ts | 2 | 3 |
| src/lib/acceptJobRecovery.test.ts | 0 | 13 |
| src/lib/authorization.test.ts | 5 | 0 |
| src/lib/catalogCapacity.test.ts | 6 | 0 |
| src/lib/noShow.test.ts | 1 | 4 |
| src/lib/offers.test.ts | 3 | 5 |
| src/lib/pricing.test.ts | 22 | 0 |
| src/lib/pricingSnapshot.test.ts | 5 | 0 |
| src/lib/proofOfWork.test.ts | 11 | 0 |
| src/lib/recurring.test.ts | 20 | 24 |
| src/lib/serviceCatalog.test.ts | 4 | 0 |
| src/lib/workspace.test.ts | 7 | 18 |
| src/app/api/proofSecurity.test.ts | 5 | 0 |
| src/lib/pro/core.test.ts | 15 | 0 |
| src/app/api/pro/route.test.ts | 11 | 0 |
| src/app/api/admin/catalog/route.test.ts | 2 | 0 |

## Blocaje și diagnostic inițial

B1 — SCHEMA_SQL/WORKSPACE_SCHEMA din fixture nu reproduc toate migrările executate separat în db.ts. Dovezi: erori schedule_generation, rooms, t.minimum_duration_minutes, visit_cases; coloanele sunt adăugate în inițializarea completă. Acest fapt explică o parte din teste, nu dovedește schema live incompletă.

B2 — acceptJob/recuperare: returnări 503 și callback-uri de mock neinițializate. Ipoteză de verificat: rezervarea eșuează înainte de apelul mock de plată din cauza schemei incomplet inițializate. Nu este confirmat pentru fiecare test.

B3 — recurență: un test așteaptă 2026-01-08 și primește 2026-01-07. Testul construiește o dată fără fus, iar funcția folosește componente UTC. Se cere verificare în UTC și Europe/Bucharest, fără a schimba arbitrar așteptarea. Unele scenarii folosesc date fixe din trecut și presupun vechiul comportament de atribuire; se verifică politica actuală și se folosește ceas controlat.

B4 — catalogul disponibil salvează schițe cu versiune; categoriile sunt definite în cod. Nu există în acest modul dovada ciclului publicabil din noul brief.

B5 — Quality Index curent folosește rating/experiență/strikes cu ponderi în cod. Nu este echivalent cu Provider Score configurabil și nu rezolvă singur eligibilitatea firmelor noi.

B6 — Pro core are protecții existente importante: separarea aprobatorului, versiuni de ofertă, audit nemodificabil și acces criptat limitat temporal. Trebuie reutilizate, nu slăbite pentru rolurile noi.

## Comandă de reproducere

În copie izolată a commitului, cu dependențele proiectului disponibile:

```bash
npx vitest run src/lib/acceptJob.test.ts src/lib/acceptJobRecovery.test.ts src/lib/offers.test.ts src/lib/pricing.test.ts src/lib/pricingSnapshot.test.ts src/lib/authorization.test.ts src/lib/proofOfWork.test.ts src/lib/recurring.test.ts src/lib/noShow.test.ts src/lib/workspace.test.ts src/lib/pro/core.test.ts src/app/api/pro/route.test.ts src/app/api/proofSecurity.test.ts src/app/api/admin/catalog/route.test.ts src/lib/serviceCatalog.test.ts src/lib/catalogCapacity.test.ts --reporter=json --outputFile=upgrade-tests.json
```

## Verdict și prima intervenție

**Auditul documentar și rularea selectată sunt încheiate. Poarta QA pentru implementare/lansare nu este trecută.** Prima intervenție recomandată este A0, conform anexei brief-ului 1.1: inițializare coerentă a bazelor de test, diagnostic calendar și contracte, revalidare invariants. Nu se rescrie logica financiară și nu se elimină teste pentru a obține verde.

Necesar ulterior pentru verificarea operațională: configurații non-secrete relevante, starea migrărilor sandbox, date test separate, acces pe roluri și verificare pe dispozitive. Acestea sunt neconfirmate, nu considerate defecte. Nu este necesară divulgarea cheilor în document.

Raport de etapă: cod citit și 186 teste executate; numai documentele au fost redactate; niciun tarif, cont, rol, date live, secret sau deployment nu a fost schimbat. Nu există nou SHA de aplicație livrat prin acest audit.
