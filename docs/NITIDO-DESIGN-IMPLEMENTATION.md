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
