# A2 — Interval propus de Admin pentru oferta acceptată

Continuă PR61. Pachet pentru sandbox, fără deploy sau modificări Stripe. Nu închide ofertarea manuală complexă din brief.

## Flux livrat

Admin poate propune ziua și ora unei rezervări pentru o ofertă acceptată și compatibilă cu rezervarea simplă. Se reutilizează orele, timpul minim de programare și calendarul Europe/Bucharest existente. Admin stabilește explicit termenul de confirmare și motivul intern. Termenul nu poate depăși limita de timp la care rezervarea mai poate fi creată.

Clientul vede intervalul în ora României și termenul de confirmare, completează adresa și confirmă explicit suma și intervalul la crearea rezervării. Propunerea nu rezervă o echipă și nu garantează disponibilitatea: preluarea și verificarea capacității rămân în fluxul existent. Durata este calculată prin regula existentă, fără durată manuală introdusă arbitrar.

Prețul provine din oferta acceptată. Snapshotul lucrării reține și revizia intervalului confirmat, fără nota internă sau identificatorul administratorului. Crearea lucrării, snapshotul, legătura unică ofertă–lucrare și evenimentul de audit rămân în aceeași tranzacție.

## Concurență și istoric

- Propunerile sunt revizii imutabile. Modificarea sau retragerea se face printr-o revizie nouă, cu motiv și audit Admin atomic.
- Clientul transmite exact revizia, ziua și ora afișate. Modificarea, retragerea, expirarea ori schimbarea cererii blochează confirmarea veche.
- Verificarea se repetă în tranzacția de creare a rezervării, după verificările preliminare.
- O propunere expirată nu este convertită tacit în următorul interval disponibil. Admin o înlocuiește sau o retrage; clientul reconfirmă opțiunea afișată.
- După creare, reîncercarea întoarce aceeași rezervare inclusiv după expirare. Admin nu poate folosi propunerile pentru a modifica o lucrare deja creată; se folosește reprogramarea existentă.
- Repetarea salvării Admin cu o revizie veche primește conflict și cere actualizare; nu creează încă o propunere.

## Acces și activare

Endpointul /api/assessments/schedule permite citirea numai clientului proprietar sau Admin verificat. Scrierea este exclusiv Admin, verifică originea și folosește identitatea sesiunii, nu un actor din formular. Clientul nu primește motivul intern. Răspunsurile sunt private, no-store.

Se reutilizează activarea sandbox existentă NITIDO_MANUAL_OFFERS_SANDBOX și NITIDO_MANUAL_OFFER_BOOKING_SANDBOX, cu domeniul exact și respingerea cheilor Stripe live. Nu s-au schimbat variabile de mediu. Tabela nouă assessment_offer_schedules nu rescrie ofertele sau lucrările existente.

La revenire, se dezactivează crearea ofertelor manuale în rezervări și se păstrează tabela, istoricul și snapshoturile. Codul vechi nu cunoaște propunerile și nu trebuie reactivat pentru rezervări manuale cât timp există propuneri active. Nu se șterg date pentru rollback. Se păstrează și protecțiile fotografiilor documentate în PR61.

## Verificare

Suita test:upgrade:a2-scheduling include regresiile anterioare și testele noi prin API-ul Admin și API-ul real de rezervare, cu SQLite. Se verifică ora de vară/iarnă în România, revizia concurentă, expirarea exactă, retragerea, confirmarea alterată, accesul între clienți, auditul cu rollback, protecția istoricului și reîncercarea fără duplicare. Nu sunt efectuate plăți externe.

Comenzi: TZ=UTC npm run test:upgrade:a2-scheduling; TZ=Europe/Bucharest npm run test:upgrade:a2-scheduling; npx next typegen; npx tsc --noEmit; ESLint pe fișierele schimbate. 474 teste în 37 fișiere trecute în ambele fusuri orare; verificările de tipuri și lint țintit au trecut.

Verificarea vizuală și E2E în sandbox rămâne restantă din cauza blocajului browserului consemnat anterior. Nu au fost publicate builduri TestFlight/Google Play și nu este declarat un deploy LIVE.

## Restanțe concrete A2

Acest pachet rezolvă alegerea unui interval de către operator pentru ofertele deja compatibile. Renovările, suprafețele mari, dificultatea ridicată, suplimentele complexe, durata și echipele negociate necesită încă integrare operațională completă. Reducerile comerciale și remunerațiile prestatorilor diferite de regula existentă rămân blocate, până la reconcilierea lor explicită cu fluxul financiar aprobat. Rapoartele de cost efectiv versus estimat rămân deschise. Nu se declară aceste restanțe rezolvate prin simpla adăugare a unui calendar.
