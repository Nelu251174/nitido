# NITIDO — referințe aprobate și implementare

Sursa cerințelor: `NITIDO-MASTER-SOURCE.md`, transcrierea integrală a documentului furnizat de beneficiar. Imaginile originale rămân referințe de design, nu capturi ale produsului implementat.

Din cele 30 de fișiere PNG furnizate, 18 sunt distincte: 12 planșe inițiale și 6 revizii. Reviziile au prioritate. Numerotarea de mai jos este sufixul fișierelor din seria `09_26`.

| Planșă | Fișier inițial → revizie | Implementare în cod | Stare reală |
|---|---|---|---|
| 01 Homepage desktop | 2 → 13 | `src/app/page.tsx`, `BookingEstimator` | Compoziție refăcută, fotografie derivată din referință, formular conectat |
| 02 Homepage mobil | 1 → 16 | CSS responsive, aplicație client, `HomeBookingForm` | Website responsive; aplicația nativă adaptată parțial |
| 03 Configurator | 4 → 17 | `/rezervare`, `BookingConfigurator` | Formular și sumar conectate la tarifele active; catalogul de extraservicii rămâne de extins |
| 04 Comparare firme | 6 → 18 | `/client`, grila candidaturilor | Carduri refăcute; selecția existentă păstrată |
| 05 Panou client | 3 | `ClientOverview`, `/client` | Rezervare următoare, proprietate, istoric și navigare |
| 06 Detaliu lucrare | 10 | `/client`, `JobMessages` | Ecran cu etape, checklist real, fotografii protejate, firmă, chat și plată separată; necesită acceptanță vizuală autentificată |
| 07 Panou firmă | 7 → 14 | `/firma`, `FirmSummary` | Oportunități, echipe și grafic cu valoarea netă a lucrărilor finalizate cu plata capturată; viramente separate |
| 08 Calendar echipe | 5 | `TeamSchedule`, `/firma/calendar` | Calendar săptămânal, filtre echipe, detalii, alocare și indisponibilități persistente cu verificarea conflictelor |
| 09 Execuție mobilă | 8 | `/firma/executie`, aplicația firmei | Execuție web refăcută și checklist/raport în aplicație; trimitere validată de server, blocare după raport |
| 10 Admin operațiuni | 9 | `AdminOperations`, `/admin` | Tabel filtrabil, inspector lucrare, stări financiare distincte |
| 11 Business | 11 | `/client/business` | Portofoliu și aprobări în două coloane, decizii persistente în panou, bugete, CSV și meniu Business |
| 12 Host | 12 → 15 | `/client/host`, `HostTurnover` | Trei ilustrații fotografice din planșa revizuită, selecție proprietate/sejur, interval curățenie asociată, checklist persistent pe sejur; import manual explicit |

## Reguli de implementare

- Nu se introduc evaluări, firme, disponibilități sau încasări fictive în panourile reale.
- Fotografia livingului este decorativă; nu reprezintă fotografia proprietății utilizatorului.
- Tarifele și suplimentele prezentate în planșe nu devin automat tarife comerciale active.
- Starea lucrării, autorizarea cardului, plata, transferul și viramentul bancar rămân distincte.
- Configuratorul public păstrează datele până la autentificare; publicarea și calculul final rămân validate de server.
- Adăugarea unui calendar nu confirmă că o proprietate este pregătită și nu creează automat o lucrare.

## Limite care trebuie închise înainte de acceptanța integrală

Această tranșă nu reprezintă finalizarea întregului brief. Sunt necesare: comparație vizuală autentificată pentru fiecare rol la toate lățimile cerute; validarea compozițiilor detaliu lucrare și execuție pe date de test; catalogul versionat de servicii și extraopțiuni; indisponibilități de echipă; sincronizare automată iCal cu worker; integrarea și verificarea serviciilor externe; verificare plăți în mediul Stripe de test; verificări de accesibilitate, performanță și restaurare. Cerințele integrale rămân în documentul sursă, inclusiv criteriile de acceptanță.

## Actualizare execuție și detaliu

- `/client`: detaliu în trei coloane, cronologie din date existente, checklist din `/api/workspace`, fotografii protejate încărcate direct cu sesiunea utilizatorului.
- `/echipa`: `TeamExecutionCard`, progres, fotografii separate, raport cu cerințe vizibile și buton condiționat de cele șase verificări și ambele tipuri de dovezi.
- Aplicația nativă: checklist client read-only, checklist firmă editabil, trimitere raport către `/api/collaboration`, păstrarea validărilor serverului și blocarea bifărilor după raport.
- Nu au fost activate noi tarife sau plăți. Întregul brief rămâne deschis până la închiderea criteriilor de acceptanță.

## Tranșa Host / Business / câștiguri — 12 septembrie 2026

