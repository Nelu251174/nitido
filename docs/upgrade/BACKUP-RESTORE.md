# Backup complet și restaurare izolată NITIDO

Runbook pentru agentul care operează infrastructura autorizată. Utilizatorului nu îi sunt transferate comenzile tehnice. Publicarea este autorizată cu backup și posibilitate de revenire; această pagină distinge instrumentele și probele locale de operațiile efectuate pe host.

## Instrumentul complet — manifest v2

`scripts/recovery.mjs`, inclus în imaginea Docker la `/app/scripts/recovery.mjs`, acoperă DB `data/nitido.db` și rădăcinile folosite de aplicație:

| Rădăcină | Conținut și condiție |
|---|---|
| `public/uploads` | Uploaduri existente; rădăcina este obligatorie |
| `data/uploads` | Fotografii private Marketplace, dovezi/context/evaluări; inclusă dacă există |
| `data/pro-uploads` | Fișiere private Pro; inclusă dacă există |

Manifestul v2 declară rădăcinile prezente și păstrează inclusiv directoarele goale. Restaurarea acceptă în continuare arhive v1, care au numai DB și `public/uploads`; nu le rescrie și nu pretinde că ele conțin fotografiile private lipsă. Agentul verifică înaintea backupului dacă toate rădăcinile folosite pe țintă sunt inventariate; absența unui director nu este tratată automat drept dovadă că nu au existat fișiere.

Operațiile agentului sunt `backup(source,destination,{quiesced:true})` și `restore(source,destination)`, disponibile și prin CLI-ul instrumentului. Sursa, volumele și destinațiile provin din inventarul efectiv al hostului, nu din presupuneri sau nume istorice. Destinația este un director nou, în afara sursei, cu părinte existent și protejat. Restaurarea nu suprascrie instalația activă.

`quiesced`/`--quiesced` este confirmarea agentului că a oprit aplicația, workerii, cronurile și orice alt scriitor. Scriptul nu poate verifica singur oprirea lor. O copie SQLite online nu îngheață uploadurile; consistența dintre DB și fotografii cere o fereastră fără scrieri.

Snapshotul SQLite folosește API-ul de backup, include rândurile confirmate din WAL și este convertit la jurnal DELETE pentru un fișier autonom. Sunt verificate `integrity_check` și `foreign_key_check`. Copierea și SHA-256 sunt în flux; manifestul include dimensiunea și hashul fiecărui fișier. Citirea manifestului este limitată la 16 MiB. Sunt refuzate traversarea căilor, fișierele speciale, symlinkurile în rădăcini/fișiere/DB și fișiere auxiliare WAL/SHM/journal, rădăcinile nepermise, fișierele neinventariate și destinațiile existente. Fișierele au mod 0600, rădăcina nouă 0700. La eșec se curăță numai destinația nou creată.

Secretul de criptare Pro, celelalte secrete, variabilele și configurația Coolify se păstrează separat prin gestionarea securizată a infrastructurii. Nu se comit în Git și nu se includ în arhiva publicată. SHA-256 detectează coruperea accidentală, fără a înlocui criptarea, semnarea manifestului, retenția sau copia off-site.

## Verificare suplimentară numai pentru DB

`scripts/verify-database-backup.mjs` rămâne disponibil, inclus în imaginea Docker. Deschide sursa read-only cu `fileMustExist`, produce `snapshot.db` și un `restored.db` separat într-un director nou, apoi verifică integritatea/FK, egalitatea schemei, numărul de rânduri pe fiecare tabelă și hashurile. Numai după toate verificările scrie `verification.json` cu `status: passed`; raportul nu conține rânduri personale sau valori de secrete.

Un PASS al acestui instrument certifică numai copia SQLite. Nu înlocuiește backupul v2 al celor trei rădăcini și nu certifică fotografiile, secretul Pro, Stripe, cronurile sau compatibilitatea aplicației după restaurare.

## Ordinea operării pe infrastructura țintă

