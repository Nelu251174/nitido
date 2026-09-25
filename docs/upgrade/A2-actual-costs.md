# A2 — Costuri estimate versus costuri efective

Continuă PR66, fără deploy LIVE, activarea Stripe sau date reale de test.

## Ce schimbă

În Admin, sub fiecare ofertă acceptată, apare raportul Cost estimat versus cost efectiv. După ce oferta are o lucrare asociată, raportul citește exact revizia estimării publicate în acea ofertă, nu ultimul calcul al cererii. Compară remunerația prestatorului și costurile pentru materiale, deplasare, procesare, alte costuri și ajustarea fiscală documentată.

Costurile efective se pot înregistra numai după finalizarea execuției. Prima completare pornește cu sume necunoscute, nu cu estimări copiate și declarate efective. Fiecare cost confirmat are sumă în bani, sursă, dată și suportator. Zero trebuie declarat explicit și documentat. Costurile lipsă păstrează marja și diferența necunoscute. Starea estimated este refuzată în costurile efective.

Suma serviciului și reducerea sunt preluate pe server din revizia acceptată; formularul nu le poate modifica. Remunerația efectivă declarată în raport nu schimbă suma plătită prestatorului. Materialele și deplasarea suportate de prestator nu se deduc încă o dată din partea NITIDO. Diferența de marjă este marja cu costurile declarate minus marja din oferta inițială. Pot rezulta valori negative.

## Limite financiare explicite

Acesta este un raport operațional intern, cu suma contractuală acceptată drept bază de comparație. Nu reprezintă profit net, venit contabil, numerar încasat sau reconciliere Stripe. Nu deduce automat rambursări, dispute sau sume nerecuperate. Nu inventează TVA, reguli fiscale sau costuri de procesare. Înregistrările efective sunt declarații documentate ale operatorului, nu date importate automat de la procesator. Nu se modifică prețuri, plăți, transferuri, payouturi sau starea lucrării.

Acoperirea este limitată la lucrările legate de oferte manuale acceptate. Lucrările automate Standard/Express și contractele Pro care nu au această legătură nu sunt incluse. Rapoartele agregate și reconcilierea financiară completă rămân etape distincte.

## Istoric și acces

Tabela job_actual_costs este append-only, cu revizie per lucrare, actor din sesiunea Admin și data salvării. Corecțiile creează revizii; triggerele refuză modificarea și ștergerea istoricului. Salvarea și auditul Admin sunt în aceeași tranzacție BEGIN IMMEDIATE. Revizia concurentă este refuzată; eroarea auditului anulează înregistrarea.

API-ul /api/admin/job-costs cere Admin verificat pentru citire și scriere. Răspunsurile sunt private/no-store. Scrierea cere origine de încredere, limita corpului de 30 KB și activarea sandbox existentă manualOfferBookingEnabled, cu domeniul sandbox exact și fără chei live. Nu s-au schimbat variabile de mediu. Raportul nu este adăugat în API-urile clientului sau firmei.

## Validare și revenire

12 teste noi acoperă autorizare, origine, dezactivare, baseline istoric, preț și discount nemodificabile, cost necunoscut, lipsa sursei, suportator, finalizarea execuției, revizii concurente, istoric imutabil, rollback al auditului și cereri invalide. Suita cumulată test:upgrade:a2-actual-costs are 529 teste în 40 fișiere, rulată în UTC și Europe/Bucharest, plus Next typegen, TypeScript și ESLint țintit.

Verificarea vizuală sandbox pe roluri rămâne restantă din cauza blocajului de acces anterior. Nu se declară execuție reală, plată sandbox end-to-end sau publicare mobilă.

Revenirea la codul părinte păstrează tabela și reviziile de cost. Nu se șterge istoricul pentru rollback. Cerințele de revenire ale alocării atomice rămân valabile pentru lucrările asistate active.
