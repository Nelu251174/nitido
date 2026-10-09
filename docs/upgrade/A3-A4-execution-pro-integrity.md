# Pachet consolidat A3 / pregătire A4

## Execuție Marketplace

Acceptarea Express, renunțarea firmei și transmiterea/ștergerea localizării aplică acum politica existentă a originii cererii, după autentificare. Permisiunile și efectele financiare existente sunt păstrate. Patru scenarii verifică respingerea înainte de mutații/plată.

## Recurența Pro

Crearea lucrării, aprobările și auditul său, împreună cu înregistrarea apariției recurente, sunt salvate în aceeași subtranzacție. Eroarea de stocare nu mai este mascată drept programare ratată: se propagă și anulează rularea, inclusiv avansarea calendarului. Astfel, reluarea poate genera lucrarea corect o singură dată. Erorile de business Pro 4xx și programările efectiv trecute rămân semnalate pentru verificare; erorile tehnice opresc rularea.

Testele injectează erori în pro_occurrences, pro_audit_logs și pro_work_orders. Verifică absența lucrărilor/aprobărilor orfane, păstrarea datei și auditului, apoi reluarea fără duplicate. O programare trecută are un scenariu separat.

## Izolarea listelor Pro

Costurile, aprobările și recurențele foloseau un scope care includea toate rolurile. Combinația manager limitat la o proprietate + viewer general putea extinde accesul la date financiare. Filtrarea folosește acum numai rolurile relevante fiecărei liste și scope-ul lor. Costurile fără proprietate sunt vizibile doar unui rol financiar/operațional cu scope general sau adminului autorizat. Dreptul de vizualizare generală a proprietăților rămâne separat.

Scenariul mixt verifică manager+approver limitat și viewer general, două proprietăți din aceeași organizație, costuri generale, aprobări și reguli recurente. Ownerul păstrează accesul complet. Nu se adaugă abonamente, praguri, scoruri sau schimbări Stripe.

## Verificare și stare

609 teste în 45 fișiere trecute atât cu TZ=UTC, cât și TZ=Europe/Bucharest. Comanda test:upgrade:a3-reports include acum și testele oportunităților din pachetul anterior. TypeScript și git diff --check trecute. Nouă scenarii noi în acest pachet. Tema crem și toate corecțiile precedente sunt incluse.

Acestea sunt verificări automate ale implementării. A3 nu este declarat închis integral, iar pilotul A4 nu este declarat executat. Rămân validarea efectivă Standard/Express/Pro pe roluri în sandbox, dispozitivele iOS/Android, backup/restaurare și pilotul operațional. Browserul sandbox a fost anterior blocat; nu s-a ocolit restricția. Nu s-a efectuat publicare LIVE sau distribuție TestFlight/Google Play.

Pachetul este grupat într-o singură ramură pentru o singură livrare în sandbox, fără a solicita redeploy după fiecare corecție.
