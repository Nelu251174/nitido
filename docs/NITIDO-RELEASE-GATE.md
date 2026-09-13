# NITIDO — poarta de lansare și continuarea P0

Sursa cerințelor: brief master v1.0, secțiunile 13, 14, 16, 18–20; PR #49.
Baza acestei continuări: f18d0b3e9f346f4fd3d2011dc2b35a25c9daf521.
Verdict: **NO-GO producție**. Implementarea și verificarea în sandbox continuă; brief-ul integral nu este închis.

## Ce adaugă această continuare

- Reconciliere sandbox, exclusiv prin citiri Stripe: payout automat → balance transaction → destination payment → transfer de platformă → plată locală → lucrare. Asocierea folosește referințele providerului, nu sume, date sau metadate declarate. Validează contul beneficiar, moneda RON, suma și sursa transferului.
- Totalul folosește netul tranzacțiilor, inclusiv comisioanele, în unități minime. Viramentele manuale, monedele nesuportate, tranzacțiile neasociate, reversările și totalurile diferite rămân `needs_review`. `matched` cere total exact, toate liniile asociate și payout confirmat `paid` în sandbox.
- Raport nou la fiecare verificare, cu audit în aceeași tranzacție. Istoricul rapoartelor și stările plăților nu sunt rescrise. Admin poate calcula și consulta ultimul raport salvat. Un raport descrie momentul verificării, nu garantează starea viitoare a contului.
- Citirile Stripe sunt limitate la 1.000 de tranzacții/10 pagini și un buget de 30 secunde între apeluri (apelul în curs are propriul timeout). Eroarea de provider, paginarea incompletă sau schimbarea payout-ului nu generează raport de succes. Volumele mai mari necesită procesare offline/worker.
- Inbox durabil pentru notificările cu semnătură validă: anvelopă minimă cu identitatea evenimentului, cont, resursă și referințele folosite de reconciliere. Fără payloadul brut, date de card/client, metadate libere sau client secret. Erorile sunt coduri fixe. Înregistrarea precedă citirile externe; confirmarea procesării rămâne atomică împreună cu efectele locale.
- Evenimentele cu resurse neasociate rămân vizibile în admin și pot fi retrimise din Stripe după corectarea asocierii. Retrimiterea după un eșec intermediar recuperează starea. O cerere concurentă eșuată nu degradează o procesare reușită.
- Preflight fără divulgarea valorilor de mediu și validator executabil pentru dovezile de lansare.

Nu s-au schimbat procente, prețuri, politica de recepție, condițiile de anulare sau activarea transferurilor.

## Condițiile încă deschise

| ID | Responsabil propus | Criteriu PASS | Dovadă necesară |
|---|---|---|---|
| staging_configuration | Infrastructură + plăți | Cheile sunt din sandbox-ul corect; URL HTTPS de staging; semnătura webhook funcționează; test/live separate | Rezultat preflight, identitate cont, livrare semnată și verificarea perechii publishable/server, fără valori secrete |
| stripe_sandbox_lifecycle | Plăți + QA | 3DS reușit/refuzat/abandonat, pierdere conexiune și retry; aceeași intenție; rezervare → alocare → dovezi → capturare; refund pending/failed/succeeded corect | ID lucrare/PaymentIntent/eveniment, capturi și comparație cu baza locală |
| physical_devices | QA mobil | iOS/Android fizic: Expo → browser HTTPS → login separat → 3DS → revenire și stare reîncărcată; 360/390/430 px, tastatură/safe areas | Model, OS, build, înregistrări și rezultate pentru succes și eroare |
| authenticated_dashboards | QA | Client, firmă, angajat și admin: fluxurile complete; recuperare capturare, refund, excepții și payout; izolare între conturi/revocare | Capturi reale și probe API pe candidate SHA |
| financial_reconciliation | Plăți + financiar | Payout-lucrări verificat în contul sandbox, diferență neexplicată zero; resurse necunoscute, autorizare întârziată și evenimente concurente rezolvate sau controlate prin procedură demonstrată | Rapoarte salvate și probe de recuperare; un mock nu închide gate-ul |
| infrastructure_restore | Infrastructură | Backup coerent SQLite + fotografii, restaurat izolat pe infrastructura țintă, integritate, totaluri și acces foto demonstrate | Log, hashuri, verificări și timp măsurat; nu numai proba sintetică CI |
| production_approval | Owner | Toate gate-urile trecute pe candidatul final, CI exact și rollback pregătit, aprobare explicită | Aprobarea beneficiarului legată de SHA și rezultatele de mai sus |

Orice gate lipsă, pending, failed, waived sau fără dovezi = **NO-GO**. O schimbare de candidat cere reconfirmarea dovezilor afectate și legarea rezultatului de SHA nou. Nu se copiază automat PASS de la un commit anterior.

