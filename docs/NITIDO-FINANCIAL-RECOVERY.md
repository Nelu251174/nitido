# E2 — recuperare financiară periodică în sandbox

Implementare din brief §13 și §16. Bază: `c8ba38baee8d7e2c12b265130c56d0c8fc14b493`.
Această livrare adaugă procesarea periodică a restanțelor deja cunoscute. Nu închide acceptarea E2 și nu activează producția.

## Comportament

1. Verifică activarea explicită, cheia Stripe de test, originea exactă `https://sandbox.nitido.ro`, transferurile dezactivate și contul platformei așteptat.
2. Obține o rezervare exclusivă de 120 secunde în SQLite. Două procese pe aceeași bază nu pornesc două loturi. O rezervare expirată marchează rularea veche drept întreruptă; procesul vechi nu poate confirma efecte locale după preluarea rezervării de alt proces.
3. Citește identitatea contului asociat cheii, prin `GET /v1/account`. O nepotrivire oprește rularea înainte de procesarea restanțelor.
4. Selectează maximum 10 restanțe eligibile: notificări primite anterior cu semnătură validă și anulări deja solicitate pentru lucrări `cancelled`/`no_show`.
5. Pentru notificări, citește evenimentul original prin ID de la Stripe, în contextul contului conectat dacă există. Verifică ID, tip, cont, resursă și `livemode=false`, apoi folosește același procesor ca webhookul normal. Procesorul păstrează verificările de identitate, deduplicarea și versiunile resurselor.
6. Pentru anulări, folosește numai PaymentIntent-ul cunoscut din evidența locală. Poate solicita anularea unei rezervări de test deja cerute; nu inițiază decizii noi de anulare a lucrărilor. Nu creează intenții, capturări, rambursări sau transferuri.
7. Persistă numărul încercării înainte de provider. Restanțele nerezolvate primesc pauze de 1, 2, 4, 8 minute etc., maximum 6 ore. După 8 încercări automate intră în lista pentru intervenție. Restartul nu resetează numărul încercărilor.
8. Înregistrează istoricul și totalurile rulării. `completed` descrie încheierea lotului; câmpurile `deferred` și `failed` pot fi nenule. Restanțele individuale rămân sursa rezultatului financiar, inclusiv dacă procesul se oprește după salvarea efectului și înainte de salvarea totalurilor lotului.

Bugetul este 40 secunde înainte de începerea fiecărui element. Apelurile Stripe au timeout de 8 secunde și fără retry intern; elementul deja început poate depăși bugetul lotului. Runnerul așteaptă maximum 55 secunde. Un timeout al runnerului produce rezultat neconfirmat, nu anularea garantată a execuției serverului. Rezervarea și idempotency key protejează reluarea; recuperarea recitește Stripe înaintea unei noi solicitări de anulare.

## Activare și programare

Codul este dezactivat implicit. În serviciul **de staging**, injectați prin configurația securizată:

- `NITIDO_FINANCIAL_RECOVERY_ENABLED=true`;
- `NITIDO_FINANCIAL_RECOVERY_SECRET`, aleator, minimum 32 caractere, distinct de celelalte secrete;
- `STRIPE_SECRET_KEY`: preferabil cheie restricționată de test, cu citirile necesare și permisiune de anulare a PaymentIntent-urilor de test;
- `NITIDO_STRIPE_PLATFORM_ACCOUNT_ID`: identitatea verificată a platformei;
- `NEXT_PUBLIC_SITE_URL=https://sandbox.nitido.ro`;
- `NITIDO_STRIPE_CONNECT_TRANSFERS_ENABLED=false`.

Cheia și secretul schedulerului nu se trec în argumente, URL-uri, repository sau rapoarte. Runnerul trimite secretul numai către aplicația locală, pe `127.0.0.1`, fără redirecturi. Nu folosește sesiunea admin și nu primește evenimente/ID-uri din corpul cererii.

În containerul aplicației, cu variabilele deja injectate:

```bash
node /app/scripts/financial-recovery-runner.mjs
```

După o primă rulare demonstrată, programați aceeași comandă o dată pe minut în schedulerul serviciului de staging. Containerul standalone include runnerul prin Dockerfile. Dacă programarea este făcută pe host, executați comanda în containerul de staging identificat explicit, pentru a folosi mediul acelui container. Nu presupuneți că un cron de host moștenește variabilele aplicației.

