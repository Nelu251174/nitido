# Delegare CRM și operațiuni Pro — completare v1.1

Referință: MASTER BRIEF v1.1, amendamentele B/E/F/G și §21; continuare din PR #85 / `4c8315148504bc2edd98a5d9b155763db987b339`. Acest document descrie codul candidat, nu un merge sau un deploy.

## CRM Marketplace

| Rol intern | Citire | Mutații |
|---|---|---|
| Operator NITIDO | Contact, proprietăți workspace, stări, cereri, sesizări, evaluări și note. Fără credit, sume ale lucrărilor, totaluri financiare, marjă sau referințe Stripe | Note și clasificări cu autor nominal |
| Manager operațional | Istorii operaționale, valoare servicii și marjă documentată; fără sold credit și referințe Stripe | Note, clasificări și restricții explicite versionate |
| Financiar | Istorii, sold credit, plăți și referințe Stripe, valoare și marjă | Citire; nu schimbă note, clasificări sau restricții |
| Super Admin | Toate câmpurile | Toate mutațiile existente |

Filtrarea se face în răspunsul serverului. Istoricul și tabelele nu sunt rescrise. Mutația și auditul rămân atomice; autorul provine din sesiunea verificată, nu din corpul cererii. Panourile folosesc aceleași drepturi și tema crem.

## Administrare globală Pro

Rolurile interne nu devin membri ai organizațiilor Pro. Adaptorul HTTP verifică rolul nominal pentru fiecare operație înainte de execuție și de replay-ul idempotent; contractul și validările modulului Pro existent se păstrează.

- Operator: vizualizare operațională fără sume/praguri, lead-uri și parteneri pentru context; reprogramare, ofertare către partener, solicitare remediere, anulare, tichete și dovezi. Codurile de acces folosesc fereastra lucrării și auditul existent.
- Manager: drepturile Operatorului, configurare proprietăți/checklisturi, devize, creare și închidere lucrări, reguli recurente, parteneri și calificare lead-uri, costuri și export în citire.
- Financiar: vizualizare costuri, aprobări și lucrări fără adresă privată, instrucțiuni, coduri, dovezi sau checklisturi; înregistrare document extern prin fluxul existent. Nu execută mutații operaționale și nu aprobă costuri în numele clientului.
- Super Admin: păstrează administrarea globală existentă, inclusiv activare și atribuirea operatorilor. Invitațiile, setările și aprobările păstrează suplimentar restricțiile Owner/client existente; nu se acordă drepturi noi de reprezentare a clientului.

Orice rută nouă sau neclasificată rămâne interzisă rolurilor delegate. Adresa, dovezile și sumele sunt filtrate inclusiv în colecții și în obiectele imbricate. Auditul Pro primește identificatorul nominal; nu mai grupează toate sesiunile administrative sub autorul generic `admin`. Revocarea sesiunilor/rolurilor folosește mecanismul MFA versionat din PR #85.

Nu sunt modificate Stripe, tariful comercial Pro, TVA, pragurile financiare sau Provider Score. Workspace și proprietățile Pro rămân entități separate. Viewer Pro nu primește drepturi financiare prin această delegare.

## Validare

Testele suplimentare acoperă redacția Operator/Financiar, respingerea mutațiilor directe chiar fără interfață, autor nominal, tranzacție anulată la eșecul auditului, conflicte CRM, origine, sesiune absentă și schimbarea rolului înainte de replay Pro. Testele de revocare MFA și de izolare organizație/proprietate existente rămân relevante.

Acceptanța sandbox necesită conturi nominale cu MFA, verificări browser pentru fiecare rol, apoi migrațiile Pro executate explicit și testele pe dispozitive. Rezultatele locale nu confirmă integrarea în `main`, publicarea sandbox/LIVE sau distribuția TestFlight/Google Play.
