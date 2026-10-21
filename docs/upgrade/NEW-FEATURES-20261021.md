# NÍTIDO — patru funcții noi, 21 octombrie 2026

Mandat: implementarea celor patru idei cerute de proprietar, cu intrări marcate NEW, pe infrastructura existentă. Verificarea pe telefon a rezervării, evaluării și „Locuințele mele” a fost confirmată de proprietar; nu reprezintă o verificare vizuală a acestor funcții noi.

## Comportament livrat

1. `/pentru-cei-dragi`: rezervare obișnuită cu beneficiar opțional și consimțământ explicit. Plătitorul creează și transmite personal un link privat; nu se trimit invitații automate. Beneficiarul acceptă în `/client/beneficiar`, cu email identic și confirmat. Proiecția dedicată include ora României, localitatea, starea și firma. Plățile, adresa completă, fotografiile, raportul, anularea și evaluarea rămân în fluxul proprietarului rezervării. Invitația expiră după șapte zile; rotația sau revocarea retrag accesul anterior.
2. `/intervale-libere`: căutare după localitate, spațiu, suprafață, băi și geamuri. Firmele propun intervale pozitive pentru propriile echipe în `/firma/intervale-libere`; administratorul verifică și aprobă din `/admin/azi`. Prima aprobare stabilește singura localitate a pilotului. Calendarul, acoperirea, catalogul, durata și deplasarea se verifică la afișare, solicitare, candidatură și confirmare. Solicitarea nu este o rezervare confirmată. Firma trimite candidatura Standard și clientul o alege, păstrând regula curentă de confirmare/HOLD cu 48 de ore înainte. Confirmarea rezervă capacitatea în aceeași tranzacție SQLite; eroarea autorizării eliberează numai alocarea proprie. Nicio disponibilitate reală nu a fost inventată sau aprobată de agent.
3. `/client/descrie-prin-poze`: maximum cinci poze proprii, acord explicit înainte de analiza OpenAI, redimensionare și eliminarea metadatelor. Nu se includ datele contului sau adresa completată în formular; clientului i se cere să evite date personale în imagini. Răspuns structurat, validat, cu descriere editabilă de maximum 500 caractere și cerințe speciale de confirmat. Confirmarea creează numai o ciornă privată, valabilă 24 de ore. Publicarea se face separat în rezervarea obișnuită. AI indisponibil → completare manuală explicită. Rezultatele și cererile repetate se deduplichează; maximum opt analize pe oră per client. Testele furnizorului folosesc răspunsuri simulate, fără apel AI real pe producție.
4. `/admin/azi`: semnale calculate din datele reale: cereri fără candidaturi de peste două ore, programări apropiate/depasite fără firmă, lipsa echipei active, sosiri neconfirmate, dosare deschise și notificări SMS marcate eșuate. Ordine de urgență și următorul pas. Drepturile sunt verificate pe server. Nu execută automat mesaje, anulări sau operațiuni financiare.

Intrările NEW pentru clienți apar pe homepage și în navigarea contului; firmele au intrarea de intervale; administratorii au „Atenție azi”. Configurația comercială, comisionul și integrarea Stripe nu se modifică. Tabelele sunt aditive; datele comenzilor existente nu se migrează.

## Validare și limite

- Teste SQLite și rute reale cu conturi/date sintetice: proprietate, verificarea emailului, expirare/revocare/rotație, permisiuni, pilot închis, durată/deplasare, interval retras, concurență, compensare după autorizare refuzată, ciornă foto și publicare atomică.
- Teste DOM: butoane și legături NEW, rezultate goale oneste, confirmare explicită, blocarea cererilor repetate și lipsa succesului înaintea confirmării serverului.
- Testele de autorizare financiară folosesc simulări. Nicio plată, rezervare sau notificare reală nu este creată pentru demonstrație.
- Verificarea funcțiilor noi pe telefon fizic și într-un browser conectat nu este declarată efectuată. Uneltele browserului nu sunt disponibile în sesiune.
- Nu s-au publicat binare noi în magazine. Aplicațiile existente folosesc site-ul live; acceptanța nativă a noilor fluxuri rămâne separată.
- Pilotul real de disponibilitate necesită primul interval publicat de o firmă și verificarea operațională explicită. Agentul nu contactează firme și nu aprobă intervale fictive.
- Verificarea automată a AI acoperă contractul și erorile cu un furnizor simulat. Calitatea răspunsului la fotografii reale nu este încă validată.

## Backup și revenire

Checkpoint separat pe fiecare volum: `/app/data/release-checkpoints/20261021-before-new-features`. Scripturi imuabile în branchul `codex/live-v2-checkpoint-20261020`: `cp9.cjs`, `sbcp9.cjs`, `rv9.cjs`, commit `933b811fa8747844bfa794d56381cd23ede145db`. Taskurile sunt manuale și rămân dezactivate.

Backup: SQLite online, inventar și hashuri pentru fișiere, verificare integrity/foreign-key și restaurare într-o copie izolată. Protecția se află pe volumul persistent; nu este un backup extern pentru pierderea întregului server.

Revenire preferată: repin LIVE la `c651f20c58ffd735522944b4a152cc7f56ae73f7` și redeploy; păstrează tabelele aditive și datele noi pentru reconciliere. Revenire sandbox la `747d099a5943b0477d008f0635baa63d27902d83` și branchul anterior `codex/flexible-report-20261021`. Nu se restaurează automat baza peste tranzacții comerciale apărute între timp. În caz de corupere, oprește scrierile, salvează starea curentă, compară cu checkpointul și planifică restaurarea/reconcilierea autorizată. Nu relansa capturi, transferuri sau notificări ca parte a revenirii.
