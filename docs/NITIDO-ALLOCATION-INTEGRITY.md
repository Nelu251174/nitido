# E2 — rezervarea firmei și selecția Standard

Sursa: brief master §08 și §15. Baza acestei continuări: `e17f7143fdad207028d3000286cc3be176a2fdea`.

## Problema corectată

Acceptarea verifica eligibilitatea și suprapunerile înainte de tranzacția care schimba lucrarea în `accepted`. Lipsa unui `await` proteja ordinea într-un singur proces JavaScript, dar nu împiedica alt proces/conexiune SQLite să ocupe același interval între verificare și rezervare. Calculul suprapunerilor folosea suprafața și formula curentă, în locul duratei și bufferului deja salvate pe lucrare.

Selecția Standard citea oferta înainte de rezervare. Retragerea putea interveni între citire și rezervare sau în timpul autorizării. După răspunsul plății, oferta aleasă și ofertele respinse erau actualizate prin două scrieri separate.

## Comportamentul implementat

- Eligibilitatea firmei, zona, starea lucrării, disponibilitatea și înregistrarea tokenului de acceptare sunt verificate/salvate în aceeași tranzacție `BEGIN IMMEDIATE`. O altă conexiune nu poate scrie între citirea disponibilității și rezervare.
- Intervalul ocupat este `[scheduled_at, scheduled_at + duration_minutes + buffer_minutes)`. Se folosesc valorile persistente; intervalele adiacente sunt permise. Duratele/bufferele nevalide sunt refuzate.
- Lucrările `accepted` și `arrived` ocupă capacitate. O lucrare veche ASAP fără timestamp poate fi prima preluare, dar intervalul său necunoscut nu permite o a doua preluare concurentă. Planificările active incomplete blochează conservator o preluare nouă la aceeași firmă.
- Apelul de autorizare este executat după commit, fără tranzacție SQLite deschisă. Tokenul acceptării continuă să protejeze compensarea și confirmarea împotriva unui răspuns întârziat care aparține unei acceptări vechi.
- Crearea/reactivarea ofertei Standard este tranzacțională și verifică disponibilitatea. Oferta nu rezervă capacitate; selecția clientului o reverifică în tranzacția de rezervare, împreună cu proprietarul, modul și oferta încă `pending`.
- Retragerea este permisă numai dacă oferta este `pending` și lucrarea încă `waiting`. După începerea preluării se cere reîncărcarea stării; nu se transformă retragerea ofertei în anularea unei lucrări.
- La confirmarea selecției, tokenul și starea sunt reverificate în aceeași tranzacție cu acceptarea ofertei alese și respingerea celorlalte. Eșecul celei de-a doua scrieri nu lasă prima scriere parțială.
- Conflictele de capacitate folosesc `CAPACITY_UNAVAILABLE`. API-ul nu le mai etichetează drept `ALREADY_TAKEN`, ceea ce permite mobilului să afișeze motivul real.
- Erorile de rezervare/lock produc răspuns controlat, fără detalii interne și fără apel de plată înainte de rezervarea reușită.

## Continuare: recuperare asistată pentru dovezile noi

[NITIDO-SELECTION-RECOVERY.md](NITIDO-SELECTION-RECOVERY.md) adaugă dovada durabilă și reluarea de către client pentru confirmările Standard incomplete. Cazurile fără dovadă și automatizarea integrală rămân deschise. Secțiunea următoare descrie restanța versiunii de bază și limitele care nu sunt închise integral.

## Cazuri care rămân pentru reconciliere

Dacă plata a fost confirmată, dar finalizarea locală a ofertelor eșuează, rezervarea lucrării se păstrează, ofertele rămân neconfirmate și răspunsul este 503. Nu se eliberează lucrarea și nu se pornește automat o plată nouă. Dacă salvarea compensării după o eroare de autorizare este blocată, capacitatea rămâne ocupată până la verificarea stării.

Aceste răspunsuri nu sunt succes de produs. Recuperarea automată a tuturor selecțiilor incomplete, expirarea rezervărilor și reconcilierea completă între starea plății, token și oferte rămân deschise. Workerul financiar existent nu este declarat capabil să închidă aceste cazuri. Operatorul trebuie să verifice lucrarea și plata; nu se corectează manual istoricul financiar doar pentru a elimina un blocaj.

## Domeniu și limite

Este păstrată regula conservatoare existentă de disponibilitate la nivel de firmă. Această livrare **nu introduce capacitatea paralelă pe mai multe echipe**, selecția automată a unei echipe, rezervări cu expirare, eligibilitate completă pe categorii sau autorizarea la termen a lucrărilor îndepărtate. Calendarul și raportul de capacitate pe echipe rămân funcții distincte. Ofertele multiple pentru intervale suprapuse nu garantează disponibilitatea; câștigă prima rezervare eligibilă.

Garanția tranzacțională presupune aceeași bază SQLite și locking funcțional. Două baze independente nu coordonează capacitatea. Testele folosesc două conexiuni reale la același fișier WAL și o intercalare deterministă exact după citirea disponibilității; nu sunt o probă de încărcare pe infrastructura țintă. Stripe este simulat în aceste scenarii; nu s-au făcut operațiuni în contul beneficiarului.

## Instalare și verificare

Nu există migrare nouă de schemă sau rescriere a programărilor. Înainte de instalare se inventariază lucrările active cu date/durate lipsă sau invalide; acestea pot bloca acum preluări care anterior erau acceptate prin omiterea verificării. Nu inventați ore pentru a trece verificarea.

Nu rulați simultan versiunea veche și cea nouă pe aceeași bază: vechiul cod nu respectă limita tranzacțională a citirii. Rollbackul readuce cursa de concurență; se evaluează înainte de redeschiderea acceptărilor. Cerința anterioară de înrolare MFA înainte de instalare rămâne aplicabilă.

Probe staging necesare: două acceptări suprapuse ale aceleiași firme, firme independente, intervale adiacente, durată/buffer personalizate, ofertă retrasă versus selectată, autorizare întârziată/eșuată, mesaje web/mobil și verificarea bazei după fiecare caz. E2 rămâne deschisă.

Aprobarea beneficiarului pentru producție a fost primită în conversație și rămâne valabilă. Această continuare nu reprezintă instalare pe server și nu transformă probele runtime restante în PASS.
