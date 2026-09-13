# NITIDO — poarta de lansare și continuarea P0

Sursa cerințelor: brief master v1.0, secțiunile 13, 14, 16, 18–20; PR #49.
Baza continuării actuale: 15a3df4c9059d8d12a80ef122412f97e63cb2769.
Verdict: **NO-GO producție**. Implementarea și verificarea în sandbox continuă; brief-ul integral nu este închis.

## Continuarea actuală: recuperarea confirmării Standard

Dovadă durabilă salvată în tranzacția plății autorizate și reluare idempotentă a confirmării locale, disponibilă clientului pe web/mobil. Nu apelează Stripe și nu modifică plăți; verifică tokenul, identitatea, sumele și stările înainte de actualizarea atomică a ofertelor și auditului.

[NITIDO-SELECTION-RECOVERY.md](NITIDO-SELECTION-RECOVERY.md) documentează domeniul, migrarea și cazurile încă deschise. Probele autentificate în staging și identitatea financiară la procesator rămân necesare. Aprobarea de publicare este primită; nu se cere repetarea ei.

## Continuarea precedentă: rezervare atomică și selecție Standard

Verificarea eligibilității/capacității și rezervarea firmei sunt în aceeași tranzacție SQLite. Suprapunerile folosesc durata și bufferul persistente. Selecția reverifică oferta, retragerea nu poate interveni după rezervare, iar confirmarea ofertelor este atomică. Conflictele de capacitate sunt distincte de o lucrare preluată de altă firmă.

Probe și limite: [NITIDO-ALLOCATION-INTEGRITY.md](NITIDO-ALLOCATION-INTEGRITY.md). Capacitatea pe mai multe echipe, expirarea rezervărilor și recuperarea automată a selecțiilor incomplete rămân deschise.

Aprobarea de producție a beneficiarului este primită. Nu este necesară repetarea aprobării; dovezile tehnice restante și instalarea efectivă nu sunt confirmate prin aceasta.

## Continuarea precedentă: MFA administrator

- Loginul admin cere parolă și TOTP sau cod de recuperare de unică folosință. Consumul factorului, sesiunea și auditul sunt atomice; replay-ul este blocat persistent.
- Sesiunile vechi fără MFA sunt refuzate. Rotația credentialelor/factorului invalidează sesiunile; lipsa secretului oprește loginul, fără bypass prin parolă.
- Preflight-ul verifică prezența configurației MFA; înrolarea pe dispozitiv și recuperarea reală rămân probe deschise. Nu instalați versiunea pe țintă înainte de pregătirea factorului.
- Domeniu: administratorul unic existent. MFA/reautentificarea modificărilor financiare sensibile ale firmei și rolurile administrative nominale rămân deschise. Operare: [NITIDO-ADMIN-MFA.md](NITIDO-ADMIN-MFA.md).

## Funcționalitatea precedentă: recuperare periodică sandbox

- Worker pentru notificările restante și anulările deja solicitate; verifică mediul sandbox și contul Stripe înainte de procesare. Recuperează evenimentul exact prin API autentificat, apoi folosește procesorul comun cu webhookul public.
- Rezervare de execuție în SQLite, protecție după expirare/restart, maximum 10 elemente pe lot, buget de pornire de 40 secunde și retry cu pauze. După 8 încercări automate, restanța cere intervenție.
- Istoric și excepții în admin; runner inclus în containerul standalone. Flagul este dezactivat implicit. Programarea și probele reale în staging nu sunt efectuate.
- Operare, dependențe, limite, migrare și probe: [NITIDO-FINANCIAL-RECOVERY.md](NITIDO-FINANCIAL-RECOVERY.md). Situația etapelor E0–E5: [NITIDO-STAGES.md](NITIDO-STAGES.md).

## Funcționalitatea precedentă: autorizări întârziate și notificări concurente

- Cerere persistentă de anulare înainte de Stripe, inclusiv când autorizarea este încă în curs și nu există plată locală. Rescue și no-show salvează tranziția, repostarea/consecința și cererea în aceeași tranzacție. Un timeout Stripe nu pierde aceste efecte și nu declară rezervarea eliberată.
- O autorizare revenită după anulare/no-show sau după o cerere de anulare nu este inserată/reutilizată drept `authorized`. Recuperarea citește PaymentIntent-ul cunoscut, verifică ID, sumă, RON și metadate, anulează doar stări compatibile și cere `canceled`. Dacă Stripe confirmase deja anularea după timeout, reluarea recuperează starea fără un nou apel de anulare. Nu creează un PaymentIntent pentru a-l anula.
- Cererile cu identitate necunoscută rămân `pending`; răspunsurile neconfirmate rămân `needs_review`, cu diagnostic fix. Audit separat pentru solicitare și confirmare, o singură dată. Admin afișează restanțele; reluarea din UI/API cere sesiune admin, origine validă, limitare de frecvență, cheie de test, resursă `livemode=false`, cerere existentă și lucrare `cancelled`/`no_show`.
- Acceptarea folosește un token persistent al încercării locale. Un răspuns vechi nu poate reseta acceptarea ulterioară a aceleiași firme și nu returnează succes după schimbarea stării. Confirmarea 3DS refuză și cererile cu anulare persistentă. Tokenul nu implementează generații noi de PaymentIntent.
- Notificările urmăresc versiunea resursei înainte de citirea Stripe. Tranzacția finală verifică și incrementează versiunea împreună cu efectele și receiptul. Dacă altă notificare a salvat între timp, răspunsul vechi produce HTTP 500, fără a suprascrie starea nouă; retrimiterea recitește providerul. Cheile sunt separate pe PaymentIntent, cont conectat și pereche cont+payout; resursele independente nu se blochează reciproc.