- Fotografiile Host sunt afișate din assetul original nemodificat `public/design-v2/host-approved-reference.png`, prin trei ferestre SVG care exclud numele, adresele și stările demonstrative. Sunt etichetate imagini ilustrative. Nu reprezintă fotografii reale ale proprietăților utilizatorului.
- Verificările Host se salvează în `workspace_host_checks`, separat pe sejur și data eliberării. Serverul verifică titularul, tipul Host, anularea și arhivarea, data curentă de eliberare și cheia acceptată. Modificarea eliberării invalidează verificările vechi.
- Aprobările Business folosesc API-ul existent și regulile de acces/buget existente; aprobarea nu creează automat o rezervare și nu capturează bani.
- Graficul firmei însumează valorile nete ale lucrărilor finalizate cu plata capturată pe ziua finalizării în Europe/Bucharest; exclude rambursări/dispute. Nu reprezintă un extras bancar sau data viramentelor.
- Verificare: 442 teste automate trecute, TypeScript și lint trecute. Previzualizarea locală în browser a fost blocată de politica URL; nu declarăm validare vizuală autentificată.
- Încă deschise: sincronizare automată iCal, fotografii proprii per proprietate, calendar Business consolidat și import CSV, comparație vizuală completă a tuturor planșelor și extensiile mobile. Lista de pregătire nu înlocuiește aceste funcții.

- Ajustare cerută de beneficiar: estimatorul ocupă 50% din coloana sa pe desktop (minimum 280 px), cu format compact pe mobil și aceeași variabilă de culoare/gradient ca butonul Caută firme. Sliderul are pistă de 6 px în locul înălțimii globale de input de 44 px.

## Calendar echipe și inventar Host — tranșă operațională

- Calendar firmă: adăugare concediu/indisponibilitate, filtrare, istoric intervale trecute, deblocare și afișare în calendarul săptămânal. Serverul refuză atât alocarea peste un interval blocat, cât și blocarea peste o lucrare deja alocată, incluzând bufferul de deplasare.
- Host: articole de inventar cu unități întregi, intrări/consum, stoc nenegativ, prag minim editabil și alertă vizuală. Jurnalul mișcărilor este persistent, cu prevenirea dublării aceleiași cereri. Interfața afișează ultimele 100 de mișcări din cont, filtrate pe proprietate.
- Accesul este limitat la titularul firmei/proprietății. Intervalele deblocate și jurnalul mișcărilor sunt păstrate. Nu sunt efectuate achiziții automate sau trimise mesaje.
- Nu declarăm brief-ul integral închis. Rămân calendarul zi/lună, sincronizarea automată iCal, extraopțiunile și catalogul versionat, configurarea serviciilor email/AI/plăți și acceptanța vizuală autentificată a tuturor ecranelor web/mobile.


### Calendar firmă — zi, săptămână și lună

Calendarul include navigare după dată, filtre pentru echipă, tipul spațiului și oraș, precum și blocările reale de disponibilitate. Vizualizările zi/lună includ intervalele care traversează miezul nopții, cu rezerva de deplasare. Calendarul săptămânal păstrează grila 07:00–20:00 și afișează separat programările care depășesc acest interval. Datele sunt calculate pentru Europe/Bucharest; sfârșitul intervalului este exclusiv.

Validare: teste pentru săptămâna de luni, luni cu zile adiacente, navigare la sfârșit de lună/an, an bisect, miezul nopții și schimbarea orei. Această modificare nu reprezintă finalizarea întregului brief; verificarea vizuală autentificată rămâne de făcut.


### Înregistrarea tarifului publicat
Rezervările noi păstrează separat versiunea tarifului existent, parametrii spațiului, durata, bufferul și defalcarea în bani (serviciu, Express 60, credit, total client). Înregistrarea este scrisă în aceeași tranzacție cu rezervarea și nu poate fi rescrisă sau ștearsă prin UPDATE. Ajustările ulterioare ale prețului operațional nu modifică această evidență inițială. Rezervările istorice nu primesc retroactiv o versiune presupusă. API-ul de estimare include aceeași structură, fără a reprezenta o rezervare garantată sau un tarif blocat. Catalogul de extraopțiuni și afișarea acestei defalcări în toate interfețele rămân de implementat.


### Prețul publicat și instrucțiunile clientului — interfață
Panoul clientului afișează defalcarea inițială salvată (serviciu, Express, credit și total), cu data înregistrării. Nu recalculează istoricul și nu prezintă totalul inițial drept sumă deja încasată. Pentru rezervări vechi sau înregistrări nevalide, afișează explicit lipsa defalcării. Formularul clientului colectează maximum 500 de caractere de instrucțiuni speciale; serverul validează tipul și lungimea. Instrucțiunile salvate sunt vizibile clientului și firmei alocate în lucrarea activă, nu în oportunitățile publice.
Catalogul extins, câmpurile structurate pentru camere/băi și extraopțiunile tarifabile rămân deschise.


### Editor administrativ pentru catalog — versiuni în pregătire
În Admin → Catalog există un editor pentru întreținere, generală, după renovare, mutare, birouri și Host. Sunt editabile sarcinile incluse/excluse, echipamentul, localitățile propuse, limitele de suprafață, durata și maximum 30 de extraopțiuni cu unitate și tarif în bani. Un tarif null înseamnă neconfigurat, distinct de zero. Salvarea creează o versiune și o intrare de istoric în aceeași tranzacție; versiunea trimisă de editor previne suprascrierea concurentă. Acces administrativ și origine de mutație validate pe server; auditul salvării este atomic.
Acestea sunt definiții în pregătire: nu activează categorii, nu schimbă tarifele existente și nu apar încă în rezervări. Verificarea capacității eligibile, publicarea comercială și conectarea extraopțiunilor la ofertare/rezervare rămân deschise. Istoricul este păstrat în baza de date; interfața de comparare/restaurare a versiunilor nu este încă implementată.


