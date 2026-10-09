# Dashboard Pro consolidat — raportare P1

## Livrare

`/pro/dashboard` folosește agregările serverului din `GET /api/pro/dashboard`, în locul statisticilor calculate din lista limitată de lucrări. Interfața reutilizează cardurile, tabelul și tema crem existente. Filtrele sunt organizația selectată, perioada, proprietatea și serviciul. Nu sunt introduse tarife, taxe, cote fiscale, reguli de aprobare sau fluxuri Stripe.

La prima deschidere, intervalul este de la prima zi a lunii curente până la ziua curentă în România. Datele sunt incluzive în calendarul **Europe/Bucharest** și devin un interval tehnic `[început, începutul zilei următoare ultimei zile)`. Zilele de schimbare DST pot avea 23 sau 25 de ore. Timestampurile cu offset sunt comparate ca momente efective. Înregistrările vechi de registru cu dată simplă `YYYY-MM-DD` rămân în ziua civilă declarată.

## Cohorte și interpretare

| Indicator | Selecție și definiție |
|---|---|
| Proprietăți autorizate/active | Inventar actual al organizației și scope-ului autorizat; proprietățile inactive sunt păstrate în raport |
| Lucrări totale și pe stări | Lucrări cu `starts_at` în interval; starea curentă este raportată, fără pretinderea unui istoric al stării la sfârșitul intervalului |
| Aprobări | Devizul din versiunea curentă a fiecărei lucrări selectate; versiunile înlocuite sunt excluse; o autorizare necesară fără deviz curent este semnalată separat |
| Lucrări recurente | Lucrări din cohorta de mai sus care au cel puțin o apariție asociată; aceeași lucrare nu se numără de două ori |
| Apariții generate/omise/de verificat | `pro_occurrences.day` în intervalul civil nominal; reprogramarea lucrării nu rescrie această zi |
| Planuri active/în pauză | Inventar actual de reguli pentru proprietățile și serviciul selectate; frecvența zilnică și activarea efectivă sunt citite din extensia migrației 14 |
| Registrul costurilor | Intrări autorizate după `pro_cost_entries.created_at`, cu același interval și scope ca exportul CSV existent |
| Cost final al lucrărilor finalizate | Snapshotul `final_cost` pentru lucrările finalizate din cohorta programată, numai dacă autorizarea financiară este `approved` sau `not_required` |

Registrul și snapshoturile finale au date de referință diferite și **nu se adună**. O lucrare programată în ianuarie, înregistrată financiar în februarie, poate apărea în cohorta lucrărilor din ianuarie și în registrul din februarie. Registrul reprezintă costuri aprobate pentru client; nu este prezentat drept venit contabil sau marjă NITIDO.

Agregările includ toate rândurile autorizate înainte de paginare; nu moștenesc limitele de 500 de lucrări sau 1.000 de intrări ale listelor existente. Tabelul proprietăților este paginat explicit la 100 de rânduri, cu total, număr returnat și pagina următoare. Indicatorii rămân calculați pentru întreaga selecție autorizată. Cele opt lucrări de urmărit reprezintă o listă recentă din cohorta selectată, nu baza de calcul a indicatorilor.

## Permisiuni și date necunoscute

Scope-ul organizației și al proprietăților se verifică pe server înaintea agregării. O proprietate cerută explicit, neautorizată sau din altă organizație, este respinsă cu 404. Scope-urile financiare sunt calculate separat: o persoană cu rol Viewer pe proprietatea A și Manager pe B vede operațiunile pentru ambele, dar costurile numai pentru B. Intrările organizației fără proprietate sunt incluse numai dacă există mandat financiar la nivelul organizației și nu este selectată o singură proprietate.

| Identitate | Date financiare |
|---|---|
| Owner/Manager/Operator organizație Pro | Costuri pentru proprietățile din scope-ul financiar existent |
| Viewer/Approver/Contact Pro | Indicatori operaționali autorizați; fără agregări de costuri sau export financiar implicit |
| Operator intern NITIDO | Indicatori operaționali; fără sume și fără marjă internă |
| Manager operațional/Financiar/Super Admin intern | Costuri autorizate și secțiune separată pentru disponibilitatea marjei interne |

