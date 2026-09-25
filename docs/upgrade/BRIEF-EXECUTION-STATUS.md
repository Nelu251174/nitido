# NITIDO Upgrade v1.1 — situație consolidată

Data: 25.09.2026. Candidat: ramura `feat/nitido-crm-checklist-controls`.
Referință normativă: MASTER BRIEF v1.1, amendamentele A–H din 24.09.2026. Documentele A0–A4 descriu probele la momentul fiecărui pachet; acest inventar le reunește și explică limitele actuale. Un PR, o schemă sau un test unitar nu constituie acceptanță live.

## Ce include această livrare

Ramura continuă `feat/nitido-upgrade-consolidation` (PR #82, `6cdf3cd264649dc98910503f2a30614be7c564a6`) și conține istoricul pachetelor anterioare. Nu este nevoie să se copieze manual fișierele din fiecare PR pentru a evalua candidatul. Nu s-a făcut merge în ramura de producție.

1. Raport administrativ Marketplace cu selecție coerentă, costuri confirmate separate de cele necunoscute și indicatori ai prestatorilor în observare.
2. Fișă client cu căutare, clasificări, note, restricții explicite versionate, istorice paginate și valoare/marjă cumulate.
3. Severitate, responsabil intern, versiuni SLA și termene urmărite în dosarul de incident, fără valori activate implicit.
4. Instrument SQLite read-only pentru backup și restaurare izolată, inclus în Docker; verifică integritatea, relațiile, schema, numerele de rânduri și hashurile.
5. Editor administrativ de checklisturi Marketplace cu liste înghețate pe lucrare și păstrarea regulilor istorice; `CRM-AND-EXECUTION-CONTROLS.md`.
6. O singură comandă de regresie și un workflow CI care include etapele precedente și modulele noi; documentație consolidată de operare și lansare.

Suprafețele noi folosesc crem, iar acțiunile păstrează verdele. Nu s-a modificat arhitectura Stripe, nu s-au activat ponderi de scor, tarife comerciale Pro sau praguri financiare presupuse.

## Acoperirea cerințelor

| Domeniu din brief | Cod și dovezi existente | Ce rămâne deschis |
|---|---|---|
| A0 — baza de verificare | Inițializare comună, fixture migrate, recuperare acceptare/plată, calendar în UTC/România; `A0-validation.md` | Standard/Express/Pro pe roluri în sandbox și proba de infrastructură |
| A1 — pricing configurabil | `managedPricing*`, `bookingQuotes`, Admin Pricing; paritate, simulator, conflict de publicare, audit atomic, expirare, snapshot; `A1-pricing.md`, `A1-booking-quotes.md` | Configurarea și parcurgerea checkout-ului real în sandbox; activarea producției nu este făcută |
| A2 — ofertare, marjă și excepții | Evaluare → dovezi → estimare → ofertă → programare → rezervare; marjă estimată/efectivă și policy/excepții auditate | Valori comerciale/fiscale aprobate și testare operațională; costurile necunoscute rămân necunoscute |
| Capacitate și alocare | `assessmentPlan`, `assistedOperations`, verificare/rezervare atomică; `A2-atomic-team-allocation.md` | Configurarea echipelor și capacității reale; proba concurentă pe mediul țintă |
| Express și oportunități | Eligibilitate la citire și mutație, minimizare înainte de alocare, izolare ofertă asistată, un câștigător; documentele A3 de eligibilitate | Validare pe configurația reală de documente/zone/servicii; distribuția după un scor nou nu este activată |
| Provider Score | Raportul nou arată indicatorii în observare; Quality Index existent este păstrat | Ponderi, perioadă, volum minim, reguli firme noi și date lipsă; validare pe pilot înainte de impact automat |
| Incidente/remedieri | `visitCare`, verificări versionate, revizii concurente, severitate, responsabil, notă internă și termene; `CONSOLIDATED-OPERATIONS.md` | Escaladări/notificări SLA automate; maparea tuturor rezoluțiilor comerciale; nu se generează automat rambursări sau penalizări |
| Dovezi/checklist | Editor Marketplace pe Standard/Express și categorii de evaluare, revizii auditate, copii imuabile pe lucrare, sarcini nerealizabile, raport/finalizare coerente | Editor Pro pe proprietate și reguli foto diferențiate pe serviciu din §11; validarea vizuală pe dispozitive |
| CRM operațional | Fișă internă, etichete, note, restricții tranzacționale la rezervări/evaluări/recurențe, valoare și marjă pe întregul istoric, costuri lipsă explicite | Segmentare avansată; controale organizaționale Pro distincte; validare reală a restricțiilor și totalurilor |
| Organizații/proprietăți Pro | Scope pe organizație/proprietate, roluri Pro, acces sensibil în fereastra lucrării; `NITIDO-PRO-V11-IMPLEMENTATION.md` | Pilot real cu portofolii, echipe și acces verificat; model comercial încă neactivat |
| Recurență/aprobări/rapoarte Pro | Weekly/biweekly/monthly, retry fără duplicate, limite calendar, rework și închidere corecte, CSV autorizat, notificări după scope | Extensia daily nu există în schema curentă. Validare fizică notificări și pilot; nu se pierde exportul CSV existent |
| Roluri interne NITIDO | Sesiunea Admin existentă cu MFA și actor verificat; rolurile Pro au propriile reguli | Separarea nominală Operator NITIDO / Manager / Financiar / Super Admin din §21 nu este complet implementată. Responsabilul textual al incidentului nu închide această cerință |
| KPI și A5 | Stări Marketplace, reclamații distincte, marjă documentată, indicatori prestator, rapoarte Pro | KPI-urile complete din §4, filtre serviciu/zonă și automatizări validate după pilot; raportul actual nu este prezentat ca întreg dashboardul comercial |
| Mobil | Cod Capacitor existent și corecțiile de aspect anterioare sunt păstrate; suprafețe crem | Parcurgere reală iOS/Android; build încărcat, procesat și distribuit separat în TestFlight/Google Play. Un deploy web nu dovedește un update în magazin |
| Backup/deploy | Instrument executabil, probe sintetice, documentația de mai jos; schema nouă este aditivă | Restaurarea SQLite + fișiere pe infrastructura țintă și verificarea rollback-ului pe datele reale |

**Brief-ul nu este închis integral.** Tabelul separă explicit lipsurile de cod de probele operaționale și de deciziile comerciale. Nu există o bază verificată pentru un procent de finalizare sau pentru afirmația „tot P0 este gata”. Lipsurile de cod de mai sus nu trebuie reclasificate drept simple aprobări lipsă.

## Livrabile obligatorii §30

| Nr. | Livrabil și locație | Stare |
|---|---|---|
| 1 | `NITIDO_EXISTING_SYSTEM_AUDIT.md` în acest director | Audit inițial păstrat, cu referința și limitele lui; rezultatele vechi nu sunt starea de azi |
| 2 | Acest inventar + documentele A0–A4 | Plan corelat cu module și lacune explicite |
| 3 | `IMPLEMENTATION-INVENTORY.md` + diff-ul PR-ului | Fișierele noului pachet și modulele etapelor precedente |
| 4 | `BACKUP-RESTORE.md`, documentele A1/A2/A3, `NITIDO-PRO-V11-IMPLEMENTATION.md` | Migrații în cod; rollback pe infrastructură neexecutat |
| 5 | Codul din ramura consolidată | P0 parțial; vezi matricea, nu etichetă de finalizare |
| 6 | `A1-pricing.md`, `A1-booking-quotes.md` | Ghid registru/simulator și rezervare cu ofertă versionată |
| 7 | `CONSOLIDATED-OPERATIONS.md`, `A3-opportunity-eligibility.md`, `A3-assisted-offer-eligibility.md` | Observare și eligibilitate; ponderi neactivate |
| 8 | `A3-incident-review.md`, `CONSOLIDATED-OPERATIONS.md` | Verificări, separare note interne, responsabilitate și termene |
| 9 | `NITIDO-PRO-V11-IMPLEMENTATION.md`, documentele A4 | Ghiduri existente + integritatea operațiilor; pilot deschis |
| 10 | `CONSOLIDATED-QA.md` | Teste și limite verificabile, fără PASS fictiv pentru browser/dispozitive |
| 11 | `INTEGRATION-AND-RELEASE.md`, `NITIDO-RELEASE-GATE.md` | Integrarea Stripe existentă păstrată; configurarea reală nu a fost schimbată |
| 12 | Backlogul de mai jos | P1/P2 și motive distincte de lacunele P0 |
| 13 | `INTEGRATION-AND-RELEASE.md` | Candidat → sandbox → dovezi → producție; nicio publicare implicită |
| 14 | `BACKUP-RESTORE.md` + script/teste | Probă sintetică făcută; restaurarea completă a infrastructurii rămâne deschisă |
| 15 | Secțiunea de acces din `INTEGRATION-AND-RELEASE.md` | Cod transmis în repository; accesul la servicii nu poate fi declarat predat/verificat în lipsa sesiunilor corespunzătoare |

## Backlog P1/P2

- Promoții și segmentare avansată: după stabilizarea clasificărilor și regulilor de preț; nu se activează discounturi fără politică.
- SLA cu escaladări automate: după verificarea termenelor interne și a destinatarilor; nu se trimite SMS/WhatsApp fără infrastructură și consimțământ aplicabile.
- Facturare/documente B2B: după model contractual și fiscal aprobat; marja operațională nu este profit contabil.
- Rapoarte și exporturi avansate: după definiții de KPI și date de pilot; exportul Pro existent rămâne disponibil conform permisiunilor.
- Matching/recomandări/scor activ: după observație și validare; ofertele pierdute nu devin refuzuri.
- Integrare contabilă, API extern, automatizări B2B: necesită contracte și fluxuri validate. Nu se construiesc pe presupuneri.
- Aplicație nativă nouă: exclusă de amendamente. Compatibilitatea și distribuția actualei aplicații Capacitor rămân de verificat și nu sunt amânate fictiv la P2.