## Executare

În containerul de staging cu variabilele deja injectate securizat:

```bash
node scripts/staging-preflight.mjs
node scripts/staging-preflight.mjs --verify-stripe
```

A doua comandă citește numai identitatea contului Stripe și o compară cu `NITIDO_STRIPE_PLATFORM_ACCOUNT_ID`. Folosește preferabil o cheie restricționată de test cu permisiunile de citire necesare. Nu transmite și nu afișează secretul în raport. Verificarea formatului publishable key nu demonstrează apartenența la același cont: aceasta rămâne probă separată prin configurația contului și provocarea sandbox. Preflight nu declară lansarea acceptată și nu modifică mediul.

Pentru verificarea dovezilor, copiați `release-evidence.example.json` **în afara checkout-ului** și completați numai dovezile existente. Păstrați fișierul alături de raportul de acceptare, legat de SHA final; astfel nu apare o referință circulară la propriul commit.

```bash
node scripts/release-gate.mjs /cale/externa/release-evidence.json
```

Validatorul verifică forma dovezilor, SHA, proprietarul verificării, momentul și prezența tuturor gate-urilor. Nu autentifică autorul unei aprobări și nu verifică singur conținutul linkurilor: reviewerul trebuie să inspecteze dovezile. Ieșirea 1 înseamnă NO-GO; ieșirea 0 permite evaluarea finală. Nu este un mecanism de publicare.

`deploy.yml` continuă să declanșeze Coolify la push în `feat/design-handoff-website-mobile-v2`. Acest PR rămâne pe branch-ul de lucru. Validatorul nu a fost conectat automat la publicare și nu înlocuiește aprobarea Owner sau protecțiile GitHub/Coolify. Nu faceți merge pentru a testa staging.

## Dovezi locale ale acestei continuări

- 658 teste web/backend în 76 fișiere: PASS, inclusiv 38 de cazuri noi pentru reconciliere, API și inbox.
- 14 teste Node pentru gate/preflight, backup/restore și runner recurență: PASS.
- TypeScript web, ESLint și build Next.js: PASS.
- Preflight în mediul de dezvoltare: blocat corect; cheile Stripe, identitatea contului și configurația staging nu sunt injectate aici. Acest rezultat nu descrie configurația containerului de la sandbox.nitido.ro.
- Browser: pagina de login admin din sandbox este accesibilă; lipsa unei sesiuni autentificate împiedică verificarea dashboardului. Nu sunt declarate capturi sau verificări autentificate efectuate.
- CI trebuie verificat separat pe SHA publicat; rulările anterioare nu sunt atribuite noului commit. Nu s-a modificat codul mobil în această continuare.

## Migrare și rollback

Tabelele `payout_reconciliation_runs` și `stripe_webhook_inbox` sunt aditive. Pornirea pe schema existentă le creează fără backfill sau schimbarea sumelor/statusurilor istorice. Codul anterior poate ignora aceste tabele la rollback; nu le ștergeți. `stripe_events` păstrează dovezile anterioare de procesare. Evenimentele deja înregistrate înainte de această versiune nu sunt replayate financiar automat.

## Limite păstrate explicit

- Nu este un registru financiar complet, un inbox de payloaduri brute sau un worker de replay automat. Retrimiterea cere Stripe și, după intervalul disponibil pentru retrimitere, reconciliere operațională separată.
- Ordonarea strictă între evenimente diferite, compensarea autorizării sosite după anularea lucrării, generațiile de reautorizare, reconcilierea tuturor resurselor istorice și viramentele manuale rămân deschise.
- Nu au fost făcute tranzacții Stripe reale, capturări, rambursări sau transferuri în contul utilizatorului pentru aceste teste. Reconcilierea nouă blochează cheile live.
- Loginul admin de la `https://sandbox.nitido.ro/admin` este accesibil, dar browserul acestei sesiuni nu este autentificat. Nu se declară QA vizual autentificat pe baza testelor handlerelor.
- Brief-ul integral E0–E5, verificarea tuturor celor 41 de ecrane, integrările dependente de furnizori și publicarea în magazine rămân un program mai larg decât această continuare P0. Se păstrează cerințele din `NITIDO-MASTER-SOURCE.md` și limitele din documentele de implementare; nu se elimină prin acest gate.

## Referințe Stripe consultate

- [Tranzacții incluse în payout automat](https://docs.stripe.com/api/balance_transactions/list)
- [Identitatea transferului și destination payment](https://docs.stripe.com/api/transfers/object)
- [Charge și source_transfer](https://docs.stripe.com/api/charges/object)
- [Primirea și retrimiterea notificărilor](https://docs.stripe.com/webhooks)
