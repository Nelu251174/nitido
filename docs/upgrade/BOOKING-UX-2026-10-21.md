# NÍTIDO — update rezervare și prezentare publică, 21.10.2026

Mandat: `BRIEF-NITIDO-UPDATE.md`, v1.0, executarea autorizată în conversație. Bază LIVE: `448f2b5e6e5297e4f5c8dc1bcdbcc4fa06d0bf48`. Domeniu: website existent, fără reconstrucție și fără actualizarea binarelor din magazine.

## Implementare și verificare

| Cerință | Implementare | Dovezi și limite |
|---|---|---|
| UX-01 | CTA „Calculează prețul” vizibil prin regula mobilă; Pro în meniu/secțiune, fără banda de sus; vizitatorul are „Rezervă”, conturile păstrează lucrări/mesaje; spațiu de siguranță și navigare ascunsă la focus în câmp | `page.tsx`, `mobile-layout.css`; funcționalitatea intrării testată în `BookingUx.test.ts`. Verificarea vizuală 320/360/390/430 și tastatura fizică rămân NETESTATE fără control interactiv al browserului. |
| UX-02 | Home: localitate, spațiu, suprafață; data în pasul Programare; GPS doar la acțiune; draft public separat de draftul privat al contului, recuperat în aceeași filă/sesiune; avertizare disponibilitate și contact/evaluare | Teste DOM pentru transfer, refuz GPS, înapoi/continuă/reîncărcare; teste whitelist și stocare indisponibilă. Pagina SEO a orașului nu reprezintă confirmare de acoperire. |
| UX-03 | Panou compact în fluxul documentului, înaintea conținutului; nu este un strat fix peste formular/navigare. Refuz/accept explicite, redeschidere din footer, aceeași durată existentă de 180 zile | Test DOM refuz/redeschidere/accept, `googleAds.test.ts` pentru lipsa scriptului înaintea acordului și eliminarea informațiilor private din URL. JSDOM nu dovedește aspectul sau traficul unui telefon real. |
| UX-04 | Aceiași trei pași; subtotaluri distincte, credit verificat în cont, disponibilitate explicită; includeri/evaluare la fiecare pas; explicații extensibile; erori lângă câmp și focus; progres la continuarea în cont | `BookingConfigurator.tsx`, teste DOM, păstrare după refresh inclusiv în prezența parametrilor URL inițiali. Publicarea finală rămâne în fluxul existent din cont, cu deduplicare pe server verificată de suita API. |
| UX-05 | Standard = alegi dintre firme interesate la preț fix; Express = disponibilitate, fără promisiune de sosire; supliment Express obișnuit 0 lei, afișat; Express60 existent este separat | Nu s-au modificat tarifele, comisionul, alocarea, HOLD/capturarea sau comenzile acceptate. 80 m²: 550 lei; +10 m² geamuri: 630; +o baie suplimentară: 680. |
| UX-06 | Șase FAQ esențiale, ghid complet accesibil din Contact; verificarea firmei explicată, fotografii comerciale etichetate ilustrativ, agregate numai din date existente; eticheta „Încredere & Siguranță” corectată; acces Pro separat | Nu s-au inventat recenzii, numere sau lucrări. Publicarea unor noi fotografii/exemple reale rămâne BLOCATĂ până la dovada dreptului de publicare. |
| UX-07 | Același sitemap/robots/canonice; conținut contextual pentru cele opt orașe; CTA local cu localitatea transferată; componenta ghidului complet nu mai este randată pe homepage; acces la Contact (catalogul global de traduceri rămâne în document) | Costul inițial HTTP este măsurat în jurnalul release-ului. LCP/CLS/INP și indexarea efectivă în Search Console rămân NETESTATE; nu sunt deduse din dimensiunea HTML sau din HTTP 200. |
| PRO-01 | Titlu comercial, eligibilitate lângă titlu: minimum 5 proprietăți, Constanța/Mamaia/Mamaia-Sat, după evaluare; demonstrație marcată DEMO; platformă distinctă de prestatori; pilot/manual/contractual păstrate | Pagina existentă și catalogul pilot, fără noi prețuri, integrări sau plăți automate. Demonstrația nu conține adrese sau acces la clienți reali. |
| PRO-02 | Același formular; detaliile suplimentare opționale; validare, progres, timeout, cheie stabilă la retry, tranzacție idempotentă pe server, referință reală; notificare operațională durabilă prin mecanismul Pro existent | Test API concurent/retry de 8 ori: aceeași referință și un singur lead; 409 la reutilizarea cheii cu alt conținut. Sender simulat, fără email real de test. Confirmarea primirii în inbox extern rămâne NETESTATĂ. |

## Butoane și efecte

