# Consolidare sezon 2027 — 22 octombrie 2026

## Lot executat

Cardurile NEW folosesc acum catalogul lingvistic al cererii, inclusiv titlurile, descrierile și acțiunea. Au fost completate 36 de mesaje noi pentru fiecare dintre cele opt limbi traduse existente, plus sursa română; acoperirea verificată este de 39 de mesaje selectate. Nu s-au adăugat limbi noi și nu se declară tradusă integral platforma. Proprietățile, adresele, numele și linkurile nu sunt traduse.

Datele din programările firmei, planificare, pregătirea pentru oaspeți și dosare folosesc limba selectată, păstrând fusul Europe/Bucharest. Numele lunilor din planul anual respectă aceeași alegere. Testul din schimbarea orei de vară confirmă ora României chiar dacă afișarea engleză folosește un ceas de 12 ore.

## Dovezi

- Suită completă: 2.130 teste, 209 fișiere, trecute în 95,91 secunde.
- TypeScript, ESLint pentru fișierele schimbate, validarea cataloagelor și verificarea paginii offline: trecute.
- Teste Node ale validatorului și ale restaurării: trecute pe date sintetice.
- Scenariu sintetic de volum: 10.000 de programări, loturi de cel mult 500, fără omisiuni, dubluri, plăți sau notificări; numai staging în memorie. În rularea înregistrată: p95 lot 39,52 ms, maxim 40,06 ms, total 687,46 ms. Aceste valori nu stabilesc capacitatea serverului LIVE, traficul HTTP ori debitul furnizorilor de notificare.
- Backup LIVE verificat înainte de lot: execuție sxuzjvd9g2rgrsyoks0sktxj, succes la 10:38:07 UTC; snapshot SQLite online, uploaduri verificate prin hash și restaurare izolată. Sursa de revenire: 4de961e10188cf472e7b53ddc64acce67cae29de.

## Blocaje concrete și lucrări rămase

- FCM/APNs nu sunt configurate în aplicația LIVE; nu se activează push doar printr-un flag. Configurațiile de magazin/semnare nu substituie cheile furnizorilor push.
- Browserul conectat, CUA și dispozitivele fizice nu sunt disponibile în uneltele sesiunii. Testele vizuale/tactile și recepția notificărilor rămân NETESTATE.
- Coolify raportează zero destinații S3; aplicația nu are configurări de backup extern. Backupul pe volumul aplicației rămâne verificat, dar nu este protecție împotriva pierderii serverului. Pentru execuția externă sunt necesare o destinație existentă și politica de acces/retenție; nu s-a creat un abonament nou.
- Traducerile celorlalte texte noi și revizia lingvistică umană rămân deschise; acest lot închide doar aria descrisă mai sus.
- Scalarea completă necesită teste separate pentru livrarea externă, trafic HTTP și recuperare, apoi un pilot cu firme reale. Nu au fost inventate disponibilități sau testimoniale.

## Suplimente: decizia comercială pregătită pentru lotul următor

Se propune o lucrare suplimentară distinctă, legată de original. Firma descrie diferența de scop și suma; clientul verifică suma totală, programul și condițiile și aprobă explicit. Simpla propunere sau aprobarea scopului nu înseamnă card autorizat, plată efectuată ori începerea lucrării. Lucrarea originală își păstrează suma, HOLD-ul și finalizarea. Refuzul sau expirarea propunerii nu o anulează.

Implementarea trebuie să separe: propunere, ofertă verificată comercial, acordul clientului, rezervare suplimentară, acceptare cu HOLD propriu și finalizare validă cu capturare proprie. Nu se reutilizează creditul, autorizarea sau dovada de finalizare a originalului. Reevaluarea prețului, dublă apăsare, anularea originalului între pași, firmă schimbată/suspendată, conflict de program și răspunsuri financiare incerte trebuie testate înainte de activare.

Acest mecanism executabil nu este inclus în lotul de traduceri. Existența dosarului de scop diferit nu este prezentată ca implementarea plății unui supliment. Nu s-au modificat integrarea Stripe, tarifele, comisionul sau comenzile acceptate.

## Publicare și revenire

Publicarea folosește infrastructura existentă și aceeași sursă care trece buildul. După instalare se verifică HTTP/SSR, cataloagele efectiv livrate pentru toate cele nouă limbi, accesul privat, tarifele și sănătatea. Revenirea repune sursa anterioară; nu necesită restaurarea datelor și nu reexecută mesaje/plăți. Dovezile deploymentului și probele LIVE sunt consemnate în raportul separat.
