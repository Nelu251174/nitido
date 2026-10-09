# Pro — recurență zilnică și migrarea 14

## Comportament operațional

Calendarul Pro adaugă frecvența **Zilnic**, păstrând Săptămânal, La două săptămâni și Lunar. Formularul păstrează tema crem și oferă prima zi, ora locală din România, durata, costul estimat și **Ultima zi (opțional)**.

`end_date` este o dată civilă `YYYY-MM-DD`, inclusivă. Poate coincide cu prima zi; nu poate preceda prima zi sau reprezenta o dată imposibilă. Un câmp gol înseamnă fără dată finală. Prima apariție trebuie să fie în viitor. Pentru ora lipsă de primăvară, o regulă nouă nu poate începe la un moment inexistent.

Generatorul folosește fereastra existentă de 14 zile și creează câte o apariție pe zi locală pentru regulile zilnice active. Organizația și proprietatea trebuie să fie active. Tabelul `pro_occurrences`, cu cheia `(rule_id, day)`, păstrează identitatea fiecărei apariții; reluarea generatorului nu dublează lucrările sau notificările. Omiterea unei apariții viitoare folosește mecanismul existent `skipped`. O apariție deja generată se anulează sau se reprogramează prin lucrarea asociată.

**Pauză** oprește generarea viitoare; lucrările deja generate rămân neschimbate. **Reia** continuă regula de la cursorul ei existent. Zilele trecute care nu mai pot fi executate sunt marcate pentru verificare, fără rezervări retroactive. Dezactivarea proprietății pune în pauză și regulile zilnice. Depășirea ultimei zile oprește generarea; regula nu produce lucrări după acea dată.

Fiecare lucrare nouă primește snapshotul checklistului și al regulilor foto valabile la generare. Publicarea unei revizii noi nu modifică lucrările deja generate. Aprobările clientului și pragurile existente se aplică în continuare fiecărei lucrări; această extensie nu modifică Stripe sau regulile comerciale.

## Migrare și compatibilitate

Migrarea 13 a regulilor foto este păstrată. Migrarea **14** adaugă numai:

- `pro_recurring_cadences(rule_id, frequency, active)`, referință către regula existentă, cu frecvența `daily`;
- triggerul `pro_daily_legacy_inactive` pentru protejarea schedulerelor anterioare;
- markerul 14 în `pro_schema_migrations`.

Nu se reconstruiesc tabele, nu se rescriu regulile existente și nu se modifică istoricul. Constrângerea veche de frecvență din `pro_recurring_rules` rămâne intactă. Pentru o regulă zilnică nouă, rândul din acest tabel are valoarea compatibilă `weekly` și `active=0`; frecvența și activarea efective sunt în tabelul nou. API-ul și schedulerul actual compun aceste valori și afișează corect `daily`.

Codul anterior selectează doar reguli cu `pro_recurring_rules.active=1`, deci **ignoră regulile zilnice**. Dacă API-ul anterior încearcă să le reia printr-un UPDATE direct la `active=1`, triggerul respinge acțiunea. Această protecție evită generarea accidentală cu frecvență săptămânală în timpul revenirii la codul anterior.

La rollback de cod se păstrează baza de date migrată, tabelul nou, markerul 14 și triggerul. Regulile săptămânale/lunare existente continuă normal, iar regulile zilnice nu generează apariții sub codul vechi. Lucrările generate anterior rămân în sistem. După revenirea la codul cu suport zilnic, activarea din tabelul nou este reutilizată. Revenirea la un backup anterior necesită planul de backup/restaurare și reconcilierea eventualelor operațiuni efectuate între timp; nu se șterg manual tabele sau markeri pentru rollback.

Migrarea se execută explicit, pe baza de date identificată și cu backup verificat, folosind pachetul corespunzător codului:

```bash
node scripts/pro-build-migration.mjs
NITIDO_PRO_DB_PATH=/cale/catre/baza-verificata.sqlite node scripts/pro-migrate.mjs
```

Primul script generează `src/lib/pro/schema.mjs` din sursa curentă. Runnerul preferă acest fișier când există. Se regenerează înaintea folosirii pachetului nou pentru a evita o migrare compilată din altă versiune. Reexecutarea migrării este idempotentă. DDL-ul și markerul sunt în aceeași tranzacție; o eroare la salvarea markerului anulează extensia.

Guard-ul pentru o schemă Pro veche folosește prefixul literal `GLOB 'pro_*'`. Tabelele Marketplace `provider_invitations` și `provider_score_policies` nu sunt confundate cu tabelele Pro; o schemă reală `pro_*` fără marker rămâne refuzată, fără ștergere de date.

## Validare reproductibilă

Pe 9 octombrie 2026, cele patru fișiere de mai jos au trecut cu **99 de teste** în fiecare fus orar, inclusiv **21 de scenarii noi** pentru zilnic și migrare:

```bash
TZ=UTC npx vitest run src/lib/pro/dailyRecurring.test.ts src/lib/pro/core.test.ts src/lib/pro/propertyChecklists.test.ts src/app/api/pro/route.test.ts
TZ=Europe/Bucharest npx vitest run src/lib/pro/dailyRecurring.test.ts src/lib/pro/core.test.ts src/lib/pro/propertyChecklists.test.ts src/app/api/pro/route.test.ts
```

Scenariile noi verifică:

- migrare fresh și 13→14, cu reguli, lucrări, fotografii și audit păstrate; repetarea migrării și rollback la eroarea markerului;
- creare idempotentă, generare fără duplicate, pauză/reluare, omitere și ultima zi inclusivă;
- rollback și retry la erori în lucrări, apariții, reguli foto, aprobări și audit;
- menținerea orei locale peste DST: intervale de 23 și 25 de ore între începuturile unor vizite zilnice, fără schimbarea orei în România;
- ora lipsă din 28 martie 2027: apariție `missed` și notificare unică, celelalte zile valide continuând;
- checklist și fotografii istorice neschimbate; reviziile noi se folosesc numai pentru lucrările generate ulterior;
- compatibilitatea codului anterior și protecția împotriva reluării greșite a regulii zilnice.

Scripturile împachetate reale `pro-build-migration.mjs` și `pro-migrate.mjs` au fost copiate și executate separat în `/tmp/nitido-pro-migration-validation`, fără atingerea bazei de date sau a fișierului `schema.mjs` din workspace. Proba SQLite pe disc a confirmat 13→14, păstrarea celor **27 de tabele existente**, a regulii săptămânale și a snapshoturilor istorice; apoi a introdus o regulă zilnică sintetică și a reexecutat runnerul, confirmând păstrarea ei. `foreign_key_check` și `integrity_check` au trecut. Raportul sesiunii este `/tmp/nitido-pro-migration-validation/report.json`.

Workflow-ul `upgrade-consolidated.yml` verifică branch-ul de completare și PR-urile către `main`, în UTC și Europe/Bucharest, cu suita completă Vitest, testele scripturilor, typegen, TypeScript și build Webpack în UTC. Are numai permisiune `contents: read`; nu conține pas de deploy.

## Stare de livrare

Acest document probează implementarea și verificările locale descrise. Integrarea în `main`, migrarea sandbox, verificarea browser pe roluri și dispozitive, publicarea LIVE și distribuția buildurilor mobile se consemnează separat în raportul de etapă. Testele locale și migrarea pe date sintetice nu declară închiderea pilotului sau lansarea în producție.
