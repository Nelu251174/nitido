# BRIEF NÍTIDO — revenire clienți și disponibilitate reală

**Versiune:** 1.0 · **Data:** 22 octombrie 2026  
**Livrabil:** brief de implementare pentru website și aplicațiile oficiale iOS/Android. Acest document nu constituie dovadă că funcțiile descrise mai jos sunt deja publicate.

## 1. Obiectiv

Clientul mulțumit să poată solicita din nou firma cunoscută, să pregătească ușor o nouă rezervare și să afle când apare un interval potrivit. Disponibilitățile afișate trebuie să provină de la firme reale, verificate, cu calendar valid.

Se lucrează în loturi mici pe infrastructura existentă, cu backup verificat, publicare controlată, dovezi și plan de revenire. Nu se solicită redesign, reconstruirea platformei sau un nou mediu de staging.

## 2. Baza existentă și diferența cerută

Verificarea sursei disponibile identifică:

| Domeniu | Există deja în cod | Extinderea din acest brief |
|---|---|---|
| Firma preferată | Selectarea unei firme verificate cu care clientul a finalizat o lucrare, în planurile recurente | Preferințe ușor accesibile și solicitarea firmei pentru o rezervare individuală |
| Rezervă din nou | Deschiderea formularului precompletat din proprietate | Pornire dintr-o lucrare finalizată, cu verificarea datelor și preț actual |
| Intervale libere | Publicare de către firme, verificare administrativă, verificarea calendarului și pilot într-un oraș | Pornirea pilotului cu ofertă reală și măsurarea rezultatelor |
| Alertă de disponibilitate | Nu a fost identificată o implementare a abonării la intervale în căutarea țintită | Abonare explicită, potrivire, notificare și dezabonare |

Acestea sunt constatări despre codul inspectat, nu teste complete ale fiecărui flux LIVE. Înaintea modificării se reconfirmă sursa efectiv publicată și se reutilizează implementările existente.

## 3. Lotul 1 — „Firma mea preferată”

### Experiența clientului

- În detaliul unei lucrări finalizate și în zona de evaluare apare **„Salvează firma la preferate · NEW”**. Salvarea preferinței este independentă de acordarea unei recenzii pozitive.
- Zona **„Firmele mele preferate · NEW”** este accesibilă din Acasă și din meniul contului, inclusiv pe telefon.
- Clientul poate salva/elimina preferințe și poate alege o firmă pentru o cerere nouă.
- Acțiunea **„Solicită din nou această firmă”** deschide formularul. Invitația se trimite prin fluxul existent numai după publicarea explicită a cererii de către client.
- Sunt eligibile firmele verificate cu care acel client a finalizat o lucrare. La fiecare solicitare se reverifică starea firmei, acoperirea, serviciul și disponibilitatea.

### Reguli

- Preferința nu înseamnă alocare, rezervare de capacitate sau acceptare automată.
- Firma confirmă prin mecanismul existent de candidatură/acceptare; clientul păstrează alegerea și confirmările comerciale existente.
- Dacă firma refuză, este suspendată sau nu mai poate acoperi cererea, se explică situația și se oferă acces la alternative, fără înlocuire tacită.
- Salvarea/eliminarea preferinței nu trimite notificări firmei și nu modifică planuri recurente sau lucrări deja acceptate.
- Nu se introduc taxe, reduceri sau promisiuni de prioritate garantată.

## 4. Lotul 2 — „Rezervă din nou” din istoricul lucrărilor

- Pe fiecare lucrare finalizată eligibilă apare **„Rezervă din nou · NEW”**, vizibil în listă și în detaliu.
- Se deschide o cerere nouă, precompletată cu tipul serviciului, suprafața, băile, geamurile și instrucțiunile de curățenie reutilizabile.
- Proprietatea/adresa este reutilizată numai dacă aparține încă acelui client. Modificările actuale ale proprietății se arată pentru verificare; o proprietate arhivată/indisponibilă cere o selecție nouă.
- Data și ora se aleg din nou. Nu se copiază programarea trecută, disponibilități expirate sau alocarea veche.
- Se calculează prețul actual pe server și se afișează înaintea confirmării. Tariful, creditul folosit și reducerile lucrării vechi nu se tratează ca ofertă valabilă pentru cererea nouă.
- Nu se copiază coduri de acces, fotografii private, consimțăminte, invitații către beneficiari, autorizări de card, plăți sau identificatori ai operațiunilor vechi.
- Clientul poate solicita firma anterioară dacă este eligibilă conform lotului 1.
- Apăsarea butonului nu publică o lucrare și nu autorizează cardul. Publicarea și plata urmează confirmările existente; apăsările repetate nu trebuie să creeze duplicate.
- Lucrarea originală și raportul ei rămân intacte.

