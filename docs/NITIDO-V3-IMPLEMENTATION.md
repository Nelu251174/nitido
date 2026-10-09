# NITIDO v3 — implementare și limitele livrării

Bază: `f3584d3dfc8a859f6780e2dff21e440d106a0456`, comună branch-urilor `feat/design-handoff-website-mobile-v2` și `claude/nitido-access-42s4fz` la începutul lucrării.

Această modificare implementează redesignul și un prim set de funcționalități din brief-ul master și cele 12 planșe aprobate. Nu reprezintă implementarea integrală a tuturor etapelor P0–P3 din brief. Tabelul de mai jos separă funcțiile existente în acest commit de etapele încă necesare.

## Corespondență cu cele 12 planșe

| Planșă | Implementare în website / aplicație | Limite |
|---|---|---|
| 01 Home desktop | `/`: fotografie principală, estimator, servicii, Standard/Express, pași, recenzii reale, FAQ | Fără date comerciale inventate |
| 02 Home mobil | Homepage responsive, tema comună, fotografie inclusă local în aplicația Expo | Necesită verificare vizuală pe dispozitive |
| 03 Rezervare | `/client#sec-form`, estimator → formular, precompletare din proprietate, cheie idempotentă; wizard Expo existent cu proprietate | Nu sunt introduse servicii suplimentare fără catalog tarifar |
| 04 Comparare firme | Candidaturile existente păstrate; clientul vede recenzii și lucrări finalizate, fără scorul universal în card | Comparare tabelară extinsă și filtre suplimentare rămân de implementat |
| 05 Client | `/client`, navigare, căutare în istoric, proprietăți și rezervare; progresul și suma fictive eliminate | Panoul existent a fost adaptat, nu înlocuit integral |
| 06 Lucrare | Status și fotografii existente, date financiare separate și mesagerie reală după alocare | Recepție explicită de client care condiționează capturarea necesită flux financiar separat |
| 07 Firmă | `/firma`: oportunități filtrabile, indicatori din lucrări reale, acces la operațiuni | Sumele financiare din codul anterior necesită audit complet Stripe |
| 08 Calendar | `/firma/calendar`, `/firma/echipe`: echipe persistente, calendar săptămânal, alocare fără suprapuneri incluzând buffer | Acceptarea inițială păstrează limita de capacitate a firmei; echipele nu măresc automat capacitatea marketplace |
| 09 Execuție mobilă | `/firma/executie`, Expo `execution`: checklist persistent și acces la fluxul existent de fotografii/finalizare | Se folosește contul firmei; conturile separate de angajat și delegarea limitată NU sunt implementate |
| 10 Admin | `/admin`: indicatori operaționali reali, funcțiile existente păstrate | MFA, roluri distincte suport/finanțe și proceduri operaționale avansate rămân deschise |
| 11 Business | `/client/business`, Expo `business`: locații, centre de cost, bugete lunare, asociere lucrări, raport CSV web | Buget informativ; fără blocare cheltuieli, flux de aprobări, membri organizație sau facturare consolidată |
| 12 Host | `/client/host`, Expo `host`: proprietăți, import web .ics, calendar vizibil și în aplicație, identificare suprapuneri | Import manual, nu sincronizare automată; nu se creează și nu se plătesc automat lucrări |

## Date și protecții