### Asociere categorie–firmă și verificare capacitate în Admin
Admin → Catalog permite asocierea/retragerea unei categorii pentru o firmă și verificarea pe localitate, cu interval opțional. Eligibilitatea este recalculată din asociere, verificarea firmei, suspendare, acoperire normalizată și echipe active. La verificarea unui interval, sunt excluse suprapunerile cu lucrări active (inclusiv buffer) și blocările echipelor. Lucrările suprapuse fără echipă activă alocată blochează confirmarea eligibilității firmei. Fără interval nu se declară disponibilitate orară. Modificările sunt auditate atomic și protejate de autentificare administrativă și origine de mutație.
Acest instrument este o verificare administrativă la momentul cererii, fără rezervare de capacitate. Asocierea nu este o certificare profesională și nu publică automat categoria. Conectarea catalogului la rezervare, activarea comercială, calculul complet al extraopțiunilor și reverificarea atomică la acceptare rămân deschise.


### Evaluare asistată — flux client și Admin
Configuratorul oferă acces la /client/evaluari, cu localitatea și suprafața păstrate prin autentificare. Clientul completează categoria, suprafața, camerele, băile, dificultatea, cantitățile extra și instrucțiunile. Cererea salvează definiția/versiunea categoriei existente la trimitere și datele originale; nu creează lucrare, autorizare sau plată.
Admin poate solicita completări, încheia evaluarea cu un răspuns sau refuza preluarea. Clientul poate completa ori anula cererile deschise. Mesajele sunt păstrate în ordine, iar versiunea cererii previne suprascrieri concurente. Retrimiterea creației este idempotentă; reutilizarea cheii cu alt conținut este refuzată. Accesul clientului este limitat la propriile cereri; Admin are acces separat. Există protecție de origine, limită de dimensiune și limitare a frecvenței pentru cererile clientului.
Peste limita de 1000 m² a calculatorului automat, estimarea API și publicarea unei lucrări noi returnează necesitatea evaluării (422), înainte de verificarea cardului. Panoul web afișează legătura spre evaluare în loc de preț pentru această situație. Cererile istorice deja publicate sunt păstrate.
Răspunsurile sunt afișate în cont; nu declarăm notificare email. Lista clientului afișează ultimele 200 de cereri; Admin afișează maximum 200, cu prioritate pentru cele deschise. Evaluarea nu se transformă automat într-un preț contractual sau într-o rezervare. Catalogul comercial complet, prețurile extra integrate în rezervare și acceptanța vizuală autentificată web/mobile rămân deschise.
Validare locală: 18 teste relevante, TypeScript și lint trecute.

### Cont Business — validare și protecția salvării
Datele firmei sunt validate ca tip și lungime înainte de scriere. Cererile cu JSON invalid, corp supradimensionat, origine nepermisă sau rată excesivă sunt respinse. Identitatea proprietarului vine exclusiv din sesiune; conturile de firmă prestatoare nu pot activa profilul client Business prin acest endpoint. Citirea profilului are cache privat dezactivat. Acest control nu reprezintă verificare fiscală/ANAF a CUI-ului. Teste de regresie acoperă păstrarea profilului existent la date invalide și limitele API.

### Import inițial de locații CSV
Disponibil în Proprietăți, Business și Host: model descărcabil, selectare fișier, previzualizare cu toate câmpurile și validare pe rând înainte de confirmare. Maximum 200 locații/500 KB, UTF-8, delimitare virgulă, câmpuri citate și note multilinie. Suprafața și bugetul respectă limitele proprietăților existente.
Serverul verifică exclusiv contul client autentificat. Duplicate în fișier sau în propriul cont (inclusiv arhivate), după denumire+oraș+adresă normalizate, sunt omise fără a modifica locația existentă. Salvarea reverifică într-o tranzacție; un rând invalid blochează întregul lot. Retrimiterea aceluiași lot nu dublează locațiile. Nu creează rezervări și nu procesează plăți. Testele acoperă proprietarul, duplicatele, atomicitatea, limitele și sintaxa CSV. Verificarea vizuală într-un cont autentificat rămâne de efectuat.

### Calendar consolidat Business
Panoul Business include Calendar în navigare, vizualizare zi/săptămână/lună și filtre cumulative pe locație, firmă, status și interval navigabil. Sunt afișate exclusiv lucrările asociate locațiilor Business active din cont. Numele firmelor provin din alocările propriilor lucrări; nu se expune lista globală a firmelor. Lucrările fără interval valid apar separat, fără o zi inventată. Durata estimată exclude deplasarea; intervalele care traversează miezul nopții apar în fiecare zi afectată, cu sfârșit exclusiv. Orele sunt în Europe/Bucharest.
Deschide lucrarea selectează rezervarea prin ID numai dacă există în lista contului autentificat. Un ID străin nu încarcă o lucrare și afișează un mesaj de indisponibilitate. Starea operațională nu este prezentată drept confirmare de plată. Această etapă nu generează programări recurente noi. Testele verifică filtrele, asocierile, duplicatele, lipsa intervalului și miezul nopții. Verificarea vizuală în cont autentificat rămâne deschisă.

