# Publicare NITIDO — pregătire executabilă și restaurare completă

Autorizarea utilizatorului pentru publicare cu backup și rollback există în conversația curentă. Blocajul actual este accesul tehnic, nu o nouă cerere de aprobare. Revalidarea mediului a returnat observații actuale, revizia 5, politică HTTP restricționată aplicată, numai ANAF ca domeniu particular, zero secrete/variabile/identități configurate. Nu există instrument Coolify ori workflow de configurare a acestui mediu expus agentului. Nu au fost făcute apeluri noi către host după acest rezultat și nu s-a declanșat webhookul generic.

## Instrumentul offline

`scripts/release-preparation.mjs` nu are comandă de deploy și nu contactează servicii. Produce planuri dry-run separate pentru aplicațiile istorice:

| Mediu | Aplicație Coolify de reconfirmat | Volume |
|---|---|---|
| Sandbox | `civaeb8joydtchvzlen6pivq`, `sandbox.nitido.ro` | Necunoscute în sesiunea actuală; trebuie citite efectiv înainte de operare. Nu se folosește Compose-ul de producție |
| Producție | `zxnelxi2cejranyvfpw0scac`, `nitido.ro` | `zxnelxi2cejranyvfpw0scac_nitido-data`, `zxnelxi2cejranyvfpw0scac_nitido-uploads`, conform Compose; de reconfirmat pe host |

UUID-urile și SHA-urile istorice sunt explicit marcate ca neverificate. `observedCurrentState=null` și `readyForDeployment=false` nu pot deveni o dovadă a instalării. Un SHA de plan nu dovedește că acesta este publicat sau că fișierele locale sunt identice cu acel commit.

```bash
node scripts/release-preparation.mjs plan sandbox SHA_COMPLET_40_CARACTERE
node scripts/release-preparation.mjs plan production SHA_COMPLET_40_CARACTERE
node scripts/release-preparation.mjs simulate /director/nou-exclusiv SHA_COMPLET_40_CARACTERE
```

Planurile precizează identificarea aplicației/sursei/imaginii/volumelor, oprirea tuturor scriitorilor, backup complet în director protejat nou, restaurare izolată, migrare mai întâi pe copie, migrare reală numai după verificări, instalare exclusiv în aplicația identificată, validare și repornirea scriitorilor existenți. Comenzile sunt argumente structurate; nu includ credențiale. Folosesc un helper fără server sau cronuri, cu volumele confirmate montate la `/snapshot` și un director persistent separat `/release-backups`. Aceste montări trebuie realizate prin canalul autorizat al hostului, după acces; scriptul offline nu le realizează și nu poate confirma oprirea scriitorilor.

## Backup și rollback

`recovery.mjs` folosește manifest v2 pentru DB + `public/uploads`, `data/uploads` și `data/pro-uploads`, verifică bytes/hashuri/integritate/FK și restaurează exclusiv într-un director nou. Manifestele vechi v1 rămân restaurabile și neschimbate. Secretul de criptare Pro și configurația runtime se păstrează separat în gestionarea securizată a infrastructurii; nu sunt copiate în arhivă sau în Git.

Rollback-ul normal revine la imaginea anterioară compatibilă, păstrând baza și toate fișierele actuale. Nu rulează DROP și nu înlocuiește datele acceptate după publicare cu un backup vechi. Dacă este necesară restaurarea de date, se opresc scriitorii, se păstrează mai întâi starea curentă, se restaurează într-un spațiu nou și se reconciliază scrierile ulterioare înainte de comutare. Compatibilitatea imaginii vechi cu stările efective trebuie verificată; simulatorul nu pretinde această probă.

## Probe locale executate

Simulatorul a trecut în `/workspace/nitido-release-simulation-20261009`, cu SHA-ul de plan `97938ad4f58f7d5a890cae0c1cc7dbd00dceec0f` și conținutul local al instrumentelor în lucru. `simulation-report.json` consemnează:

- Arhivă v2 și restaurare a celor trei rădăcini, cu amprente identice ale fiecărui tabel și fișier sintetic.
- Migrare de la Pro 12 la 13/14, repetată idempotent; rândurile Marketplace/Pro și snapshotul lucrării rămân identice; sursa nu este modificată.
- Un rând și un fișier Pro adăugate după migrare supraviețuiesc unei restaurări izolate a stării curente, fără suprascrierea ei cu arhiva inițială.
- Zero apeluri remote. Dry-run-urile sandbox/producție sunt separate și încă blocate fără dovezi actuale de infrastructură.

Nouă teste automate de recuperare și pregătire au trecut: includ corupere, suprascriere, traversare, symlinkuri, arhivă v1, sursă WAL neschimbată, refuzul țintelor/SHA-urilor ambigue și păstrarea datelor noi la rollback. Scripturile sunt incluse în imaginea Docker; verificarea imaginii locale finale este descrisă mai jos.