- Calculează prețul / Rezervă → `/rezervare`; nu publică și nu plătește.
- Folosește locația mea → cere GPS numai la click; alternativa manuală rămâne disponibilă.
- Continuă la programare / Verifică rezervarea → validează și schimbă pasul.
- Înapoi → păstrează selecțiile; datele invalide sunt recuperabile și nu produc o confirmare falsă.
- Continuă în cont → deschide fluxul existent cu context; nu confirmă o lucrare.
- Solicită evaluare → fluxul existent `/client/evaluari`, cu localitate/suprafață.
- Cum funcționează plata / Condițiile rezervării → deschid explicațiile, fără operațiune financiară.
- Solicită evaluarea portofoliului → formularul Pro; confirmarea afișează referința numai după răspunsul serverului.
- Vezi demonstrația → exemplu fictiv vizibil, nu contul unui client.
- Progres rezervări → `/admin/raport-rezervari`, numai roluri cu permisiune de rapoarte.

## Măsurare

Evenimente de configurare: `start`, `space_valid`, `schedule_valid`, `summary_view`, `account_requested`, `field_error`. Colectarea începe numai după acord, numai pe website-ul LIVE; nu blochează rezervarea. Identificator aleator pe filă, clasă mobil/desktop și categorie de câmp, fără valorile câmpurilor, adresă, localitate, email, fotografii, card sau parametrii URL. Retry deduplicat și pe server.

Raportul diferențiază:

1. **Sesiuni cu acord**: aceeași filă de browser, nu persoane unice; un eveniment/categorie de eroare pe sesiune. Datele încep cu update-ul; lipsa lor nu înseamnă zero rezervări.
2. **Cereri**: număr distinct de înregistrări create în perioada aleasă, confirmate de server, indiferent de consimțământ. Alocate/finalizate = starea curentă a aceleiași cohorte, nu numărul operațiunilor făcute în acea zi.
3. **Solicitări Pro**: înregistrări confirmate de server în perioadă.

Rata dintre două etape necesită aceeași cohortă de sesiuni: sesiuni care au atins ambele / sesiuni care au atins prima. Raportul inițial afișează volume, fără a inventa rate între cohorte sau între sesiuni cu acord și toate cererile. Nu numără utilizatori unici. Comparația trebuie să menționeze perioadele, volumul, dispozitivele și campaniile; nu se atribuie update-ului o creștere nedemonstrată.

## Continuitatea backlogului

| Domeniu | Stare verificată automat pe candidat | Dovezi |
|---|---|---|
| Operator / Manager / Financiar / Super Admin | Existent și testat la nivel de permisiuni; fără migrare de roluri | `api/admin/internalRoles/route.test.ts`, `api/pro/internalRoles.test.ts` |
| Reguli foto și acces | Existent și testat automat; regulile istorice divergente nu au fost schimbate prin acest update | `proofOfWork`, `proofSecurity`, `pro/propertyChecklists`, `collaborationAccess` |
| Dashboard/rapoarte | Existent; raport nou de progres cu definiții separate. Parțial: verificare administrativă interactivă și atribuirea completă între sesiune și cerere neexecutate | `api/admin/operational-report/route.test.ts`, `pro/portfolioReport.test.ts`, `api/booking-funnel/route.test.ts` |
| Incidente | Existent și testat automat; nicio decizie reală executată | `incidentReview.test.ts` și testele API incidente |
| Express/capacitate/acceptare unică | Existent și testat automat; algoritmul nu este modificat | `acceptJob.test.ts`, `acceptJobRecovery.test.ts`, teste eligibilitate/capacitate |
| Izolare Pro/recurențe/aprobări/costuri | Existent și testat automat; nu s-au activat recurențe sau plăți | `pro/core`, `pro/dailyRecurring`, `pro/portfolioReport`, teste interne API |

„Testat” în acest tabel se referă la teste automate cu date sintetice. Nu reprezintă o inspecție a tuturor conturilor sau lucrărilor din producție.

## Release și revenire

Se folosește sandbox-ul existent `civaeb8joydtchvzlen6pivq`, apoi aplicația LIVE `zxnelxi2cejranyvfpw0scac`. Pinii și rezultatele exacte sunt în raportul de execuție. Nu se creează un mediu nou.

Înaintea publicării: checkpoint SQLite online coerent, verificare hash fotografii, restaurare izolată și integritate/FK. După publicare: verificări HTTP și comparație numai în citire a câmpurilor comerciale ale tuturor comenzilor/plăților din checkpoint. Fără plăți, comenzi sau mesaje reale de test.

Acest update nu schimbă schema. Folosește tabelele Pro existente pentru deduplicare, evenimente și coada notificării, cu spații de identificare separate. Workerul existent de notificări reîncearcă cel mult o alertă Pro per execuție, cu cheie idempotentă; nu reia lead-uri istorice. Livrarea incertă nu se reîncearcă automat după fereastra furnizorului.

Revenire: repinarea aplicației LIVE la `448f2b5e6e5297e4f5c8dc1bcdbcc4fa06d0bf48` și redeploy. Nu se restaurează un backup vechi peste date noi; înregistrările create după update trebuie păstrate. Candidatul nu schimbă procentul comisionului, condițiile financiare, snapshots sau comenzile acceptate.
