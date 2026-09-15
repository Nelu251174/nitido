# Backup și restaurare NITIDO

Utilitar: scripts/recovery.mjs. Necesită Node și dependențele proiectului instalate, inclusiv better-sqlite3.

## Operare

Operatorul oprește aplicația, workerii și orice alt proces care modifică baza sau fotografiile. Confirmarea --quiesced este obligatorie, dar utilitarul nu poate verifica singur că toți scriitorii sunt opriți. Baza SQLite și fotografiile sunt două resurse distincte; nu se promite consistență dacă scrierile continuă.

Din rădăcina proiectului, operatorul rulează:

```bash
node scripts/recovery.mjs backup /cale/instalatie /cale/backup-nou --quiesced
node scripts/recovery.mjs restore /cale/backup-nou /cale/restaurare-noua
```

Sursa trebuie să conțină data/nitido.db și public/uploads. Destinația nu trebuie să existe și trebuie să fie în afara sursei. Părintele destinației trebuie să existe. Nu sunt incluse parolele, variabilele de mediu sau configurarea Coolify. Acestea necesită gestiune separată.

Backupul SQLite folosește API-ul de snapshot, apoi este convertit la jurnal DELETE pentru a produce un fișier autonom. Fotografiile sunt copiate fără acceptarea legăturilor simbolice. Manifestul include dimensiunea și SHA-256 pentru fiecare fișier. La restaurare se verifică manifestul, integritatea SQLite și cheile străine. O restaurare eșuată curăță numai destinația nou creată. Instalația existentă nu este suprascrisă.

După restaurare, operatorul verifică numărul înregistrărilor, accesul la fotografii și fluxurile aplicației în mediul izolat, adaptează proprietarul/permisiunile la utilizatorul containerului și abia apoi pregătește comutarea controlată a volumelor. Nu conecta copia la procesatoare de plăți sau notificări reale în timpul exercițiului.

SHA-256 detectează coruperea accidentală, nu înlocuiește criptarea, semnarea manifestului sau stocarea off-site cu retenție. Backupul conține date personale și trebuie protejat.

## Dovadă automată

`node --test scripts/recovery.test.mjs` creează date sintetice într-un director temporar, păstrează o relație client–lucrare și o fotografie binară, restaurează și compară rezultatul. Verifică refuzarea backupului fără confirmarea opririi scrierilor, suprascrierii, coruperii și traversării directoarelor. Testele sunt integrate în CI.

Această probă nu confirmă o restaurare efectuată pe Hetzner/Coolify, completitudinea unei copii reale, timpi RPO/RTO, retenția sau accesibilitatea off-site.

## Scalare și verificarea intrărilor

Copierea și calcularea SHA-256 folosesc fluxuri de date, fără încărcarea întregii baze sau fotografii în memorie. Memoria pentru manifest și lista numelor rămâne proporțională cu numărul fișierelor. Manifestul citit la restaurare este limitat la 16 MiB; dimensiunile și hashurile sunt validate înainte de crearea destinației.

Trei probe automate trecute: recuperare SQLite/fotografie, refuzarea traversării directoarelor, fișier de peste 3 MiB procesat în mai multe fragmente și metadate invalide. Acest test nu reprezintă un benchmark de volum real.