### Raport lunar de execuție și export
Panoul Business permite selectarea lunii, generarea raportului și descărcarea CSV pentru aceeași lună. Raportul include lucrările finalizate din întregul cont client, inclusiv cele fără locație asociată; nu este raport exclusiv pe locații Business. Perioada folosește data finalizării UTC, explicit în interfață. Valorile sunt valori ale lucrărilor, nu capturi Stripe, sold bancar sau factură.
Endpointul respinge lunile invalide în loc să extindă implicit perioada; răspunsurile sunt private/no-store. Exportul escapează ghilimelele și neutralizează prefixele de formule din celulele text. La descărcare, datele sunt recitite și interfața explică posibilitatea actualizărilor între generare și export. Testele de business și CSV au trecut; verificarea vizuală autentificată rămâne deschisă.

### Confirmarea emailului
Înregistrarea client/firma solicită acum mesajul de confirmare în locul mesajului simplu de bun venit. În cont există starea neconfirmată și retrimitere. Token aleator de 256 biți, numai hash SHA-256 în baza de date, expirare 24 h, o singură utilizare, legat de adresa curentă. Retrimiterea invalidează linkul anterior. Confirmarea nu autentifică utilizatorul și nu modifică parola. Conturile existente nu sunt marcate automat ca verificate și nu sunt blocate retroactiv.
Linkul transportă tokenul în fragment, eliminat din bara adresei după deschidere. Confirmarea necesită apăsare explicită și POST cu origine verificată; GET nu consumă tokenul. Limite IP și maximum trei retrimiteri/oră/cont. Mesajele nu pleacă dacă Resend sau URL-ul HTTPS nu sunt configurate. Nu se declară livrare în Inbox: succesul API înseamnă acceptare de către furnizor.
Teste: expirare, reutilizare, înlocuire, adresă modificată, cont separat, configurație absentă, acces anonim, origine, GET fără mutație și limitare de rată. Livrarea reală nu este validată: configurarea furnizorului rămâne necesară.

### Înregistrare atomică client și firmă
Crearea utilizatorului, acordarea bonusurilor existente de recomandare și crearea firmei sunt acum într-o singură tranzacție. O eroare la inserarea firmei anulează utilizatorul și bonusurile. Reluarea aceleiași înregistrări nu poate reacorda bonusul după conflictul de unicitate. Referentul este reverificat la salvare. Verificarea ANAF, hashing-ul parolei și trimiterea emailului rămân în afara tranzacției SQLite.
Corpul JSON este limitat, iar câmpurile sunt validate ca tip și lungime înainte de apeluri externe și funcții de text. Emailul și numele sunt curățate de spațiile marginale. Această etapă nu schimbă politica comercială de acordare a bonusurilor și nu activează furnizorul de email. Testele injectează o eroare reală de inserare și verifică rollback-ul integral.

### Confirmarea emailului — aplicația mobilă
Profilurile client și firmă includ un card nativ cu starea emailului, retrimitere și actualizare manuală. Starea este recitită la revenirea pe profil și în aplicație. Răspunsurile incomplete nu sunt interpretate ca confirmare, iar acceptarea emailului de furnizor este distinctă de verificarea adresei. Butonul Adrese din profilul clientului deschide proprietățile.
Folosește API-ul autentificat existent; nu activează bearer auth, nu schimbă infrastructura de email și nu ocolește protecția originii. Distribuirea pe dispozitive necesită un build mobil nou și validarea sesiunii pe infrastructura țintă. TestFlight/App Store/Google Play și livrarea reală de email nu sunt validate prin testele unitare.

### Editarea profilului mobil
Date personale, Date firmă și Zone de acoperire deschid ecranul nativ /account. Formular precompletat din API-ul rolului, câmpuri editabile, salvare și feedback de eroare. Firma poate edita nume, telefon, acoperire, descriere, program, servicii și website; CUI-ul nu este editabil. Clientul poate edita nume, email și telefon. Confirmarea emailului este legată de adresa curentă în mecanismul existent.
Endpointurile de profil verifică originea, limita de rată, dimensiunea corpului și tipurile/lungimile câmpurilor. Actualizarea utilizatorului și a firmei este atomică. Un profil de firmă lipsă este respins. Nu se activează autentificarea bearer și nu se publică un build mobil prin această schimbare. Validarea pe dispozitiv și livrarea în magazine rămân deschise.

### Proprietăți native — creare și editare
În Proprietăți, Business și Host, fiecare locație are acțiune de editare. Formular modal cu identitatea existentă și toate câmpurile: denumire, oraș, adresă, suprafață, tip spațiu, utilizare, centru de cost, buget și preferințe. Crearea nu mai impune apartament pentru Business; implicit birou, cu alegere explicită. Bugetul acceptă virgulă sau punct și este trimis în bani.
Formularul păstrează datele la eșecul salvării și blochează trimiterea simultană și închiderea în timpul cererii. Modificarea utilizării poate muta proprietatea în alt modul după salvare. Testele verifică păstrarea identității și câmpurilor, conversia bugetului și respingerea suprafețelor/valorilor invalide. Serverul existent aplică autorizarea proprietarului. Nu sunt create rezervări automat. Build-ul instalabil și verificarea pe dispozitiv rămân necesare.

