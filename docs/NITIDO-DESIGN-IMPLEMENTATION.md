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
| 08 Calendar echipe | 5 | `TeamSchedule`, `/firma/calendar` | Calendar săptămânal, filtre echipe, detalii, alocare; indisponibilitățile necesită extensie |
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
- Încă deschise: sincronizare automată iCal, inventar cantitativ consumabile/lenjerie, fotografii proprii per proprietate, calendar Business consolidat și import CSV, comparație vizuală completă a tuturor planșelor și extensiile mobile. Lista de pregătire nu înlocuiește aceste funcții.

- Ajustare cerută de beneficiar: estimatorul ocupă 50% din coloana sa pe desktop (minimum 280 px), cu format compact pe mobil și aceeași variabilă de culoare/gradient ca butonul Caută firme. Sliderul are pistă de 6 px în locul înălțimii globale de input de 44 px.
