# Backup și restaurare NITIDO

Utilitar: scripts/recovery.mjs. Necesită Node și dependențele proiectului instalate, inclusiv better-sqlite3.

## Operare

Operatorul oprește aplicația, workerii și orice alt proces care modifică baza sau fotografiile. Confirmarea --quiesced este obligatorie, dar utilitarul nu poate verifica singur că toți scriitorii sunt opriți. Baza SQLite și fotografiile sunt două resurse distincte; nu se promite consistență dacă scrierile continuă.

Din rădăcina proiectului, operatorul rulează:

```bash
node scripts/recovery.mjs backup /cale/instalatie /cale/backup-nou --quiesced
node scripts/recovery.mjs restore /cale/backup-nou /cale/restaurare-noua
```

Sursa trebuie să conțină data/nitido.db și public/uploads. Manifestul v2 include și data/uploads (fotografii private Marketplace, context client, dovezi și evaluări) și data/pro-uploads dacă există; păstrează și directoarele goale. Acestea sunt rădăcinile folosite efectiv de API-urile de upload. Nu copiază alte fișiere arbitrare din data/. Restaurarea rămâne compatibilă cu arhivele v1, care conțin numai baza și public/uploads, fără să rescrie arhiva veche.

Destinația nu trebuie să existe și trebuie să fie în afara sursei. Părintele destinației trebuie să existe. Nu sunt incluse parolele, variabilele de mediu sau configurarea Coolify. Acestea necesită gestiune separată. Scriptul este inclus în imaginea Docker la /app/scripts/recovery.mjs și poate rula într-un helper separat, fără server, cronuri sau servicii externe, cu volumele observate montate la rădăcina sursei.

DB-ul oprit și jurnalele WAL/journal sunt copiate într-un staging privat; SQLite deschide numai această copie, ca să nu creeze fișiere WAL/SHM lângă sursă. API-ul de snapshot produce apoi baza autonomă cu jurnal DELETE, iar stagingul este eliminat. Sunt refuzate legăturile simbolice din rădăcinile data/public, directoarele și fișierele încărcate, baza SQLite și fișierele ei auxiliare WAL/SHM/journal. Manifestul include dimensiunea și SHA-256 pentru fiecare fișier și enumeră rădăcinile foto prezente. La restaurare se verifică manifestul, integritatea SQLite și cheile străine. O restaurare eșuată curăță numai destinația nou creată. Instalația existentă nu este suprascrisă.

După restaurare, operatorul verifică numărul înregistrărilor, accesul la fotografii și fluxurile aplicației în mediul izolat, adaptează proprietarul/permisiunile la utilizatorul containerului și abia apoi pregătește comutarea controlată a volumelor. Nu conecta copia la procesatoare de plăți sau notificări reale în timpul exercițiului.

SHA-256 detectează coruperea accidentală, nu înlocuiește criptarea, semnarea manifestului sau stocarea off-site cu retenție. Backupul conține date personale și trebuie protejat.

## Dovadă automată

`node --test scripts/recovery.test.mjs` creează date sintetice într-un director temporar, păstrează o relație client–lucrare și o fotografie binară, restaurează și compară rezultatul. Verifică refuzarea backupului fără confirmarea opririi scrierilor, suprascrierii, coruperii și traversării directoarelor. Testele sunt integrate în CI.

Cele șapte teste de recuperare includ toate cele trei rădăcini, bytes identici, sursă WAL nemodificată inclusiv rânduri comise în jurnal, manifest v1, directoare goale, coruperea unui fișier Pro, rădăcini/private/WAL simbolice, traversare, rădăcini nedeclarate, suprascriere și curățarea destinației noi la eșec. Rularea explicită în mediul Node curent este:

```bash
node --test --test-isolation=none scripts/recovery.test.mjs scripts/release-preparation.test.mjs
```

Această probă nu confirmă o restaurare efectuată pe Hetzner/Coolify, completitudinea unei copii reale, timpi RPO/RTO, retenția sau accesibilitatea off-site. Pregătirea executabilă și simulatorul sunt documentate în upgrade/RELEASE-PREPARATION.md.

## Scalare și verificarea intrărilor

Copierea și calcularea SHA-256 folosesc fluxuri de date, fără încărcarea întregii baze sau fotografii în memorie. Memoria pentru manifest și lista numelor rămâne proporțională cu numărul fișierelor. Manifestul citit la restaurare este limitat la 16 MiB; dimensiunile și hashurile sunt validate înainte de crearea destinației.

Proba de copiere în flux restaurează un fișier de peste 3 MiB procesat în mai multe fragmente și refuză metadate invalide. Aceasta nu reprezintă un benchmark de volum real.