SQLite poate crea fișiere `-wal`/`-shm` chiar când deschide sursa read-only. Instrumentul copiază întâi DB-ul oprit și jurnalele sale într-un staging privat și rulează API-ul de backup numai pe această copie. Stagingul este eliminat și nu ajunge în manifest. Proba verifică atât DB WAL checkpointată/închisă, cât și rânduri comise aflate încă în WAL: bytes și lista fișierelor sursei rămân identice.

Prima construcție Docker locală s-a oprit la instalarea dependențelor. Diagnosticul separat a confirmat `SELF_SIGNED_CERT_IN_CHAIN` la `npm ping` fără CA-ul proxy-ului și succes cu CA-ul montat read-only. Dockerfile-ul acceptă acum secretul BuildKit opțional `proxy_ca` numai la `npm ci`; păstrează verificarea TLS și nu copiază certificatul în imagine. Construcțiile Coolify care nu folosesc acest proxy nu au nevoie de secret. În mediul administrat se transmite `--secret id=proxy_ca,src="$CODEX_PROXY_CERT"`, păstrând configurația și credențialele Docker existente.

Reluarea a trecut instalarea dependențelor și TypeScript, apoi a identificat o cursă la inițializarea DB într-o construcție curată: `UNIQUE constraint failed: estimator_options.key` la colectarea paginilor cu patru procese. Corecția verifică tabelul gol și inserează opțiunile într-o tranzacție `immediate`, păstrând setările existente. Construcția ulterioară Turbopack a trecut TypeScript și 148 pagini.

Imaginea intermediară `sha256:98c0840b6966190041da172621c15a98489f1c651925a92e5200b31648e217c2` conținea helper-ele, schema Pro compilată și ambele fonturi OG. Simulatorul a trecut în container efemer fără rețea și fără volume ale hostului; raportul și planurile sunt în `/workspace/nitido-docker-release-evidence-20261009`. Proba serverului nonroot a găsit un al doilea defect de ambalare: `EACCES` la `/app/public/design-v2`, deoarece directoarele restrictive erau copiate fără ownership-ul utilizatorului runtime. `COPY public` folosește acum `--chown=nextjs:nodejs`, fără lărgirea permisiunilor. Proba imaginii locale finale, după ultimele corecții de produs și ambalare, este descrisă mai jos.

## Imaginea locală finală verificată

După ultima corecție responsive din catalog, construcția curată Turbopack a trecut TypeScript și toate cele 148 pagini. Imaginea locală `nitido:release-preparation-verified` are ID-ul `sha256:9e9aac72b38731c8c9db8a5473506a0cfbba99b6829842ecf50d9abaf794a74c`. ID-ul este al imaginii locale; nu este un digest publicat într-un registru și nu reprezintă un SHA instalat pe Coolify.

- Runtime Node `v22.23.3`, utilizator `1001`, SQLite nativ funcțional.
- Ambele helper-e, schema Pro compilată și cele două fonturi WOFF Inter sunt prezente și citibile.
- Serverul pornește nonroot; `GET /opengraph-image` întoarce HTTP 200, `image/png`, semnătură PNG validă, 1200×630, 40079 bytes.
- Simulatorul executat din această imagine trece backupul/restaurarea tuturor celor trei rădăcini, migrarea 12→13/14 repetată idempotent, amprentele rândurilor și snapshotului lucrării neschimbate, sursa nemodificată și păstrarea rândului/fișierului Pro adăugate ulterior.
- Toate containerele de probă folosesc `--network none`, fără volume sau date de pe hostul NITIDO. Nu a fost pornit niciun cron și nu au fost efectuate plăți sau mesaje externe.

Dovezile finale sunt în `/workspace/nitido-docker-release-verified-evidence-20261009`: raport runtime, raport simulator, planuri sandbox/producție, ID imagine și log de build. Cele nouă teste ale helper-elor au trecut atât în mediul Node 24, cât și sub Node 22 nonroot în imaginea anterioară; helper-ele au rămas identice la ultimul build CSS. Logul Node 22 este păstrat separat și copiat în directorul de dovezi. Un eșec inițial al harness-ului a provenit din ownership-ul fișierelor de test copiate în container și a fost corectat numai în containerul efemer.

Construcțiile succesive au consumat spațiul Docker local VFS. Au fost curățate exclusiv imaginile și ID-urile cache-urilor generate de această QA, fără `docker system prune`, fără ștergerea volumelor/datelor și păstrând imaginea verificată și toate rapoartele. Nu este un incident al infrastructurii LIVE.

Imaginea folosește URL-ul sandbox și o cheie publică Stripe sintetică numai pentru QA. Publicarea reală trebuie să construiască sursa confirmată cu valorile publice și configurația existente ale mediului țintă, după acces și reconfirmarea aplicației/volumelor. Starea reală a hostului, backupul real și compatibilitatea imaginii anterioare la rollback rămân de verificat prin canalul autentificat.

Aceste probe verifică instrumentele locale. Nu confirmă backupul bazei reale, volumele reale, deploy sandbox/LIVE, cronurile, plățile sau integrarea în `main`.