Răspunsul nu conține adrese, instrucțiuni, coduri, fotografii private, checklisturi sau note ale lucrărilor. Secțiunea de marjă internă nu este trimisă clientului Pro. Pentru staff-ul autorizat, aceasta este explicit **necunoscută**, deoarece registrul Pro nu stochează separat venitul NITIDO, remunerația prestatorului și costurile directe necesare calculului; nu se presupune că registrul reprezintă marja.

Lipsa unui cost final autorizat produce `totalBani: null`, `complete: false` și numărul de lucrări necunoscute, alături de suma cunoscută. Sumele negative, fracționare sau invalide din registru nu devin zero confirmat. Timestampurile invalide nu pot fi atribuite perioadei: sunt numărate separat, iar totalul registrului este marcat incomplet. Un registru gol fără asemenea necunoscute poate avea un total cunoscut zero. Lipsa unei intrări de registru pentru o lucrare finalizată este afișată separat, fără a inventa o înregistrare sau o plată.

Raportul folosește o singură tranzacție de citire pentru un snapshot coerent. Endpointul cere autentificare și modulul Pro activ, aplică rate limiting și răspunde `Cache-Control: private, no-store`. Nu mută sau modifică date financiare.

## Export și operare

Butonul CSV reutilizează `reports/export`, cu intervalul efectiv și filtrele dashboardului. Structura CSV, regulile de autorizare și protecția celulelor rămân existente. Corecția comună de calendar București se aplică atât registrului din pagina Rapoarte, cât și exportului. Dacă exportul depășește 1.000 de înregistrări, se restrânge perioada, proprietatea sau serviciul; dashboardul nu trunchiază agregările pentru a ascunde această limită.

Pagina folosește aceleași controale de organizație și filtre precum workspace-ul existent. Permisiunile financiare restrânse sunt afișate ca acces restricționat în tabelul proprietăților; valorile necunoscute sunt afișate astfel, fără sume inventate.

## Verificări

Comenzi pentru selecția SQL/RBAC/HTTP și compatibilitatea Pro:

```bash
TZ=UTC npx vitest run src/lib/pro/portfolioReport.test.ts src/app/api/pro/portfolioDashboard.test.ts src/lib/pro/core.test.ts src/lib/pro/internalAccess.test.ts src/app/api/pro/internalRoles.test.ts src/app/api/pro/route.test.ts
TZ=Europe/Bucharest npx vitest run src/lib/pro/portfolioReport.test.ts src/app/api/pro/portfolioDashboard.test.ts src/lib/pro/core.test.ts src/lib/pro/internalAccess.test.ts src/app/api/pro/internalRoles.test.ts src/app/api/pro/route.test.ts
```

Scenariile verifică scope inter-organizații și proprietăți, revocări, roluri mixte, Viewer fără costuri, roluri interne, cohorte distincte, apariții fără dublări, versiuni de aprobări, costuri/date necunoscute, 1.050 de lucrări/intrări fără trunchiere, paginarea a 103 proprietăți și zile DST cu limite exacte comune cu CSV. Datele sunt sintetice.

Selecția de mai sus a trecut cu **97 de teste în fiecare fus orar**, inclusiv **28 de scenarii noi**: 21 în raportul SQL și 7 la nivel HTTP. TypeScript, ESLint pentru fișierele modificate și `git diff --check` au trecut.

Harness-ul izolat pe buildul production a confirmat scenariile dashboardului pentru cele patru roluri interne, Owner și Viewer cu scope restrâns: registru/CSV concordante, final necunoscut, restricții financiare și lipsa marjei interne în răspunsul clientului. Fontul indicatorilor este 28 px, etichetele 12 px, cardurile au padding 24 px și fundal crem `rgb(247, 243, 236)`. Raportul sesiunii este `/workspace/nitido-qa-operational-results/report.json`. Aceste verificări ale dashboardului au trecut; acceptarea responsive globală a consolei Admin se urmărește separat în raportul de etapă.

Pentru acceptarea browser se verifică Owner, Viewer, Operator intern și Financiar intern, filtrele/paginarea și lipsa deplasării orizontale a paginii la 390 px. Integrarea în `main`, verificarea sandbox, publicarea LIVE și compatibilitatea buildurilor mobile se raportează separat; implementarea acestui dashboard nu activează singură o lansare sau un pilot.