1. Agentul identifică aplicația Coolify, imaginea/SHA-ul instalat, baza activă, volumele, rădăcinile și toți scriitorii. Confirmă spațiul persistent protejat pentru backup și posibilitatea de revenire, fără afișarea secretelor. Reperele istorice din `RELEASE-PREPARATION.md` nu sunt inventar actual.
2. Oprește scriitorii și generează backupul complet v2 într-un helper fără server, cronuri sau integrări externe, cu volumele observate montate la rădăcina sursei. Păstrează logul, ora, manifestul și durata. Orice eroare de integritate/FK/hash oprește promovarea; verificările nu sunt eliminate pentru a obține PASS.
3. Restaurează arhiva într-un spațiu nou izolat; verifică schema, totalurile, bytes și accesul autorizat la fotografii pentru rolurile relevante. Adaptează permisiunile numai pentru utilizatorul containerului țintă. Nu conectează copia la plăți/notificări reale.
4. Verifică schema Pro reală. Dacă este P0/legacy, refuzul migrării v1.1 nu este ocolit cu DROP sau cu versiuni artificiale; se analizează datele efective înaintea oricărei migrări. Pentru v1.1 recunoscut, execută întâi migrarea pe copia izolată până la revizia 14 și verifică păstrarea snapshoturilor, lucrărilor, aprobărilor și regulilor.
5. Verifică aplicația candidată și compatibilitatea revenirii la imaginea anterioară cu stările efective. După migrarea și publicarea autorizată, repornește scriitorii în mod controlat și consemnează acceptanța funcțională. Starea este „backup/restaurare pe host verificate” numai când există aceste probe ale țintei.

## Rollback fără pierderea datelor noi

Revenirea obișnuită folosește imaginea anterioară compatibilă și păstrează DB și toate fișierele curente, inclusiv jurnalele aditive SLA/pregătire operațională și migrarea Pro 14. Nu rulează DROP. Nu presupune că orice SHA vechi poate citi toate stările sau frecvențele create ulterior. Extensia zilnică are protecții pentru schedulerul anterior; acestea nu reprezintă certificarea oricărei imagini vechi.

SLA se oprește prin dezactivarea `NITIDO_INCIDENT_SLA_ALERTS_ENABLED` și a schedulerului dedicat, păstrând alertele și auditul. Cronurile și integrările existente se inventariază și se operează separat; nu sunt presupuse oprite de acest flag.

Dacă este necesară restaurarea datelor, agentul oprește scriitorii, păstrează mai întâi starea curentă, restaurează într-un director nou și reconciliază scrierile și uploadurile ulterioare. Nu înlocuiește datele acceptate după publicare cu o copie veche. Orice operație care ar șterge date reale necesită acordul separat prevăzut de mandat.

## Probe locale executate și limite

Simulatorul `scripts/release-preparation.mjs` a fost executat în `/workspace/nitido-release-simulation-20261009`; `simulation-report.json` este `passed`, cu `remoteCalls=0`. A verificat arhivă v2/restaurare pentru toate cele trei rădăcini sintetice, amprente identice ale tabelelor și fișierelor, migrare Pro 12→13→14 idempotentă, snapshoturi păstrate și sursă nemodificată. Un rând și un upload Pro adăugate după migrare sunt păstrate în restaurarea izolată a stării curente. Backupul inițial nu suprascrie starea nouă.

Raportul folosește SHA-ul de plan `97938ad4f58f7d5a890cae0c1cc7dbd00dceec0f`, cu instrumente modificate local în lucru. Nu dovedește identitatea fișierelor cu un commit final. Planurile separate sandbox/producție au `observedCurrentState=null` și `readyForDeployment=false`. Cele opt teste automate de recuperare/pregătire trecute sunt descrise în `RELEASE-PREPARATION.md`; testele DB și browser se consemnează separat. Aceste probe nu sunt backup sau restaurare a datelor reale, acceptanță Coolify, măsurare RPO/RTO, verificare de retenție/off-site ori publicare.

Accesul actual la Coolify este blocat: ultima încercare efectivă a returnat `CONNECT 403` înainte de autentificare, politica rețelei rămâne restricționată și nu există token/sesiune sau secrete runtime configurate. Nu s-au executat în această sesiune backup, restaurare, migrare sau comutare a volumelor reale. După conectarea/autorizarea securizată, agentul execută operațiile de mai sus și raportează separat rezultatele sandbox/LIVE.