## 5. Lotul 3 — pilot cu intervale reale

- Se inventariază firmele verificate, orașele acoperite, serviciile active și intervalele publicate.
- Se propune orașul cu ofertă reală eligibilă; administratorul confirmă activarea prin mecanismul existent. Nu se aleg firme sau orașe pe baza unor date presupuse.
- Firma declară intervalele pe care le poate acoperi. Se verifică durata serviciului, limitele intervalului, deplasarea, blocajele și calendarul, folosind regulile existente.
- Organizarea și numărul oamenilor trimiși aparțin firmei. Clientului i se prezintă serviciul, programul și prețul; nu i se cere să aleagă efectivul echipei.
- Numai intervalele active și aprobate pot fi afișate. Disponibilitatea se reverifică la căutare, la deschiderea cererii și la confirmarea prin fluxul existent.
- Lipsa intervalelor produce un mesaj sincer și opțiunea de căutare/rezervare obișnuită.
- Retragerea unui interval împiedică cereri noi pentru acel interval, fără anularea implicită a lucrărilor deja acceptate.
- Fără firme/intervale eligibile, activarea pilotului rămâne **BLOCATĂ de lipsa ofertei reale**. Celelalte loturi continuă.

## 6. Lotul 4 — „Anunță-mă când apare un loc”

### Abonare

- În căutarea fără rezultate apare **„Anunță-mă când apare un loc · NEW”**.
- Clientul autentificat confirmă localitatea, serviciul, datele și intervalele acceptabile, suprafața și parametrii necesari calculului duratei. Fus orar: **Europe/Bucharest**.
- Alege explicit canalul dintre cele configurate și funcționale: notificare în cont, push și/sau e-mail. Nu se înscrie automat la marketing și nu se activează un canal fără acordul corespunzător.
- Vede alertele active, le poate opri și vede data expirării. Alertele expiră la încheierea perioadei cerute; criteriile duplicate nu creează abonări duplicate.

### Potrivire și notificare

- Se notifică numai intervale reale, aprobate și compatibile cu durata și serviciul cerut. Un interval retras, ocupat, expirat sau al unei firme neeligibile nu trebuie notificat.
- Mesajul spune **„A apărut un interval potrivit”**, nu „Rezervarea este confirmată”. Alerta nu ține locul și nu garantează că va mai fi liber la deschidere.
- Linkul deschide rezultatul relevant în aplicație sau pe website, păstrând criteriile. Serverul reverifică disponibilitatea; un rezultat expirat are alternativă clară.
- Se reutilizează infrastructura de notificări existentă, cu evidență persistentă, deduplicare, limitare de frecvență și reluare controlată după erori.
- Se trimite cel mult o alertă per abonare și apariție relevantă a unui interval, cu plafon implicit de **o notificare de disponibilitate pe zi per client**, cumulat între canale. Intervalele suplimentare se grupează în aceeași informare. Notificările operaționale existente nu intră în acest plafon.
- Notificările de pe ecranul blocat nu includ adresa completă, fotografii, coduri de acces sau date despre alte persoane. Dezabonarea oprește și mesajele încă netrimise; nu se livrează notificări de test utilizatorilor reali.

## 7. Vizibilitate pe telefon și website

- Fiecare extensie are intrare clară cu **NEW** în locul unde este folosită; nu se ascunde exclusiv într-un meniu secundar.
- Zona de noutăți se deschide și din paginile contului, nu doar din homepage-ul public. Se păstrează accesul separat pentru Client, Firmă și Administrator.
- Pe ecran îngust: fără suprapunerea barei de navigare, fără text tăiat, cu butoane accesibile tactil și etichete pentru cititoarele de ecran.
- Se testează sesiuni deja deschise, revenirea din fundal, navigarea din notificare și reîncărcarea după publicare. Existența unui link în HTML nu dovedește că este vizibil și utilizabil în aplicație.
- Corecțiile web și pachetele native se raportează separat. Dacă este necesar un pachet nou, se respectă verificările de release existente; trimiterea la magazin, evaluarea și publicarea sunt stări distincte.

