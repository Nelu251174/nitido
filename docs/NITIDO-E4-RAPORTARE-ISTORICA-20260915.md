# E4 — Raportare istorică extinsă și alinierea formularului

## Livrare

- Butonul Creează organizația și câmpul Denumire au aceeași înălțime de 44 px, aliniate la baza rândului. Formularul permite trecerea pe rând nou pe ecrane înguste.
- Ruta `/client/rapoarte`, accesibilă din Opțiuni profesionale → Rapoarte și arhivă și din modulele organizației. Rămâne accesibilă titularului și când modulele Business/Host sunt dezactivate.
- Raport actualizat după intervalul inclusiv al finalizării în UTC (maximum 367 de zile per interogare), portofoliu Business/Host/toate, organizație și locație. Lista include proprietăți arhivate. Filtrul lunar anterior rămâne compatibil în API.
- Totaluri RON calculate în bani, număr de lucrări, recepții confirmate, dosare deschise, sumar pe luni și pe locație/centru de cost.
- Detaliu: lucrare, adresă, organizație, locație, centru de cost, firmă, valoare brută, întârziere calculată, număr fotografii valide, starea recepției și dosarelor la generare. Nu se adaugă comisioane în profilul firmei.
- Export CSV cu protecția existentă împotriva interpretării celulelor ca formule, coloane pentru organizație, dovezi, momentul generării și interval.

## Arhiva

Titularul introduce denumirea și apasă Actualizează și salvează în arhivă. Serverul verifică drepturile, recalculează și salvează aceeași versiune într-o tranzacție imediată. Interfața afișează versiunea returnată de server, nu un total anterior.

Tabel aditiv `client_report_archive`, JSON complet al raportului, owner, organizația selectată, dată, denumire și cheie de idempotency cu amprentă a filtrelor. Triggerul respinge UPDATE; nu există API de modificare sau ștergere. Repetarea aceleiași cereri întoarce raportul original; reutilizarea cheii cu alte filtre este respinsă. Protecții de origine, autentificare client, rate limit, dimensiune body, filtre parametrizate și no-store.

Deschiderea și CSV-ul unui raport salvat citesc JSON-ul păstrat, fără recalcularea lucrărilor. Lista este paginată, 20 de rapoarte/pagină, filtrată după owner și opțional organizație. Numai contul care a salvat raportul îl poate accesa; invitația într-o organizație nu acordă automat acces la arhiva titularului.

Maximum 10.000 de lucrări per raport; depășirea este respinsă cu instrucțiune de restrângere a intervalului, fără totaluri trunchiate. Nu se creează automat rapoarte pentru perioade vechi și nu se generează rezervări sau plăți.

## Semantica istorică

Asocierea organizației, numele locației, centrul de cost și stările documentelor sunt cele observate la generare. Nu se inventează retrospectiv apartenența la organizație din momentul execuției. Versiunea salvată păstrează acele valori chiar dacă ulterior proprietatea se redenumește sau este mutată.

Raportul salvat este o fotografie a datelor operaționale la generare, nu arhivă fiscală sau contractuală. Legăturile către lucrare/remedieri deschid datele și documentele actuale, cu autorizarea existentă. Fotografiile și facturile nu sunt copiate în raport. Nu se pretinde că valorile brute sunt bani încasați sau reconciliere bancară.

## Verificare și instalare

Revizuire sursă, TypeScript, ESLint, compilare Next.js și verificare pornire container sandbox. Fără reluarea testelor funcționale/plăților și fără rapoarte sau organizații de probă în conturile reale. Aceste verificări nu înlocuiesc confirmarea autentificată a folosirii arhivei.

Instalare exclusiv în sandbox, ramura codex/nitido-full-option-v3. Publicarea App Store/Google Play este separată. Acest livrabil nu declară închise automat cerințele comerciale, pilotul organizațional sau conectarea unui calendar privat real.