## Funcționalitatea precedentă păstrată

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
| staging_configuration | Infrastructură + plăți | Cheile sunt din sandbox-ul corect; URL HTTPS de staging; semnătura webhook funcționează; test/live separate; configurație MFA admin pregătită | Rezultat preflight, identitate cont, livrare semnată și verificarea perechii publishable/server, fără valori secrete |
| stripe_sandbox_lifecycle | Plăți + QA | 3DS reușit/refuzat/abandonat, pierdere conexiune și retry; aceeași intenție; rezervare → alocare → dovezi → capturare; refund pending/failed/succeeded corect | ID lucrare/PaymentIntent/eveniment, capturi și comparație cu baza locală |
| physical_devices | QA mobil | iOS/Android fizic: Expo → browser HTTPS → login separat → 3DS → revenire și stare reîncărcată; 360/390/430 px, tastatură/safe areas | Model, OS, build, înregistrări și rezultate pentru succes și eroare |
| authenticated_dashboards | QA | Client, firmă, angajat și admin: fluxurile complete; login MFA, recuperare și revocare demonstrate; recuperare capturare, refund, excepții și payout; izolare între conturi/revocare | Capturi reale și probe API pe candidate SHA |
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

- 880 teste web/backend în 85 fișiere: PASS; 38 cazuri noi pentru dovadă, recuperare și autorizarea endpointului.
- 93 teste mobile în 11 fișiere și TypeScript mobil: PASS.
- ESLint și build Next.js cu TypeScript: PASS.
- CI se verifică pe candidatul publicat, cu rezultatul în PR #49. Probele runtime nu sunt înlocuite de testele automate.

## Dovezi ale continuării precedente de alocare

- 842 teste web/backend în 83 fișiere: PASS. Include 41 scenarii noi cu două conexiuni SQLite, intercalare între citire și rezervare, durate/buffere, retragere, compensare și rollback.
- 93 teste mobile în 11 fișiere și TypeScript mobil: PASS.
- ESLint și build Next.js cu verificare TypeScript: PASS.
- CI pe candidatul publicat se verifică separat și se consemnează în PR #49.

## Dovezi ale continuării MFA precedente

- 801 teste web/backend în 82 fișiere: PASS, cu 54 de cazuri noi pentru MFA, autentificare și acces admin. Include vectori RFC, replay, sesiuni vechi, recuperare, rotație, concurență și limite persistente.
- 23 teste Node pentru gate/preflight, backup/restore, runnere și înrolarea MFA offline: PASS.
- TypeScript web, ESLint și build Next.js: PASS.
- Preflight în mediul de dezvoltare: blocat corect; cheile Stripe, identitatea contului și configurația staging nu sunt injectate aici. Acest rezultat nu descrie configurația containerului de la sandbox.nitido.ro.
- Browser: pagina de login admin din sandbox este accesibilă; lipsa unei sesiuni autentificate împiedică verificarea dashboardului. Nu sunt declarate capturi sau verificări autentificate efectuate.
- CI trebuie verificat separat pe SHA publicat; rulările anterioare nu sunt atribuite noului commit. Nu s-a modificat codul mobil în această continuare.

## Migrare și rollback

MFA adaugă patru tabele de stare fără backfill al sesiunilor existente. Aceste sesiuni nu primesc automat drepturi MFA. Pregătiți configurația înainte de instalare. Nu rulați în paralel versiunea veche și cea nouă; rollbackul la login numai cu parolă reduce protecția și nu este echivalent. După restaurarea bazei, rotiți factorul și codurile pentru a evita reutilizarea marcajelor revenite la o stare veche.

Recuperarea periodică adaugă `financial_recovery_lock`, `financial_recovery_runs` și `financial_recovery_items`. Opriți programarea și dezactivați flagul înainte de rollback, apoi verificați încheierea lotului deja pornit. Păstrați istoricul și restanțele. Procesorul comun înlocuiește implementarea din ruta webhook fără eliminarea verificării semnăturii.