## 8. Invariante comerciale și de securitate

- Se păstrează **HOLD la acceptarea lucrării** și **capturarea la finalizarea validă**, integrarea Stripe, prețurile și procentul actual al comisionului.
- Nu se rescriu lucrări acceptate, plăți, alocări, disponibilități confirmate sau planuri recurente pentru a introduce aceste funcții.
- Preferințele și alertele sunt accesibile doar proprietarului contului; validarea identității și a drepturilor se face pe server.
- Mutațiile cer verificarea originii, limitare de frecvență și protecție la concurență/dublă apăsare. Cererile de citire nu produc rezervări, plăți sau notificări.
- Migrările sunt aditive și idempotente. Backupul include baza și fișierele relevante, cu verificarea restaurării.
- Nu se fac plăți, capturi, rambursări, ștergeri sau notificări către utilizatori reali pentru demonstrarea testelor.

## 9. Acceptare și dovezi

| Domeniu | Scenarii obligatorii |
|---|---|
| Preferate | Salvare/eliminare; firmă fără lucrare comună refuzată; acces la preferințele altui client refuzat; firmă suspendată; refuz/indisponibilitate; alternativa cere alegere explicită |
| Rezervă din nou | Date eligibile precompletate; preț recalculat; dată nouă; proprietate arhivată; date private nepreluate; zero operațiuni comerciale la simpla deschidere; fără duplicate |
| Disponibilități | Durată și deplasare; limite de zi/săptămână și schimbarea orei; suprapuneri; serviciu/oraș incompatibil; interval retras; două solicitări simultane |
| Alerte | Acord explicit; expirare/dezabonare; potrivire reală; deduplicare și plafon zilnic; erori și reluare; dezabonare în timp ce mesajul este în așteptare; link expirat |
| Mobil/web | Butoane NEW vizibile la lățime de telefon; navigare completă pe roluri; sesiune existentă; revenire din fundal; link din notificare; limite de acces păstrate |

Fiecare rezultat **TRECUT** include versiune, mediu, pași, rezultat și dovadă anonimizată. **NETESTAT** și **BLOCAT** se mențin distincte. Pentru iOS și Android se atașează separat dovezile de pe dispozitiv; buildul și testele automate nu le înlocuiesc.

## 10. Ordine și livrare

1. Inventar țintit, sursă LIVE, backup și confirmarea punctelor de integrare existente.
2. **Lotul 1:** preferate și solicitarea firmei pentru lucrare individuală.
3. **Lotul 2:** rezervare nouă dintr-o lucrare finalizată.
4. **Lotul 3:** ofertă reală și activarea pilotului prin verificarea administrativă existentă.
5. **Lotul 4:** alerte de disponibilitate, activate numai după verificarea potrivirii și livrării pe conturi sintetice.

Lipsa ofertelor din pilot nu oprește implementarea loturilor 1–2 sau pregătirea lotului 4. Configurarea unui canal lipsă nu se confundă cu permisiunea de a trimite mesaje reale.

După fiecare lot se livrează: sursa publicată, ce funcționează efectiv, testele executate, limitele rămase și planul de revenire. O oprire de urgență dezactivează funcția nouă și mesajele ei, păstrând datele și rezervările existente. Nu se restaurează automat o bază veche peste tranzacțiile apărute între timp.

### Indicatori de urmărit

Numărul de preferințe salvate, cererile individuale către firma preferată, deschiderile și finalizările rezervărilor repetate, intervalele reale publicate/acceptate, alertele livrate/deschise și rezervările confirmate provenite din alerte. Se disting intenția, publicarea cererii, acceptarea și plata; nu se numără simplul clic drept conversie finală.

## 11. Referințe inspectate

- `src/components/ClientOverview.tsx` și `docs/NITIDO-EARNINGS-REBOOK-SOUND.md`: rezervare repetată din proprietate.
- `src/lib/recurring.ts`, `src/app/client/page.tsx`, `src/app/api/workspace/route.ts`: firma preferată pentru recurență.
- `src/lib/weeklyAvailability.ts` și `src/app/api/availability/week/route.ts`: intervale și verificarea eligibilității.
- `src/lib/bookingDraft.ts`: reconstrucția controlată a ciornei, fără refolosirea stării plății.

**Starea acestui livrabil: BRIEF PREGĂTIT.** Implementarea, testarea, publicarea LIVE și publicarea în magazine se vor consemna prin dovezi separate, pe lot.
