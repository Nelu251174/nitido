# Registrul invitațiilor și KPI v1.1

Registrul extinde fan-out-ul existent Standard/Express, fără modificarea alocării, eligibilității sau fluxurilor Stripe. Nu există backfill care să transforme vizualizarea unei oportunități sau un outbox istoric într-o invitație trimisă.

## Date și audit

`provider_invitation_campaigns` identifică fan-out-ul observat. `provider_invitations` deduplică prestatorul pe lucrare; `provider_invitation_deliveries` leagă dispozitivele și canalele existente, iar `provider_invitation_events` reține dovezile nemodificabile. Toate aceste registre au protecție împotriva actualizării și ștergerii.

- `sent`: numai confirmare pozitivă a furnizorului push/SMS. Înregistrarea outbox `sent` și dovada sunt în aceeași tranzacție.
- `offered`, `withdrawn`: candidatura și retragerea explicită Standard; nu reprezintă automat alocare acceptată.
- `accepted`: alocare finalizată în mecanismul existent; confirmarea locală și evenimentele se salvează atomic, inclusiv recuperarea Standard.
- `lost`: alt prestator a câștigat. Nu este refuz și nu schimbă niciun scor sau criteriu de alocare.

În cazul unei confirmări externe urmate de eșecul auditului local, tranzacția locală revine; livrarea incertă necesită reconciliere. Același răspuns și token de confirmare pot fi persistate idempotent, fără trimiterea unui mesaj nou. Reîncercările și identitatea tokenului rămân cele din infrastructura existentă de notificări.

Nu se inventează un termen de invitație din fereastra Express60: aceasta este garanția suplimentului de preț, nu expirarea invitației. Distribuția graduală și termenele ei rămân etapa A5, cu reguli aprobate.

## Raport

Acceptarea arată alocări confirmate / invitații trimise, deduplicate pe lucrare și prestator. Intră numai campaniile înregistrate pentru care toate livrările cunoscute au rezultat soluționat. `pending`, `sending`, `DELIVERY_UNKNOWN` și erorile reîncercabile exclud întreaga campanie. O alocare finalizată fără dovada locală accepted/lost exclude de asemenea campania până la reconcilierea auditului. Datele istorice fără campanie rămân necunoscute. Absența eșantionului produce procent `null`, nu zero.

Raportul prezintă separat campaniile complete, incomplete și fără registru, precum și invitațiile pierdute și candidaturile retrase. Starea răspunsurilor este cea curentă la citirea raportului. Completitudinea campaniei descrie evidența dispatch-ului; nu presupune că un prestator a refuzat dacă nu a răspuns.

Filtrul prestatorului folosește invitațiile primite, inclusiv lucrările câștigate de alt prestator. Se includ lucrările istorice asociate prestatorului pentru a afișa lipsa registrului. Filtrarea exclusiv pe câștigători ar produce artificial acceptare 100%.

## Definiții KPI

Metricile descriptive anterioare rămân distincte. `kpis.brief` adaugă:

- Anulări/no-show: evenimente ale comenzilor confirmate / comenzi cu dovada confirmării prin registrul plăților existent. `accepted_at` singur poate fi rezervare provizorie înaintea autorizării.
- Reclamații: lucrări finalizate cu cel puțin un dosar / finalizate; reclamațiile confirmate sunt un indicator separat de calitate.
- Remediere: dosare cu rezoluție de remediere finalizată, legată de o vizită de garanție finalizată / dosare de reclamație. Se deduplică dosarul, nu lucrările de garanție.
- Recurență: vizite finalizate legate de `recurring_occurrences` / finalizate. Revenirea aceluiași client este fidelizare separată.
- Valoare medie plătită: sume brute ale plăților capturate sau ulterior rambursate / comenzi plătite distincte. Sumele sunt înainte de rambursări și nu sunt venit contabil NITIDO. Înregistrări multiple de plată pentru aceeași comandă marchează media indisponibilă.
- Timp până la alocare: numai lucrările cu confirmare documentată și ambele momente valide.

Cererile de evaluare au cohortă proprie și conversia descriptivă în rezervări este păstrată. Raportul numără separat cererile cu comandă confirmată prin plată. Rata exactă «comenzi confirmate / cereri eligibile» rămâne indisponibilă: schema istorică nu păstrează decizia de eligibilitate pentru fiecare cerere. Eliminarea cererilor fără comandă din numitor ar produce rezultate înșelătoare.

## Verificare

Testele acoperă deduplicarea între dispozitive și canale, livrare incertă, protecția datelor private, Standard versus alocare, doi concurenți cu un singur câștigător, atomicitatea auditului, reîncercarea aceleiași confirmări externe, istoricul imuabil, filtrarea prestatorilor care au pierdut și definițiile KPI cu lipsă de date explicită.

Migrația este aditivă și inclusă în inițializarea SQLite. Pentru revenire la codul anterior, registrele se păstrează; nu se șterg dovezile. Codul anterior nu depinde de aceste tabele. Testele locale nu înlocuiesc validarea sandbox pe conturi și dispozitive sau confirmarea publicării LIVE.
