# A3 — Eligibilitatea previzualizării oportunităților

Lista oportunităților și accesul direct la o lucrare în așteptare aplică acum aceeași verificare: firmă verificată, localitate acoperită, suspendare absentă/expirată și capacitate compatibilă cu regulile existente. O suspendare invalidă sau intervalul necunoscut al unei lucrări ocupate nu este tratat ca disponibilitate.

Pentru oferta asistată se verifică și firma propusă, echipa activă, asocierea la serviciu și indisponibilitățile echipei. Înainte, linkul direct permitea previzualizarea anonimizată inclusiv unei alte firme din aceeași localitate. Accesul la istoricul deja alocat este păstrat separat, inclusiv pentru o firmă ulterior suspendată.

Previzualizarea nu rezervă capacitate. Acceptarea păstrează reverificarea atomică existentă. Nu sunt schimbate plățile, scoringul, suspendările automate sau schema bazei de date. Fundalul crem din pachetul anterior rămâne inclus.

Validare: 47 teste în 4 fișiere (opportunityEligibility, assistedAllocation, acceptJob, acceptJobRecovery), TypeScript fără erori. 12 teste noi acoperă accesul direct, câmpurile private, suspendarea, localitatea, verificarea firmei, capacitatea ocupată/necunoscută, istoricul alocat, firma destinatară, echipa/serviciul și lista oportunităților.

## Stare reală a briefului

- A0–A2: pachete implementate și testate; validarea transversală sandbox rămâne distinctă.
- A3: în lucru. Incidentele, istoricul checklistului, dovezile și snapshotul raportului sunt implementate; acest pachet aliniază previzualizarea. Auditul complet al eligibilității tuturor rutelor nu este declarat închis.
- A4: pilot Pro de pregătit/validat: recurență fără duplicate, aprobări, izolare între organizații și raport client.
- A5: automatizări/raportări de închis după rezultate pilot și aprobarea parametrilor comerciali/scorului.
- Transversal: Standard/Express/Pro pe roluri în sandbox, iOS/Android, backup/restaurare și revenire. Buildurile TestFlight/Google Play și publicarea LIVE nu sunt confirmate de acest pachet.

Nu se poate deduce o dată sau un procent de finalizare totală din numărul de commituri. Închiderea depinde și de validarea efectivă a pilotului și a distribuției mobile. Accesul browser la sandbox a fost blocat anterior; verificarea vizuală nu este declarată efectuată.
