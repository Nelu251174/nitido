# Inițierea ștergerii contului — web și API

Acest pachet implementează inițierea autentificată și preluarea internă a unei cereri. **Nu implementează executorul de ștergere și nu demonstrează conformitatea completă App Store/Google Play.** Nu s-au șters conturi sau date reale și nu s-a definit un termen de procesare/păstrare nou.

## Acces și contract

Pagina `/stergere-cont` este accesibilă extern fără autentificare, cu metadata noindex și explicația procesului. Formularul cere autentificare în contul vizat și o confirmare explicită. Legătura este în profilurile clientului și prestatorului; returnarea din login păstrează această pagină pentru ambele roluri. Nu trebuie adăugată în sitemap pentru a putea fi indicată drept URL extern în Google Play; răspunsul instalat trebuie totuși verificat înainte de înscrierea URL-ului.

- `GET /api/account/deletion`: sesiune user validă; întoarce numai cererea proprie sau null. Nu întoarce email, nume, userId sau note interne.
- `POST /api/account/deletion`: corp exact `{ "confirmation": "DELETE_ACCOUNT" }`; actorul este titularul autentificat. Creează o singură cerere per cont; repetarea întoarce cererea existentă fără duplicarea auditului. HTTP 201 la creare, 200 la replay, 401 autentificare, 403 origine, 400 confirmare, 413 corp prea mare, 429 limită.
- Cookie: Origin obligatoriu și validat prin originul cererii sau originul public HTTPS configurat. Nu sunt folosite forwarded headers. Mobile: un Bearer validat de `getCurrentUser(req)` și `NITIDO_ENABLE_BEARER_AUTH=true` poate înlocui protecția cookie-origin; un header transmis nu înlocuiește autentificarea.
- Limite tehnice: maximum 2.048 bytes citite din streamul cererii, inclusiv fără Content-Length; 5 inițieri/minut și 60 citiri/minut per cont. Răspunsurile sunt `private, no-store`, cu Vary Cookie/Authorization.

Expo folosește același endpoint; integrarea lui, buildul și validarea pe dispozitive se consemnează în pachetul mobil separat. Trimiterea cererii nu face logout, nu revocă sesiuni și nu anulează lucrări sau plăți.

## Registru intern și audit

Schema leaf `ACCOUNT_DELETION_SCHEMA` adaugă `account_deletion_requests` și `account_deletion_events`. Cererile și evenimentele sunt imuabile. Crearea cererii, primul eveniment și auditul `account.deletion_requested` sunt în aceeași tranzacție immediate; un eșec nu lasă o cerere acceptată fără audit.

Registrul este vizibil în workspace-urile Operator/Manager/Super Admin, prin `GET /api/admin/account-deletion`. Financiar și conturile client/prestator nu au acces. Pagini de 50 cu total și hasMore; nume/email/rol/userId curente pentru identificarea contului, fără date de plată, adresă, parolă sau documente private.

`POST /api/admin/account-deletion` primește id, revision și reason. Cere sesiune nominală cu drept operations, Origin valid, maximum 12.000 bytes și 20 operațiuni/minut. Nu acceptă override Bearer pentru sesiunea administrativă. Tranziția disponibilă este numai `requested → under_review`, cu audit atomic `account.deletion_review_started`. Autorul real vine din sesiune, nu din corp. Replay-ul aceleiași comenzi aparține aceluiași actor/motiv; altă preluare concurentă primește conflict. Preluarea nu poate produce status `deleted` sau confirma îndeplinirea cererii.

## Limite de operare și acceptanță

Pentru îndeplinire sunt încă necesare procedura aprobată și un proces verificabil de identificare a datelor, tratare a lucrărilor/obligațiilor/organizațiilor comune, ștergere ori anonimizare, excepții legale de păstrare și notificarea rezultatului. Nu există automatizare de executare sau de notificare în acest pachet. Registrul nu trebuie prezentat drept cont șters.

Schema are FK către users și interzice ștergerea directă a propriului jurnal. Viitorul executor trebuie să trateze explicit păstrarea/pseudonimizarea dovezii cererii și referințele la cont, cu politică și migrare compatibile; un DELETE simplu al users nu constituie pipeline aprobat. Nu se ocolește protecția prin DROP/triggers dezactivate pe date reale.

Testele pe SQLite real acoperă cont client/prestator, izolare, replay, neschimbarea users/sessions/payments, rollback la eșec audit, istoric imuabil, preluare nominală și conflict, paginare completă, confirmare, origine cookie/Bearer, stream fără Content-Length și rate limit. Verificarea browser, migrarea infrastructurii, URL-ul extern instalat și executarea finală rămân probe separate.

Rollback-ul de cod păstrează aceste tabele/audituri aditive și datele conturilor. Un rollback nu înseamnă că solicitările deja primite au fost îndeplinite; echipa trebuie să păstreze registrul disponibil procesării autorizate.
