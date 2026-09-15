# E4 — Activarea modulelor pe organizație

## Livrare

Client → Organizații → organizația selectată → Modulele organizației.

- Module: Birouri și firme (business), Curățenie între rezervări (host), Sincronizare iCal (ical).
- Titularul poate activa/dezactiva. Solicitantul, aprobatorul și vizualizatorul văd stările, fără drept de modificare. iCal necesită host; dezactivarea host dezactivează și iCal.
- Setările sunt separate pe organizație, cu revizie optimistă proprie și audit înainte/după. Nu schimbă rolurile, pragurile sau politica financiară.
- Compatibilitate: fără configurație explicită, Business este activ, Host și iCal inactive. Organizațiile anterioare puteau conține numai locații Business. Proprietățile personale și calendarele personale rămân independente.
- Organizațiile pot include și proprietăți host. Asocierea cere titular comun, proprietate activă și modul corespunzător activ. Se păstrează blocajele existente pentru mutarea proprietăților cu solicitări, lucrări sau serii în curs. Schimbarea utilizării unei proprietăți asociate cere detașare prealabilă.
- Din modulul activ, titularul poate deschide portofoliul organizației cu `organizationId` în URL. Business/Host/Proprietăți au selector de portofoliu; alegerea resetează selecțiile și formularul anterior. Membrii folosesc fluxul existent de Solicitări și aprobări, fără a primi implicit administrarea calendarelor private ale titularului.
- Modulele dezactivate nu oferă linkul de deschidere din organizație. Accesarea paginii cu organizația respectivă afișează explicația și accesul la setări. Meniul global păstrează accesul la portofoliile personale și celelalte organizații.

## Dezactivare și protecții pe server

Dezactivarea este o oprire a operațiunilor noi, nu ștergere sau revocare a accesului la istoric.

- Publicarea de lucrări pe proprietățile modulului este blocată în tranzacția de rezervare, inclusiv după consumarea unei aprobări (rollback integral). Generarea recurentă folosește aceeași regulă; crearea de serii noi și solicitările/aprobările noi sunt blocate.
- Datele existente, membrii, istoricul, deciziile nefolosite și lucrările confirmate sunt păstrate. Finalizarea, plățile, anularea/reprogramarea lucrărilor existente și retragerea solicitărilor rămân în fluxurile existente. Reactivarea nu anulează controalele de rol, buget sau prag; seriile existente pot genera din nou conform regulilor lor.
- Mutațiile editorului proprietății, inventarului, verificărilor de pregătire, perioadelor manuale și importului calendarului verifică modulul organizației. Mutațiile Workspace/Host verifică și scriu în tranzacție imediată. Citirea istoricului rămâne permisă utilizatorilor autorizați.
- Conectarea, reluarea, sincronizarea manuală și workerul iCal verifică modulul pe server. Dezactivarea oprește conexiunile, invalidează lease/token/versiune și șterge confirmările intermediare de absență. Un download pornit anterior nu mai poate aplica datele.
- Reactivarea modulului iCal nu repornește singură linkurile private: titularul reia explicit conexiunea. Asocierea unei proprietăți cu iCal activ unei organizații fără acest modul pune conexiunea în pauză. Detașarea nu reia automat conexiunea.
- Nicio modificare a comisioanelor vizibile firmelor și nicio plată nouă automată la modificarea setărilor.

## Implementare

Tabel aditiv `workspace_organization_modules`, fără ștergerea datelor existente. Configurația implicită este calculată pentru organizațiile fără rând. `organizationModules`, `propertyModuleEnabled`, `requirePropertyModule`, `saveOrganizationModules` în organizations.ts. API `/api/organizations` acțiunea `modules.save`, owner verificat, origine și rate limit existente, revizie obligatorie.

Interfață verde, controale responsive, stare salvată separată de modificările formularului. Raportul Business primește implicit organizația selectată și o păstrează fixă în acel context. Raportarea istorică extinsă rămâne următoarea lucrare E4.

## Validare

Revizuire de sursă, TypeScript, ESLint și build Next.js. Fără reluarea testelor funcționale/plăților, fără organizații sau rezervări de probă create. Stările organizațiilor reale nu sunt schimbate de agent prin formular; titularul configurează modulele dorite după instalare. Compilarea și healthcheck-ul nu constituie o verificare autentificată a tuturor combinațiilor de rol/module.

Instalarea vizează exclusiv sandbox pe ramura codex/nitido-full-option-v3. Publicarea în App Store și Google Play este separată. E4 nu este declarată integral finalizată.
