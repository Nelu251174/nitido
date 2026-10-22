# Programări și îngrijirea locuințelor — continuare sezon 2027

Mandat: aprobarea utilizatorului pentru publicarea lotului 1–3 și continuarea brief-ului, inclusiv reminderul pentru firme. Aprobarea nu este prezentată drept probă de recepție a unei notificări pe telefon.

## Reamintiri și confirmare

- Numai lucrările acceptate, viitoare, ale firmei verificate alocate primesc reamintiri. Cererile și candidaturile neconfirmate rămân distincte; regula existentă de acceptare/HOLD cu 48 de ore înainte nu se schimbă.
- Praguri de 24 de ore și 2 ore, calculate din momentul real al începerii; data/ora se afișează în Europe/Bucharest. Un worker întârziat trimite numai etapa încă relevantă.
- Notificare persistentă în cont, push pentru dispozitivele și serviciile configurate, plus e-mail operațional către adresa actuală confirmată, când livrarea este configurată.
- Textul extern conține localitatea și programul; adresa exactă și detaliile private se deschid exclusiv în contul firmei alocate, prin `/firma/programari?jobId=…`.
- „Confirm că ajung” înregistrează acordul firmei pentru data curentă; nu schimbă statusul lucrării, echipa, HOLD-ul sau plata. Lipsa confirmării apare în „Atenție azi”, fără verdict automat de absență.
- Anularea, reprogramarea, schimbarea firmei și revocarea dispozitivului invalidează livrările încă netrimise. Inboxul ascunde mesajele devenite nevalabile fără a aștepta workerul. O notificare deja primită extern nu poate fi retrasă.
- Cheie unică per lucrare/firmă/program/etapă/canal/dispozitiv, claims persistente și limitare de lot. Rezultatele externe incerte sunt carantinate, fără retrimitere automată. E-mailurile folosesc și cheia de idempotency a furnizorului. Nu se trimit notificări de demonstrație către persoane reale.
- `sent` pentru push/e-mail indică acceptarea raportată de furnizor; nu dovedește citirea sau recepția pe telefon. Confirmarea firmei este un eveniment separat.

Configurare: `NITIDO_APPOINTMENT_REMINDERS_ENABLED=true`, cheie independentă `NITIDO_APPOINTMENT_CRON_SECRET` de minimum 32 caractere și task `node scripts/appointment-reminders-runner.mjs`, în container, în fiecare minut. Nu se reutilizează `CRON_SECRET` și nu se activează cronuri financiare. GET-ul protejat al workerului raportează doar configurație booleană și contoare; nu execută livrări. Activarea și execuțiile naturale sunt verificate separat de probele sintetice.

Pentru push sunt necesare configurațiile FCM/APNs existente; pentru distribuția iOS de producție, APNs trebuie orientat spre producție. Fără ele, reminderul în cont și e-mailul configurat pot funcționa, dar push-ul nu este declarat activ. Pentru email se cere verificarea adresei actuale din cont.

## Lotul 4 — pregătirea pentru oaspeți

`/client/pregatire-oaspeti` reunește ferestrele reale și termenele dintre sejururi din modulul Host existent. Prezintă explicit lipsa unei cereri, așteptarea firmei, execuția, problemele sau starea de finalizare și linkul către lucrare/raport. Nu promite disponibilitate sau curățenie doar din prezența în calendar. Calendarul, checklisturile și inventarul se gestionează prin modulul existent. Citirea este pe proprietarul autentificat și are paginare pe proprietăți.

## Lotul 6 — dosare urmăribile

`/dosare` oferă clientului și firmei numai dosarele lucrărilor la care au acces, cu stare, descriere, actualizare și următorul pas. Filtrul deschise/toate păstrează accesul la istoric. Dovezile, răspunsurile, propunerea revenirii și acceptarea soluției continuă prin fluxul existent `/remedieri?jobId=…`; nu se introduc rambursări sau soluționări financiare automate.

## Lotul 7 — planul anual

`/client/planul-casei` salvează lunile dorite pe proprietate, cu geamuri suplimentare opționale. Nu generează lucrări, notificări, alocări sau plăți. Prețul orientativ se recalculează din proprietatea actuală, folosind grila curentă, și se confirmă din nou la rezervare. Proprietatea arhivată sau incompletă blochează continuarea. Planurile lunare duplicate și apăsările repetate nu creează dubluri; scoaterea din plan este o arhivare și nu anulează rezervări.

## Lotul 5 — suplimente contra cost: limită comercială concretă

Fluxul existent poate documenta o diferență de scop într-un dosar. Implementarea unui supliment executabil și plătibil peste suma lucrării acceptate ar necesita un mecanism comercial explicit: rezervare separată sau autorizare suplimentară. Brief-ul păstrează lucrările acceptate și integrarea Stripe neschimbate. Prin urmare, acest lot nu este declarat finalizat și nu se activează butoane care ar promite suplimente plătite fără mecanismul corespunzător.

Propunerea de implementare este o lucrare suplimentară legată de original, cu scop și sumă distincte, confirmare explicită a clientului și flux financiar separat; plata și suma lucrării originale rămân intacte. Analiza financiară, anularea suplimentului și reconcilierea trebuie acceptate înainte de implementarea operațiunilor. Fără această separare se păstrează doar raportarea și evaluarea prin fluxurile existente.

## Verificare și revenire

Schema adaugă numai tabelele de reminders/confirmări și planurile anuale. Înainte de LIVE: backup nou, restaurare izolată și probă a schemei aditive pe copie. Testele includ autorizare/origine, ownership, zile și ora de vară, reprogramare/anulare/reasignare, dublă apăsare, concurență, mesaje incerte, schimbarea adresei de email, HTML escaping și păstrarea câmpurilor financiare.

Se verifică separat buildul, HTTP/SSR, fișierele livrate, taskul activ și configurația efectivă. Browserul interactiv și probele pe iOS/Android nu sunt disponibile în această sesiune; rezultatele lor rămân NETESTATE. Textele noi pot folosi fallback în română până la completarea și revizia cataloagelor. Backupul pe volum nu înlocuiește backupul extern sau testele de încărcare pentru extinderea din 2027.

Revenire: repin la sursa LIVE dinaintea lotului, dezactivează numai workerul nou; păstrează tabelele aditive pentru reconciliere. Nu restaura automat baza peste tranzacții apărute după backup și nu relansa mesaje sau plăți.

## Dovezi locale — 22 octombrie 2026

- Vitest: 207 fișiere, 2.117 teste trecute, 95,12 secunde.
- TypeScript și ESLint pe fișierele schimbate: trecute.
- Runnerul de reminder: testul Node trecut.
- Aceste probe locale nu înlocuiesc verificarea buildului publicat sau recepția notificării pe telefon.