- Tabelele `workspace_*` sunt create aditiv prin `WORKSPACE_SCHEMA`. Nu se șterg și nu se convertesc lucrări/plăți existente.
- Proprietățile aparțin utilizatorului client. Asocierea unei lucrări verifică proprietarul ambelor resurse. Crearea unei rezervări cu `propertyId` validează accesul înainte de tranzacție și salvează asocierea în aceeași tranzacție.
- Echipele aparțin firmei. Alocarea verifică firma acceptată, starea lucrării și intervalul incluzând buffer; verificarea și salvarea sunt tranzacționale.
- Mesajele sunt accesibile exclusiv clientului și contului firmei alocate. Trimiterile repetate cu aceeași cheie nu dublează mesajul; reutilizarea cheii pentru alt conținut este respinsă. Se încarcă ultimele 200 de mesaje.
- Checklistul poate fi modificat de firma alocată numai cât lucrarea este activă. Checklistul nu înlocuiește validarea obligatorie a fotografiilor din backendul existent.
- API-urile workspace folosesc autentificarea existentă cookie/Bearer, limitare de frecvență și răspunsuri `private, no-store`. Limitele sunt per proces, potrivite arhitecturii actuale; o implementare distribuită necesită un serviciu comun.
- Fotografiile de context nu mai sunt expuse firmelor înainte de alocare, nici în feed, nici prin endpointul imaginii. Excepția anterioară Nitido Scan a fost închisă conform brief-ului.
- Import iCal: maximum 1 MB / 1.000 evenimente, identitate proprietate+sursă+UID, actualizare și anulare explicită. Nu se importă numele oaspeților și nu se accesează URL-uri externe din server. Sunt acceptate date întregi sau date/ore UTC; recurențele și orele locale ambigue sunt respinse. Evenimentele absente dintr-un import parțial nu sunt șterse.
- Bugetele noi sunt salvate în bani întregi. Rapoartele folosesc valorile existente `price_gross` în lei și nu reprezintă venit net, extras bancar sau factură.
- Schimbările de proprietate, asociere, calendar și alocare sunt înregistrate în jurnalul workspace. Nu există încă un sistem complet de audit imuabil pentru toate modulele.
- Rutele private au `noindex`; stocarea offline a datelor private nu este introdusă.

## Recurență

Claim-ul apariției și avansarea planului se execută într-o tranzacție sincronă, înainte de orice apel extern. Rulările simultane nu mai generează aceeași apariție. Aparițiile ratate sunt sărite, fără rezervări în trecut. Programul folosește Europe/Bucharest, inclusiv schimbările de oră. Coloana aditivă `recurring_plans.anchor_day` păstrează ziua lunară; când nu există în luna următoare se folosește ultima zi, apoi se revine la ancora originală.

Fluxul existent de alocare/plată după generare este păstrat. Rămân necesare: orizont de generare în avans, anularea aparițiilor deja create la pauză, rezervarea capacității pentru date îndepărtate, autorizarea cardului aproape de execuție și consimțământ explicit pentru înlocuirea firmei preferate. Acestea nu trebuie declarate finalizate pe baza acestui commit.

## Validare

- Backend/web: 307 teste existente și noi trecute; încă 3 teste de acces la fotografii private trecute separat.
- Mobil: 53 teste trecute; fixture-ul de publicare folosește ceas fix pentru a nu expira odată cu data reală.
- TypeScript mobil și build Next.js verificate local.
- ESLint verificat pentru întregul repository, inclusiv fișierele mobile.
- Nu s-au efectuat plăți reale, publicare în magazine, teste pe dispozitive fizice, teste de încărcare, verificare vizuală în browser sau restaurare de backup.
- CI din pull request trebuie verificat pe commitul final, înainte de integrare.

## Publicare și revenire

1. Backup coerent al bazei SQLite și directorului de fotografii înainte de instalare; verifică procedura existentă de backup/restore.
2. Staging cu date și conturi de test, chei Stripe de test, fără notificări către clienții reali. Verifică rezervare → alocare → fotografii → finalizare → plăți, plus ecranele noi.
3. Verificare mobilă pe 360/390/430 px, tastatură, safe areas și navigare; verificare Android/iOS a versiunii Expo separat de shell-ul Capacitor.
4. Integrare în branch-ul de producție numai după aprobarea rezultatului. Workflow-ul existent de producție declanșează Coolify la push pe acel branch; acest PR nu îl declanșează.
5. La rollback de cod, tabelele noi și coloana `anchor_day` pot rămâne: versiunea anterioară le ignoră. Nu șterge datele noi pentru un rollback de interfață.
6. Resetarea globală de istoric din vechiul admin este o operație de mentenanță nesusținută de acest modul; noile chei străine pot bloca resetarea și tranzacția este anulată. Nu utiliza acest buton în producție.