### Rezervare mobilă din proprietate — observații și încărcare

Rezervarea preia acum observațiile proprietății, fără trunchiere automată. Limita de 500 de caractere a cererii rămâne validată la pasul de detalii; notele mai lungi trebuie scurtate explicit de client. Formularul așteaptă încărcarea proprietății și oferă reîncercare la eroare. Încărcarea altei proprietăți resetează fotografiile, estimarea și identificatorul cererii precedente; data trecută nu este precompletată.

Verificare: 66 de teste mobile și TypeScript trecute. Modificarea este pentru sursa aplicației native; necesită build Expo/EAS și verificare pe dispozitiv. Nu reprezintă finalizarea integrală a brief-ului.

### Evaluări personalizate în aplicația mobilă

Ecran nativ client disponibil din Cont → Evaluări personalizate și din rezervare pentru suprafețe peste 1000 m². Formularul include cele șase categorii, localitate, suprafață, camere, băi, dificultate, aparate, geamuri, lenjerie, ore suplimentare și instrucțiuni. Folosește API-ul existent /api/assessments, cu identitatea verificată pe server. Nu creează rezervări, nu estimează un preț final și nu autorizează carduri.

Sunt afișate ultimele 200 de cereri, stările și conversațiile cu administrarea. Clientul poate răspunde cererilor deschise sau le poate anula după confirmare. Salvarea include versiunea serverului; conflictele sunt afișate, lista se reîncarcă și mesajul nesalvat este păstrat. Reîncercarea aceleiași cereri după o eroare de rețea folosește același identificator cât timp ecranul rămâne montat. Nu este o coadă offline persistentă.

Validare locală: 80 de teste mobile, TypeScript și lint. Necesită în continuare configurarea autentificării native, build Expo/EAS și verificare pe dispozitiv. Brief-ul integral și verificarea vizuală a tuturor planșelor nu sunt declarate finalizate.

### Continuitatea rezervare → evaluare pe mobil

Transferul către evaluare păstrează localitatea, suprafața, observațiile, adresa, etajul/accesul, codul poștal și data/ora dorită. Birourile selectează categoria office; restul spațiilor pornesc de la general, editabilă de client. Datele sunt prezentate înainte de trimitere și nu sunt trimise automat serverului. Fotografiile și aprobările nu sunt convertite în cerere de evaluare.

Transferul este temporar, în memoria aplicației, legat de cont, consumat o singură dată și expirat după zece minute; este șters la deconectare. Ruta conține doar identificatorul transferului, fără adresa sau observațiile clientului. Dacă aplicația este închisă sau transferul expiră, interfața explică necesitatea revenirii la rezervare ori completării manuale. Nu reprezintă salvare offline.

Verificare: 84 de teste mobile; TypeScript și lint. Build-ul nativ și verificarea pe dispozitiv rămân necesare.

### Notificări mobile — stare corectă și reîncercare

Ecranul separă permisiunea sistemului, înregistrarea locală, activarea serviciului PUSH_ENABLED și numărul dispozitivelor active din cont. Un alt dispozitiv activ nu este prezentat drept confirmare pentru telefonul curent. Erorile la citire sunt afișate ca stare necunoscută, fără falsă dezactivare. Sunt disponibile setările telefonului, actualizarea manuală și reverificarea la revenire.

Operațiile simultane sunt blocate. Dezactivarea șterge tokenul local numai după confirmarea explicită a serverului, păstrând reîncercarea la eșec. Înregistrarea inițială cere confirmare explicită înainte de salvarea locală. Nu s-au activat infrastructura push sau SMS și nu se pretinde livrare verificată pe dispozitiv.

Verificare locală: 92 teste mobile, TypeScript și lint. Necesită build nativ și testare pe telefon.

### Backup și restaurare — utilitar și probă izolată

Adăugat scripts/recovery.mjs pentru snapshot SQLite plus fotografii, manifest SHA-256 și restaurare exclusiv într-o destinație nouă. Procedura cere oprirea scrierilor. Două teste de recuperare izolate trecute și integrate în CI; 527 teste web/backend trecute în această etapă. Documentație: NITIDO-RECOVERY.md. Nu s-a operat asupra volumelor de producție și nu este declarată validarea integrală a brief-ului.

### Verificare suplimentară backup — fișiere procesate în flux

Eliminată citirea integrală în memorie a bazei/fotografiilor pentru backup și restaurare. Sunt validate metadatele manifestului și limitată dimensiunea acestuia. Trei probe izolate și lint au trecut. Rularea GitHub anterioară 34683687760 a fost confirmată cu succes; modificarea curentă necesită propria rulare CI. Nu echivalează cu verificare de performanță pe infrastructura reală sau finalizare integrală.

### Contact mobil — acțiuni conectate