Actualizare 13 septembrie 2026: schedulerul este instalat și activ în serviciul Coolify de sandbox, pe candidatul `c211ba84af5f6c279131b6b0b350c4cbf3ab3fe4`. Sarcina `NITIDO sandbox financial recovery`, ID `vw69vmqmqqebr7z2fnnyquin`, execută runnerul la fiecare minut (`* * * * *`), cu timeout exterior de 70 secunde. Containerul este rezolvat de Coolify în serviciul sandbox, fără fixarea numelui unei instanțe temporare.

Prima rulare manuală pe container, la 10:30:32 UTC, și prima rulare automată, la 10:32:02 UTC, sunt `completed`, cu toate cele patru contoare zero. Nu existau restanțe eligibile. Identitatea contului Stripe este verificată de worker înainte de selectarea lotului. Configurația test-only, originea și secretul separat au fost verificate pe container; endpointul fără secret și cu secret invalid a răspuns 401. Istoricul ambelor rulări este persistent în SQLite. Producția păstrează flagul dezactivat. Dovezi de instalare: [NITIDO-STAGING-20260913.md](NITIDO-STAGING-20260913.md).

Aceasta demonstrează instalarea și o rulare periodică reală cu lot gol. Nu demonstrează recuperarea unei operațiuni financiare, concurența sub sarcină sau reluarea unei restanțe după restart; criteriile de acceptare de mai jos rămân deschise.

## Operare din admin

Panoul afișează ultimele 10 rulări și maximum 100 de restanțe care au atins limita automată. Un status `running` mai vechi de rezervarea de 120 secunde este afișat drept neconfirmat, până la următoarea recuperare.

- Notificare nereconciliată: verificați contul și referințele; după corectare, retrimiteți evenimentul din Stripe. Webhookul normal rămâne disponibil chiar dacă retry-ul automat a fost oprit.
- Anulare nereconciliată cu PI cunoscut: verificați identitatea și reluați din acțiunea sandbox existentă în admin.
- PI necunoscut: reconciliere autorizată separată. Nu căutați o asociere doar după sumă sau dată și nu creați alt PI pentru a „repara” vechiul rezultat.
- Rulare cu eroare de cont/configurație: corectați mediul; nu ștergeți cererile sau auditul pentru a obține un rezultat verde.

O reușită prin webhook sau reluare manuală închide resursa locală; workerul o exclude din loturile următoare, chiar dacă păstrează istoricul încercărilor.

## Limite și acceptare rămasă

- Stripe permite recuperarea evenimentelor prin Events API pentru ultimele 30 zile. Un eveniment inaccesibil rămâne nerezolvat și ajunge la intervenție; nu se reconstruiește din payloaduri neverificate. [Documentația Events API](https://docs.stripe.com/api/events/retrieve).
- Sunt procesate restanțele existente în inbox. Evenimentele care nu au ajuns deloc la aplicație și reconcilierea integrală a istoricului necesită inventariere separată. Nu există scanare completă de cont sau reconciliere periodică automată a tuturor payout-urilor.
- Workerul folosește aceeași bază SQLite cu webhookul și ceasul mediului aplicației. Nu oferă coordonare între baze independente. Nu rulați simultan versiuni vechi de procesor care ignoră versiunile resurselor.
- O comandă de anulare deja acceptată de Stripe poate continua după întreruperea conexiunii. Reluarea citește starea actuală și folosește identitatea/idempotency key existentă; nu se afirmă execuție distribuită „exact o dată”.
- Generațiile noi de reautorizare, identificarea automată a intențiilor necunoscute, payout-urile manuale și activarea live rămân deschise.

Pentru PASS în staging: demonstrați un retry după întrerupere, două declanșări simultane, restart cu cerere persistentă, cont greșit respins, recuperarea unui payout și eliberarea unui hold de test; comparați DB, audit, istoric și referințele Stripe pe SHA-ul candidatului. Păstrați testul cu identitate necunoscută ca restanță vizibilă. Aceste probe se adaugă gate-ului `financial_reconciliation`; nu îl închid testele cu provider simulat.

## Migrare și oprire

Trei tabele aditive: `financial_recovery_lock`, `financial_recovery_runs`, `financial_recovery_items`. Nu se rescriu sume și nu se execută backfill financiar. Oprirea programării și setarea flagului la `false` împiedică pornirea unor loturi noi. Un lot deja început poate continua; așteptați încheierea lui și verificați restanțele înainte de rollback. Păstrați tabelele și auditul.

Procesorul comun continuă să verifice semnătura pentru intrarea publică webhook; workerul folosește exclusiv evenimente recuperate autentificat de la Stripe. Retrimiterea automată Stripe poate continua după recuperarea manuală, iar aplicația răspunde cu deduplicare. [Ghidul Stripe pentru evenimente nelivrate](https://docs.stripe.com/webhooks/process-undelivered-events).