Această continuare adaugă `job_acceptance_claims`, `payment_cancellation_requests` și `stripe_resource_versions`, fără backfill financiar. Nu ștergeți cererile, auditul sau versiunile. Nu rulați simultan handlerul vechi și cel nou: versiunea veche nu respectă protecțiile. Înainte de rollback, opriți preluarea de lucrări și consumarea notificărilor, inventariați cererile neconfirmate și păstrați mecanismul de reconciliere disponibil; reluarea pe codul vechi necesită evaluarea explicită a acestor restanțe. Aditivitatea schemei nu garantează singură siguranța financiară a rollbackului.

Tabelele `payout_reconciliation_runs` și `stripe_webhook_inbox` sunt aditive. Pornirea pe schema existentă le creează fără backfill sau schimbarea sumelor/statusurilor istorice. Codul anterior poate ignora aceste tabele la rollback; nu le ștergeți. `stripe_events` păstrează dovezile anterioare de procesare. Evenimentele deja înregistrate înainte de această versiune nu sunt replayate financiar automat.

## Limite păstrate explicit

- Workerul nou recuperează automat, după activare în sandbox, numai restanțe deja înregistrate. Nu este registru financiar complet, scanare integrală a contului sau inbox de payloaduri brute. Evenimentele în afara ferestrei Events API necesită reconciliere separată.
- Compensarea autorizării întârziate cu identitate cunoscută și protecția între notificările concurente sunt implementate și testabile în repository. Confirmarea lor în Stripe sandbox rămâne deschisă. Rezultatele necunoscute după oprirea procesului, fără ID de provider, cer reconciliere separată; workerul nu inventează asocierea și nu creează alte intenții.
- Versiunile protejează scrierile efectuate de acest handler webhook pe aceeași bază SQLite. Nu asigură ordonarea globală după timpul Stripe, consistența între baze independente sau coordonarea tuturor scrierilor API/worker. Generațiile de reautorizare, reconcilierea tuturor resurselor istorice și viramentele manuale rămân deschise.
- Nu au fost făcute tranzacții Stripe reale, capturări, rambursări sau transferuri în contul utilizatorului pentru aceste teste. Reconcilierea nouă blochează cheile live.
- Loginul admin de la `https://sandbox.nitido.ro/admin` este accesibil, dar browserul acestei sesiuni nu este autentificat. Nu se declară QA vizual autentificat pe baza testelor handlerelor.
- Brief-ul integral E0–E5, verificarea tuturor celor 41 de ecrane, integrările dependente de furnizori și publicarea în magazine rămân un program mai larg decât această continuare P0. Se păstrează cerințele din `NITIDO-MASTER-SOURCE.md` și limitele din documentele de implementare; nu se elimină prin acest gate.

## Probe de staging încă necesare pentru aceste corecții

| Scenariu | Execuție controlată în sandbox | PASS |
|---|---|---|
| Autorizare întârziată | Întârziați răspunsul de autorizare printr-un proxy de test; anulați lucrarea/no-show; permiteți răspunsul | Același PI este `canceled`; fără plată locală autorizată și fără notificare de acceptare reușită; cerere procesată și audit |
| Timeout la anulare | Întrerupeți răspunsul după acceptarea anulării de Stripe; reluați cererea din admin | Același PI, citire a stării `canceled`, fără o autorizare nouă și fără repostare/strike duplicat |
| Identitate necunoscută | Întrerupeți răspunsul autorizării înainte ca ID-ul să fie salvat; opriți procesul | Restanța rămâne vizibilă; operatorul identifică și verifică exact PI-ul înainte de închidere; simplul retry nu produce PASS |
| Două notificări, aceeași resursă | Întârziați citirea pentru prima livrare; procesați a doua; eliberați prima și retrimiteți-o | Starea mai nouă nu este suprascrisă; prima primește 500, apoi se recuperează pe starea curentă |
| Acces admin | Încercați recuperarea fără sesiune, cu origine străină, cheie live și lucrare activă | Cererile sunt respinse fără apel de anulare |

Păstrați ID lucrare/PI/evenimente, candidate SHA, timpi, rezultat DB și dovezi Stripe redactate. Dacă proxy-ul nu poate controla reproducibil ordinea, proba rămâne pending; testul automat local nu se etichetează drept test de staging.

## Referințe Stripe consultate

- [Tranzacții incluse în payout automat](https://docs.stripe.com/api/balance_transactions/list)
- [Identitatea transferului și destination payment](https://docs.stripe.com/api/transfers/object)
- [Charge și source_transfer](https://docs.stripe.com/api/charges/object)
- [Primirea și retrimiterea notificărilor](https://docs.stripe.com/webhooks)

- [Anularea PaymentIntent și stările permise](https://docs.stripe.com/api/payment_intents/cancel)