Intrările Contact NITIDO/Suport NITIDO din profilurile Client și Firmă deschid ecranul nativ /contact. Acesta oferă apel telefonic, redactarea emailului, asistentul corespunzător rolului și conversațiile lucrărilor. Pagina Încredere trimite către același ecran. Adresele sunt selectabile, iar imposibilitatea deschiderii aplicației telefon/email este afișată. Emailul nu este trimis automat. Navigarea către asistent și conversații este internă.

Verificare: TypeScript, lint și suita mobilă; apelul și emailul necesită verificare pe dispozitiv. Nu constituie validare integrală a brief-ului.

### Validare securitate — fără rezultate zero inventate

Workflow-ul verifică dependențele website și mobile prin scripts/audit-report.mjs. Lipsa răspunsului, erorile npm/rețea, JSON invalid, câmpurile lipsă și totalurile inconsistente fac verificarea să eșueze; nu mai sunt convertite în zero vulnerabilități. Rezultatele high/critical rămân avertismente explicite conform politicii existente; o rulare verde nu implică absența vulnerabilităților. Patru teste pentru interpretarea raportului și lint trecute local. Auditul real este efectuat în GitHub CI, nu simulat de aceste teste.

Blocaj de build nativ reconfirmat în mobile/app.json: extra.eas.projectId este încă OWNER_EAS_PROJECT_ID_REQUIRED. Validarea pe dispozitive și publicarea nu sunt confirmate.

### Remediere dependențe critice și ridicate

Audit real inițial website: 1 critică, 2 ridicate, 6 moderate. Actualizate Next.js și eslint-config-next la 16.3.5, Sharp la 0.35.4, js-yaml tranzitiv la 4.3.2. Audit local după actualizare: 0 critice, 0 ridicate, 6 moderate. Moderate rămase: lanțurile Vitest și Capacitor/xcode/uuid. Auditul mobile anterior: 15 moderate; lockfile-ul mobile nu a fost modificat în această etapă.

Referințe: https://github.com/advisories/GHSA-2xp9-vwfh-vxw4 , https://github.com/advisories/GHSA-rgj7-g3m4-5g8c , https://github.com/advisories/GHSA-2883-xcg3-v3hh . Nu se declară dispariția vulnerabilităților din instanța publicată până la deployment-ul confirmat al versiunii actualizate.

### Ajutor disponibil fără provider AI

Cele șase întrebări rapide din SupportCenter deschid răspunsul corespunzător din supportKnowledge într-un panou separat, etichetat explicit drept ghid fără AI. Nu mai sunt dezactivate odată cu providerul și nu sunt injectate în istoricul conversației AI. Formularul AI este activ numai după confirmarea available=true. Lint trecut; necesită CI și verificare în sandbox după publicare. Providerul AI nu a fost configurat sau activat prin această modificare.

### Disponibilitatea AI și reîncercarea pe mobil

Ecranul nativ verifică disponibilitatea la deschidere și permite reverificare manuală. Răspunsurile incomplete nu activează trimiterea. Întrebarea rămâne în formular la eroare, iar istoricul este extins numai după un răspuns valid. Limita este aliniată la server: 1000 de caractere. Apăsările simultane sunt blocate, iar răspunsurile unei vizite anterioare nu modifică noua vizită. Nu s-a activat providerul AI și nu s-a publicat un build instalabil.

Etapa web precedentă be08e57 a fost publicată în sandbox și verificată în browser: toate cele șase întrebări rapide deschid răspunsul din ghid, iar închiderea funcționează. Formularul AI rămâne dezactivat când providerul este indisponibil.

### Recurență — anulare definitivă și feedback

Planurile anulate nu pot fi reactivate sau puse pe pauză prin API; anularea repetată rămâne idempotentă. Verificarea titularului și modificarea sunt într-o tranzacție. Interfața cere confirmare înainte de pauză/anulare, explică păstrarea vizitelor deja generate, blochează apăsările simultane și afișează erorile ori confirmarea serverului și când formularul de creare este închis.

15 teste de recurență trecute, inclusiv trei probe noi pentru starea terminală, accesul altui client și păstrarea lucrării generate. Această etapă nu implementează anularea financiară a vizitelor existente, pauza pe interval sau orizontul de generare; acestea rămân deschise.

### Recurență — limite și protecția cererilor

Crearea abonamentului validează tipurile și lungimile înainte de verificarea cardului. Suprafețele peste 1000 m² sunt respinse cu necesitatea evaluării; nu se mai convertesc șiruri/booleeni în suprafețe sau ore și nu se trunchiază observațiile. Ancora lunară se salvează în inserarea inițială. Crearea și schimbarea stării verifică originea după autentificare, limitează frecvența și corpul JSON; identitatea clientului vine din sesiune.

24 de teste țintite trecute (18 recurență, 6 API), inclusiv acces, origine străină, limite și absența operațiunilor la input invalid. Generarea la citirea listei rămâne comportamentul existent; nu se declară rezolvarea schedulerului, a vizitelor deja generate ori a autorizării financiare în avans. Planurile istorice nu sunt rescrise automat.

### Istoricul persistent al vizitelor recurente

Tabela aditivă recurring_occurrences leagă planul, data apariției, lucrarea și momentul programat. Perechea plan/data și ID-ul lucrării sunt unice. Inserarea lucrării, evidența apariției și avansarea seriei sunt într-o tranzacție; o eroare nu lasă lucrarea fără legătură. Reluarea unei date deja înregistrate nu generează o a doua lucrare și nu repetă acceptarea/plata.

