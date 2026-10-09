# Provider Score — observare configurabilă

Continuare din PR #85. Referințe normative: amendamentul E și A5 din [brieful v1.1](MASTER-BRIEF-v1.1.md). Quality Index existent și distribuția Standard/Express rămân active în forma lor existentă.

## Configurare și utilizare

Managerul sau Super Admin încarcă „Provider Score — observare” din dashboardul administrativ. Financiar are numai citire; Operator nu primește raportul. Configurarea cere perioada de 1–365 zile calendaristice în Europe/Bucharest, minimum lucrări finalizate, minimum măsurători pentru fiecare componentă folosită și ponderi explicite însumând 100%. Nu există o configurație comercială implicită. O pondere zero exclude componenta. Motivul schimbării este obligatoriu; revizia și autorul nominal sunt salvate atomic cu auditul. Un conflict cere reîncărcare. Istoricul politicilor nu poate fi modificat sau șters.

Componentele sunt ratingul publicat și verificat, punctualitatea, fiabilitatea alocărilor documentate, lipsa reclamațiilor confirmate și conformitatea dovezilor foto. Foto verifică minimele înghețate pe lucrare, firma alocată și validarea efectivă; pentru lucrările istorice fără snapshot se păstrează minima existentă 1/1. Numărul fotografiilor nu certifică singur calitatea serviciului. O reclamație încă neverificată lasă componenta nemăsurabilă; nu produce penalizare implicită. Ratingurile se raportează la lucrările finalizate din cohortă; o invitație pierdută nu devine refuz sau incident.

Raportul folosește aceeași perioadă pentru toți prestatorii: zilele calendaristice până în ziua curentă inclusiv. Ziua curentă și stările curente sunt în evoluție; rezultatele nu reprezintă un scor istoric înghețat. Cohorta se bazează pe data creării lucrărilor. Pentru o firmă nouă sau o componentă ponderată cu date insuficiente, scorul este `null`, cu motive explicite. Ponderile nu se redistribuie tacit. Marja comercială nu intră în formulă.

## Integrare și limite

Module: `providerScoreShared.ts`, `providerScoreSchema.ts`, `providerScore.ts`, `providerScoreReport.ts`, API `/api/admin/provider-score`, `AdminProviderScore.tsx`. Schema este aditivă și nu face backfill de scoruri. Răspunsurile sunt private/no-store. Configurația de scor și auditul folosesc aceeași tranzacție.

În acest candidat nu există prag de excludere ori suspendare și nici activare automată a Provider Score. Pilotul, ponderile operaționale și impactul în distribuție necesită politica validată prevăzută de amendamentul E. Scorul de observare nu activează Connect, costuri Pro, TVA, notificări sau plăți.

Validare: teste de politică explicită, date lipsă, minimum de volum, tranzacție/audit/revizii imuabile, reclamații și ratinguri cu baze SQLite reale, dovezi foto și granițele DST București; teste API pentru sesiune, rol, origine, corp invalid și audit atomic. Acceptanța operațională pe mediul țintă rămâne distinctă de aceste verificări locale.