## Ce mai trebuie pentru întregul brief

Organizații cu ierarhii complexe și MFA; capacitate reală pe echipă în acceptarea marketplace; recepție/reclamații cu stări financiare complete; reconciliere, SCA și gestionare robustă a autorizărilor expirate; catalog configurabil cu servicii/extras și snapshot de preț; planuri recurente cu politica financiară completă; documente fiscale și politici de aprobare pe mai multe niveluri; sincronizare PMS/iCal automată cu scheduler și tratarea schimbărilor; stocare obiecte și infrastructură distribuită; observabilitate, backup/restore demonstrat, performanță și accesibilitate verificate în browser; configurarea providerilor externi și publicarea în magazine.

Valorile comerciale, regulile de recepție și anulare, configurările fiscale și credențialele providerilor nu au fost inventate și nu au fost activate automat.

## Continuare: colaborare, angajați și aprobări

- `/echipa`: invitații nominale pentru angajați, acces numai la lucrările echipei alocate, checklist, fotografii înainte/după, sosire și raport către titularul firmei. Raportul nu finalizează financiar lucrarea. Titularul verifică în fluxul existent.
- `/colaborari`: titular, manager și vizualizare pe fiecare locație; cereri cu data și prețul calculat pe server, aprobare/respingere și creare de rezervare din aprobarea disponibilă.
- `/invitatie`: acceptare în contul cu emailul indicat. Token aleator stocat numai ca hash, expirare 7 zile, revocare. Linkul este copiat/distribuit explicit de titular; nu se trimite email automat.
- Aplicația Expo include ecranul nativ „Echipă și colaborare”, accesibil din profil. Acceptă cod/link, invită angajați sau manageri, revocă acces, încarcă fotografii de la cameră și gestionează solicitări/aprobări. Vizualizarea completă a fotografiilor și invitațiile de tip vizualizare sunt disponibile în web.
- Revocarea și realocarea echipei sunt verificate la fiecare operație, inclusiv accesul la fișierul foto. Angajatul nu primește prețuri, credite, identificatori de plată sau datele de contact ale clientului.
- Limita bugetară se activează explicit pe locație. Aprobările rezervă bugetul; rezervarea consumă aprobarea exact o dată, în aceeași tranzacție cu lucrarea și creditul. Prețul brut include creditul aplicat, fără dublare. Luna se calculează Europe/Bucharest, inclusiv la schimbarea orei.
- Schema adaugă membri, invitații, rapoarte și aprobări, plus coloana `budget_enforced`. Nu sunt șterse date existente.
- Acoperire nouă: 12 teste de autorizare, expirare/revocare, realocare, dovezi, roluri, buget, credit, consum unic, schimbarea adresei, retragerea aprobării și rollback; test mobil pentru transmiterea aprobării în rezervare.
- Aceste completări nu închid restul listei „Ce mai trebuie pentru întregul brief”. Verificarea în staging, pe dispozitive și cu Stripe de test rămâne obligatorie înainte de producție.

Validarea locală a continuării: 322 teste web/backend (320 în suita completă, apoi 12/12 din modulul de colaborare după extinderea cu încă 2 cazuri), 54 teste mobile, TypeScript web/mobil, ESLint și build Next.js. CI verifică din nou suita completă pe commitul publicat în PR.

## Etapa de verificare integrată

Rezultatele și limitele verificării sunt în [NITIDO-V3-QA.md](NITIDO-V3-QA.md). Au fost corectate controlul originii cererilor cookie, blocarea checklistului după raport, fusul orar al rezervărilor, păstrarea rezervării între login și signup și validarea completă a fișierelor imagine. Verificarea locală are acum 350 teste web/backend trecute, build și lint reușite; homepage, estimatorul și navigarea către formularele de cont au fost verificate în browser desktop. Aceste rezultate nu înlocuiesc staging cu Stripe de test, dispozitive fizice și verificarea dashboardurilor autentificate.