Contul clientului afișează ultimele 200 de vizite înregistrate, cu ora București, status operațional și deschiderea rezervării. Sunt incluse seriile anulate; accesul verifică titularul planului și al lucrării. Nu se deduc legături pentru istoricul vechi din last_job_id. Schema nouă poate rămâne la rollback de cod; nu trebuie ștearsă pentru revenire.

28 teste țintite trecute, inclusiv rollback SQLite, reluarea datei, istoric după anulare și izolarea clientului. Nu reprezintă verificare distribuită sau rezolvarea anulării financiare a vizitelor, a pauzelor pe interval ori a generării în avans. Verificarea vizuală autentificată rămâne necesară.

### Citirea abonamentelor fără efect financiar

GET /api/recurring este acum exclusiv citire: nu generează lucrări și nu încearcă autorizări. Generarea explicită folosește POST action=generate, autentificarea clientului, verificarea originii și limita de frecvență; clientId din corp nu poate selecta alt cont. Butonul Generează vizitele scadente cere confirmare și explică posibila autorizare pentru firma preferată. Numărul de vizite create nu este prezentat drept confirmare financiară.

Endpointul cron existent rămâne disponibil și protejat prin CRON_SECRET; această modificare nu configurează un scheduler. Automatizarea efectivă trebuie verificată în infrastructură. 31 teste țintite trecute, inclusiv GET fără mutație, POST limitat la titular și origine străină respinsă. Nu s-au inițiat lucrări sau autorizări în conturi reale pentru validare.

### Automatizare recurență — executabil și verificare infrastructură

Coolify sandbox verificat: No scheduled tasks; CRON_SECRET nu apare în lista vizibilă de configurări. Nu este declarată automatizare activă. Imaginea Docker include scripts/recurring-runner.mjs; comanda de sarcină este node /app/scripts/recurring-runner.mjs, propunere de frecvență */5 * * * *. Necesită CRON_SECRET în runtime, identic cu cel verificat de API.

Executabilul apelează exclusiv loopback, nu urmează redirecturi, are timeout 55 secunde și nu afișează cheia sau răspunsuri brute. Orice eroare produce exit 1; numărul de vizite se raportează numai după răspuns valid. Timeout-ul nu anulează o procesare deja începută în server; istoricul trebuie verificat. Patru teste izolate sunt incluse în CI. Nu s-a creat ori activat o sarcină în Coolify și nu s-au generat lucrări reale.

### Scheduler activ și recuperarea vizitei curente

CRON_SECRET a fost generat și salvat numai în runtime Coolify sandbox. Sarcina NITIDO recurring visits este activată la fiecare 5 minute; execuția manuală din 12 septembrie 2026, 10:24:08 UTC, a încheiat cu Success și created=0. Redeploy 76efa50 reușit. Aceste rezultate înlocuiesc constatarea anterioară de scheduler absent; nu validează un flux financiar complet.

Corectată recuperarea după pauză sau întrerupere: se elimină doar aparițiile cu ora deja trecută. Vizita de astăzi cu oră viitoare este generată în aceeași execuție, fără a aștepta următoarea rulare și fără recuperări retroactive. Cinci probe noi acoperă săptămânal, două săptămâni, ancora lunară, schimbarea orei și o vizită deja expirată. 27 teste de recurență, TypeScript și lint trecute local. Publicarea modificării de cod necesită CI verde. Brief-ul integral rămâne deschis.

### Pauză recurentă pe interval de date

Adăugată tabela recurring_pauses, un interval inclusiv per plan, fără modificarea vizitelor sau plăților existente. Clientul alege abonamentul activ și datele; confirmarea explică înlocuirea intervalului anterior, reluarea automată și lipsa recuperării retroactive. Generatorul omite aparițiile din interval și păstrează frecvența, ancora lunară și ora București.

API validează datele, titularul și starea într-o tranzacție. Dacă există vizite active deja generate în interval, răspunsul 409 cere gestionarea lor explicită în Rezervări; nu se pretinde anularea lor sau eliberarea banilor/capacității. Intervalul existent este afișat în cont. O pauză generală manuală rămâne separată și necesită Reia. Eliminarea unei pauze sau rescrierea intervalului nu recuperează aparițiile deja omise.

41 de teste țintite trecute, TypeScript și lint trecute. Schema este aditivă; nu se șterge la rollback. CI și publicarea acestei versiuni se verifică separat. Rămân deschise confirmarea vizuală autentificată, anularea coordonată a vizitelor deja generate, orizontul de generare și validarea financiară integrală.

### Data opțională de sfârșit a seriei

Abonamentele noi acceptă endDate opțional, validat calendaristic și comparat cu prima dată înainte de verificarea cardului. Coloana end_date se adaugă compatibil bazelor existente; null păstrează seriile fără termen. Generatorul include ultima zi și nu creează vizite ulterioare, inclusiv după pauză sau întrerupere. Planurile și istoricul rămân disponibile; încheierea seriei nu anulează lucrări existente și nu schimbă plăți.

