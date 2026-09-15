# E4 — Curățenie între rezervări

Owner a aprobat explicit această denumire și executarea etapei la 15 septembrie 2026. NITIDO organizează exclusiv curățenia; nu oferă închirieri sau vânzare de sejururi.

## Livrare

- Meniu Client → Opțiuni profesionale → Curățenie între rezervări, ruta `/client/host`.
- Perioade ocupate introduse manual, cu ore exacte de sosire/plecare în Europe/Bucharest. Corectare și anulare cu verificarea versiunii; reluarea aceleiași salvări nu dublează perioada. Suprapunerile manuale sunt respinse. Fără date personale ale oaspeților.
- Ore uzuale per proprietate: sosire 15, plecare 11; configurabile 0–23. Marje după plecare și înainte de sosire, 0–240 minute (implicit 0 și 30).
- Importul manual ICS existent: datele întregi sunt convertite la orele proprietății, în ora României, iar valorile civile originale sunt păstrate separat. Schimbarea orelor recalculează aceste evenimente. Timestampurile UTC cu ore explicite nu sunt schimbate. DST verificat prin conversie și întoarcere la ora locală. Importurile vechi necesită reimportare pentru aplicarea orelor; nu se presupune că orice timestamp la miezul nopții era o dată întreagă.
- Propuneri pentru plecările din următoarele 30 de zile, ultimele 7 zile și evenimentele cu lucrări active; maximum 200 afișate. Intervalul este de la plecare + marjă până la următoarea sosire − marjă, plafonat la 24h după plecare. Lipsa următoarei sosiri este explicită. Durata estimată și bufferul standard trebuie să încapă integral. Sloturi existente 08/10/12/14/16/18, minimum o oră înainte.
- Conflictele cu perioadele ocupate și lucrările deja asociate proprietății sunt verificate pe server. O propunere nu garantează disponibilitatea unei firme.
- Deschiderea rezervării precompletează proprietatea, data și ora; publicarea folosește fluxul existent, cardurile existente, prețul calculat pe server și controalele de buget/aprobare. Nicio plată, anulare sau rezervare de curățenie automată la import/schimbarea calendarului.
- La publicare: revizia calendarului/proprietății și întregul interval sunt reverificate; parametrii de adresă/suprafață trebuie să corespundă proprietății. Legătură explicită între plecare și job. Tranzacție imediată, reluare a jobului deja creat pentru aceeași plecare, indiferent de dublu click/cheia cererii. Pentru o lucrare anulată/noshow este permisă o nouă rezervare, păstrând istoricul vechi.
- Contextul este păstrat la trecerea prin adăugarea cardului. Schimbările de calendar produc avertizare pentru lucrările existente și invalidează propunerile vechi, nu mută joburile.
- Reprogramarea verifică intervalul Host la propunere, acceptare și aplicarea finală. Asocierea lucrării Host la altă proprietate este blocată.
- Checklistul și inventarul existente rămân disponibile; confirmările sunt separate per plecare și resetate prin identitatea datei de plecare.

## Date și acces

Trei tabele aditive în WORKSPACE_SCHEMA: workspace_host_settings, workspace_host_event_dates, workspace_host_jobs. Nu se șterg rezervări/date existente. API `/api/host-turnover`: client autentificat, owner al proprietății active de tip host, validare origine pentru mutații, limitare cereri, răspunsuri private/no-store. Firmele nu primesc acces la calendarele proprietarilor sau la comision.

## Limite și pași următori E4

Sincronizarea automată prin URL iCal este documentată în NITIDO-E4-ICAL-AUTOMAT-20260915.md. Importul manual rămâne disponibil separat; un eveniment lipsă dintr-un import parțial nu este anulat implicit. Integrarea PMS bidirecțională nu este implementată. Activarea independentă și raportarea istorică extinsă rămân separate. Fără publicare nouă App Store/Google Play.

## Validare

Revizuire de sursă, TypeScript, ESLint pe fișierele noi și compilare Next.js. Conform instrucțiunii Owner, nu se repetă testele funcționale/plățile și nu se introduc rezervări de probă în conturile reale. Instalarea și healthcheck-ul se consemnează în checkpoint după execuție. E4 nu este declarată integral finalizată.