Formularul oferă data de sfârșit și explică limita inclusivă, ora României și regula ultimei zile a lunii. Lista afișează limita și indică încheierea când următoarea dată depășește limita. 46 de teste țintite, TypeScript și lint trecute local. Necesită CI și deployment confirmate separat; verificarea vizuală autentificată și întregul brief nu sunt declarate finalizate.

### Reîncercarea creării fără duplicarea abonamentului

Formularul păstrează un requestId pentru același conținut până la confirmare și blochează trimiterea simultană cu alte acțiuni de recurență. Serverul păstrează o amprentă a conținutului și ID-ul planului, unic per client/requestId, în aceeași tranzacție cu abonamentul. Reîncercarea returnează planul inițial; conținutul diferit produce 409. Un plan anulat nu este reactivat prin reîncercare. Clienții vechi fără requestId păstrează comportamentul anterior; reîncărcarea paginii înainte de confirmare nu păstrează cheia formularului și necesită verificarea listei.

Erorile de rețea sunt afișate, iar confirmarea creării este separată de reîncărcarea listei. 49 teste țintite, TypeScript și lint trecute; inclusiv rollback la eșecul salvării cheii și izolarea între clienți. CI și publicarea se verifică separat. Nu se declară validarea completă a brief-ului.

### Retrimiterea confirmării email fără pierderea linkului anterior

Dacă furnizorul refuză trimiterea sau cererea eșuează, se restabilește tokenul anterior numai dacă tentativa curentă este încă cea activă. O confirmare consumată între timp ori un token mai nou nu sunt suprascrise. Primul token nestrimis este eliminat. O adresă deja confirmată nu produce o excepție care să întrerupă fluxul apelant.

19 teste de email/API trecute, inclusiv cinci probe noi pentru eșec, concurență și confirmare în timpul trimiterii; TypeScript și lint trecute. Furnizorul este simulat în teste. Nu s-a verificat livrarea în inbox și nu s-a activat un furnizor prin această modificare. Configurarea Resend și verificarea domeniului expeditor rămân cerințe pentru trimitere reală.

### Suport aliniat cu funcțiile contului

Ghidul comun pentru website și contextul AI are 61 de subiecte. Corectate instrucțiunile pentru resetarea parolei, editarea profilului, telefon, acoperire, email și mesagerie după verificarea formularelor existente. Adăugat ghidul confirmării emailului, inclusiv Spam, expirare și limita retrimiterilor. 20 teste ale ghidului trecute. Providerul AI nu este activat de această schimbare.

Beneficiarul a confirmat primirea emailului în Spam și confirmarea adresei după deployment 8547a7a. Aceasta validează acel flux pentru contul testat, nu livrarea generală în Inbox sau finalizarea brief-ului integral.

### Recuperarea parolei — salvare atomică

Resetarea salvează parola, invalidează toate linkurile de resetare ale titularului și revocă sesiunile într-o singură tranzacție. Hashing-ul precedă tranzacția; tokenul este reverificat în aceasta, inclusiv expirarea. Eșecul oricărei scrieri păstrează parola, linkul și sesiunile anterioare. API-ul validează originea, dimensiunea și tipurile datelor și limita bcrypt de 72 de octeți; răspunsurile sunt no-store și nu expun erori interne.

17 teste țintite trecute: rollback SQLite în trei puncte, linkuri expirate/reutilizate, izolarea conturilor, cereri intercalate și validări API. Nu s-a schimbat parola unui cont real în această verificare. Brief-ul integral și acceptanța vizuală completă rămân deschise.

### Solicitarea recuperării — configurare și răspunsuri corecte

API-ul validează originea, corpul JSON, dimensiunea și emailul înainte de căutarea contului. Necesită email configurat și domeniu HTTPS fără credențiale; nu folosește originea cererii pentru link. Mesajul rezultat este neutru pentru cont inexistent și pentru rezultatele trimiterii și nu promite livrarea. Tentativa eșuată este eliminată individual, păstrând linkurile anterioare și auditul linkurilor consumate.

Linkurile noi folosesc fragmentul URL. Pagina acceptă și query-ul vechi, apoi elimină tokenul din adresă păstrându-l în memoria formularului; o reîncărcare necesită redeschiderea linkului din email. Trimiterea simultană a formularului este blocată local. 33 teste țintite trecute în total, inclusiv 16 noi pentru validare, configurație, răspunsuri și eliminare selectivă. Nu s-au trimis emailuri ori schimbat parole reale pentru aceste teste. CI și deployment se confirmă separat.

### Eliminarea pauzei programate

Clientul poate elimina intervalul afișat prin Elimină pauza programată, după confirmarea efectelor. API-ul verifică titularul și intervalul într-o tranzacție; o pauză modificată între timp produce 409. Reîncercarea după eliminare este idempotentă. Planul anulat nu se reactivează, iar pauza generală rămâne neschimbată. Vizitele, plățile și cursorul seriei nu sunt modificate: datele deja omise nu se recreează.

53 teste recurență/API și lint trecute local, inclusiv 4 probe noi. Publicarea necesită CI verde; verificarea vizuală în cont autentificat rămâne separată. Acțiunea nu reprezintă anularea coordonată a vizitelor deja generate sau finalizarea recurenței integrale.
