# MASTER BRIEF — NÍTIDO Upgrade & NÍTIDO Pro

> **Destinat:** echipa NEXUS / ASTRA, programator AI, designer AI, QA și operatori de produs  
> **Produs:** NÍTIDO — platformă de curățenie și operațiuni pentru proprietăți  
> **Piață:** România, exclusiv  
> **Document:** brief de upgrade pentru produsul existent; nu brief de reconstrucție de la zero  
> **Versiune:** 1.1 — revizie corelată cu auditul tehnic preliminar  
> **Prioritate strategică:** controlul marjei, al calității și al recurenței; fără modificarea infrastructurii Stripe existente


# AMENDAMENTE NORMATIVE v1.1 — 24.09.2026

Aceste amendamente prevalează asupra formulărilor incompatibile din v1.0, păstrată integral mai jos pentru trasabilitate. Direcția și pregătirea auditului/reviziei au fost aprobate în conversație. Propunerile comerciale fără preț și pragurile fără valoare aprobată nu constituie configurație activă. Nicio funcție descrisă aici nu este declarată livrată doar prin existența documentului.

## A. Baza și poarta de intrare

Referință cod: Nelu251174/nitido, feat/nitido-pro-production-v11, commit 8a776e23e865fb4cba2725270e12449fd7c45605. Auditul atașat distinge cod, teste și validare live. În selecția reproductibilă de 186 teste: 119 trec, 67 eșuează; aceasta nu este suita integrală. Primul pachet este A0 — stabilizarea bazei de verificare. Nu se prezintă această stare drept aprobare de lansare.

Există deja: pricing snapshot protejat, catalog de schițe și istoric, Quality Index pentru Standard, recurență Marketplace, workspace și dosare de remediere, Pro v1.1. Se extind; nu se creează dubluri fără justificare. Catalogul de schițe NU este motor de pricing publicabil. Schema Pro NU dovedește singură că fluxurile sunt validate live.

## B. Protejarea funcțiilor existente

1. Stripe: se păstrează comportamentul efectiv aprobat și se inventariază separat codul disponibil și configurarea activă. Codul Connect existent nu se șterge și nu se activează prin acest upgrade. Nicio modificare nouă de procesator, chei, webhook, autorizare/captură, transfer sau payout fără aprobare distinctă.
2. Mobil: aplicația Capacitor existentă rămâne în scope de compatibilitate pentru fiecare etapă. Este exclusă reconstrucția unei aplicații native noi. Livrarea web, buildul mobil, disponibilitatea TestFlight și distribuția Google Play au verificări distincte.
3. Se păstrează identitatea vizuală aprobată: bara crem și intrarea Pro verde cu contur auriu; pagina și meniul mobile se verifică fără deplasare orizontală. Nu se înlocuiește navigația doar pentru că v1.0 conține un exemplu diferit.
4. Comenzile acceptate păstrează prețul, regulile și dovezile obligatorii din momentul acceptării. O nouă cerință nu blochează retrospectiv o comandă validă.
5. Proprietățile workspace și proprietățile Pro se inventariază separat; nu se mută automat istoricul între ele. Se definește ulterior o legătură explicită, numai dacă este necesară.

## C. Pricing determinist și publicabil

Fiecare serviciu are o metodă principală: pachet, m², ore sau ofertă manuală. Camerele/băile sunt factori ori suplimente explicite; nu se adună implicit toate unitățile. Prioritatea propusă este contract Pro > regulă zonă > regulă localitate > regulă națională activă; conflictele de aceeași prioritate blochează publicarea până la rezolvare.

Se definesc: perioadă de valabilitate, fus Europe/Bucharest, unitate, monedă RON, limite, cumul/excludere suplimente, ordinea discounturilor și pragului minim, regulă fiscală aprobată și rotunjire în bani întregi. Nu se aplică o cotă TVA presupusă. Costurile incluse în remunerația prestatorului nu se dublează.

Ciclu Admin: draft → validare → simulare comparativă → publicare cu dată efectivă → retragere pentru ofertele viitoare. Retragerea nu șterge versiunile sau comenzile istorice. Editările concurente folosesc control de versiune. Auditul se salvează atomic cu publicarea; dacă auditul eșuează, publicarea se anulează.

Oferta reține versiunea, componentele, totalul, expirarea și contextul. O ofertă expirată se recalculează și se reconfirmă explicit. Comanda se leagă de oferta acceptată; nu se recalculează tacit înainte de Stripe. Reîncercarea aceleiași cereri nu generează comandă/plată dublă.

Primul tarif configurabil reproduce tarifele actuale. Nu se schimbă simultan algoritmul și politica comercială. Simulatorul trebuie să arate modificările pentru tipuri de spații, praguri și geamuri; pentru configurație lipsă sau ambiguă se blochează confirmarea, nu se inventează un preț.

## D. Marjă fără dublări

Se separă valoarea serviciului, suma datorată de client, remunerația prestatorului, partea platformei și costurile suportate efectiv de platformă. Nu se confundă totalul procesat pentru serviciu cu venitul contabil NITIDO. Tratamentul fiscal se confirmă pentru modelul contractual actual înainte de activarea rapoartelor fiscale.

Exemplu de verificare fără TVA/taxe: serviciu 500 lei, discount platformă 50 lei, client 450 lei, prestator 410 lei, diferență platformă 40 lei. Discountul NU se scade din nou din cei 450 lei. Materialele și deplasarea incluse deja în cei 410 lei nu se mai scad separat.

Un cost lipsă este necunoscut, nu zero. Fiecare cost are sursă, suportator, estimat/confirmat, monedă și dată. Dashboardul marchează marja incompletă. Pragurile absolute/procentuale și cine poate aproba excepții necesită valori aprobate; nu se inventează procente din alte proiecte.

## E. Statusuri, eligibilitate și scor

Stările sunt separate: ofertare, alocare/execuție, plată, incident. Interfața compune un rezumat. Reclamația nu suprascrie faptul că execuția este finalizată; rambursarea nu șterge dovada capturii. Se mapează statusurile existente fără migrare distructivă.

Prestatorii văd oportunități anonimizate înainte de alocare și detaliile private numai după alocarea validă. Eligibilitatea se verifică server-side atât la ofertare cât și la acceptare, pe zona, serviciul, documentele, suspendările și capacitatea relevante.

Quality Index existent nu se înlocuiește direct cu un prag nou. Provider Score pornește în observare. Ponderile, perioada de observație, volumul minim, tratamentul datelor lipsă și regimul firmelor noi se aprobă înainte să afecteze alocarea. O invitație pierdută fiindcă alt prestator a câștigat nu devine refuz. Reclamațiile neconfirmate nu devin automat penalizări. Indicatorii comerciali sunt separați de cei de calitate; marja nu compensează un incident grav.

Alocarea graduală pe grupuri păstrează un singur câștigător atomic, expirare verificată pe server și jurnalul invitațiilor. Capacitatea necunoscută nu este declarată disponibilă. Excepțiile au rol autorizat, motiv și audit.

## F. Pro și modelul comercial

Se extind organizațiile, scope-ul proprietăților, aprobările, costurile, recurența și dovezile existente. Recurența zilnică din v1.0 este extensie: codul verificat suportă weekly/biweekly/monthly. Bilunar trebuie afișat fără ambiguitate ca la două săptămâni dacă aceasta este regula tehnică.

Operator NITIDO și Operator organizație Pro sunt roluri distincte. Clientul vede costurile aprobate pentru organizația lui, nu marja internă NITIDO. Viewer nu primește implicit privilegiile Financiar. Accesul la coduri sensibile se limitează la fereastra lucrării și se auditează, reutilizând mecanismul existent Pro.

Pilot propus: 3–5 portofolii eligibile într-o zonă cu capacitate verificată. Nu se promit volum, disponibilitate sau SLA înainte de configurarea echipei. Două opțiuni comerciale rămân de decis: A) coordonare inclusă pe lucrare — administrare simplă, risc de coordonare neacoperită între lucrări; B) tarif minim de administrare + servicii separate — acoperă recurența administrativă, cere ofertă și facturare explicită. B este recomandarea, fără sumă aprobată și fără activare de abonament Stripe.

Un raport CSV existent nu este amânat sau eliminat doar fiindcă exporturile apar la P1. Se verifică expunerea autorizată și câmpurile înainte de reutilizare.

## G. Etape și criterii de acceptare

| Etapă | Livrare | Condiție de închidere |
|---|---|---|
| A0 | Audit + stabilizarea testelor/migrărilor | Eșecuri investigate, fixture coerente cu schema, teste fără relaxarea invariantelor, verificări timezone și concurență |
| A1 | Pricing Admin, simulator și versiuni | Echivalență cu tariful actual, conflicte respinse, oferte istorice neschimbate |
| A2 | Ofertare manuală și marjă | Fără dublări, costuri necunoscute semnalate, excepții auditate |
| A3 | Incidente/checklisturi/eligibilitate | Permisiuni și dovezi verificate, fără penalizări premature |
| A4 | Pilot Pro | Recurență fără duplicate, aprobări corecte, acces izolat, raport client corect |
| A5 | Automatizări și raportări | Praguri aprobate și rezultate pilot, scor validat înainte de distribuție automată |

QA este transversal, nu ultima etapă. Pentru fiecare livrare: teste unitare/de integrare relevante, verificare browser pe roluri, iOS/Android, backup/restaurare și revenire la codul anterior compatibil. Datele test se identifică explicit și rămân în sandbox. Nu se fac rezervări ori plăți reale pentru validarea automată.

## H. Primul pachet concret — A0

- Izolare pe branch nou din commitul verificat; nu se suprascriu modificările locale existente.
- Inventarierea migrărilor executate separat de SCHEMA_SQL și refolosirea inițializării corecte în fixture de test.
- Investigarea erorilor schedule_generation, rooms, minimum_duration_minutes și visit_cases.
- Investigarea eșecurilor acceptării/recuperării/no-show: SQL mascat de răspuns generic, mock-uri și contractul actual; nu se schimbă logica financiară pentru a satisface teste vechi.
- Testarea calendarului cu TZ=UTC și TZ=Europe/Bucharest, ceas controlat și date viitoare reproductibile.
- Matrice înainte/după pentru cele 186 teste, plus teste țintite numai pentru riscul confirmat.
- Verificarea sandbox a Standard, Express și Pro pe roluri; accesul și datele necesare se cer numai când sunt efectiv indisponibile.
- Nu se aprobă o lansare pe baza testelor unitare singure. Eșecurile se raportează, nu se ascund prin skip sau eliminarea aserțiunilor.

Deciziile rămase sunt pragurile comerciale, tariful Pro, regulile fiscale și ponderile care afectează alocarea. Acestea nu blochează auditul, remedierea fixture-lor și simulatorul care reproduce tariful actual. Producția nu este modificată în etapa de documentare.

---
# TEXTUL DE BAZĂ v1.0 — păstrat cu amendamentele de mai sus


---

## 0. Instrucțiune de lucru

Acest document descrie un upgrade al platformei existente NÍTIDO și implementarea controlată a stratului B2B **NÍTIDO Pro**.

Echipa trebuie să înceapă prin auditarea repository-ului, a bazei de date, a fluxurilor live și a configurației existente. Nu presupuneți că o funcție există doar pentru că este menționată în acest brief; verificați implementarea înainte să o modificați. Nu eliminați, nu rescrieți și nu dublați mecanici existente fără justificare tehnică documentată.

### Reguli ferme

- NÍTIDO operează exclusiv în România.
- NÍTIDO deservește apartamente, case, vile, birouri și proprietăți închiriate / de cazare.
- Platforma existentă este baza; nu se reconstruiește un marketplace generic de la zero.
- Orașele, localitățile, zonele, serviciile și tarifele nu se hardcodează.
- **Stripe există deja și nu se schimbă.**
- Nu se înlocuiește Stripe cu alt procesator.
- Nu se migrează contul Stripe, cheile, webhook-urile sau flow-ul tehnic existent.
- Nu se implementează Stripe Connect, split payments, payout automat sau alt model nou de plată fără aprobare explicită separată.
- Noul modul de pricing poate calcula suma corectă pentru comandă; plata continuă prin fluxul Stripe existent.
- Orice modificare de preț, status, ofertă, atribuire sau incident trebuie auditată.
- Orice decizie ce schimbă modelul juridic, fiscal, comercial sau de plată se oprește și se prezintă cu minimum două opțiuni, impact, cost și risc.

---

# PARTEA I — Baza existentă și direcția corectă

## 1. Poziționare

NÍTIDO este marketplace-ul și infrastructura operațională pentru servicii de curățenie. Clientul postează sau solicită o lucrare, primește un preț / o ofertă, iar o firmă eligibilă execută lucrarea sub un flux controlat de alocare, plată, dovezi și evaluare.

NÍTIDO nu trebuie redus la un site de lead-uri. Avantajul real este controlul fluxului dintre cerere, prestator, execuție, dovada serviciului, plată și feedback.

Direcția de produs este formată din două straturi:

| Strat | Rol |
|---|---|
| **NÍTIDO Marketplace** | Curățenie punctuală sau recurentă pentru clienți B2C, gazde, proprietari și firme |
| **NÍTIDO Pro** | Produs B2B pentru portofolii de proprietăți: lucrări recurente, verificări, aprobări, dovezi, costuri și furnizori într-un flux controlat |

NÍTIDO Pro nu devine un marketplace general de reparații. Se lansează îngust și controlabil: proprietăți + curățenie + verificări + mentenanță ușoară / intervenții aprobate ulterior.

## 2. Funcții existente de păstrat și verificat

Echipa trebuie să auditeze și să păstreze, acolo unde există și funcționează, următoarele mecanici ale platformei actuale:

- Model de rezervare **Standard**, în care clientul poate compara prestatori / candidaturi și selecta firma potrivită.
- Model de rezervare **Express**, în care primul prestator eligibil care acceptă corect pe server preia lucrarea.
- Atribuire atomică / concurentă sigură pentru a evita ca două firme să câștige aceeași lucrare.
- Protecția adresei exacte și a fotografiilor private până la atribuirea lucrării.
- Statusuri operaționale pentru lucrare.
- Fotografii / dovezi de sosire și finalizare, acolo unde sunt configurate obligatoriu.
- Verificare, eligibilitate, zone de acoperire și suspendare pentru firme.
- Evaluări asociate lucrărilor reale și moderare când este necesar.
- Lucrări recurente.
- Mesagerie contextuală după atribuire.
- Stripe existent cu fluxul de autorizare, captură, plată și/sau rambursare deja implementat.
- Reguli de no-show, suport și administrare operațională.

### Cerință de audit

Înainte de implementare, echipa produce un document scurt: `NITIDO_EXISTING_SYSTEM_AUDIT.md`.

Pentru fiecare mecanică de mai sus, auditul trebuie să indice:

| Câmp | Cerință |
|---|---|
| Funcție | Denumirea mecanicii |
| Stare | Există / parțial / nu există / defectă / neconfirmată |
| Locație tehnică | Module, rute, componente, endpoint-uri, tabele relevante |
| Comportament actual | Ce face concret acum |
| Risc | Ce se poate strica dacă este modificată |
| Decizie | Păstrăm / extindem / corectăm / înlocuim doar cu aprobare |

Nicio funcție existentă nu se rescrie înainte de finalizarea acestui audit.

---

# PARTEA II — Obiective comerciale și rezultate urmărite

## 3. Obiective business

Implementarea trebuie să susțină următoarele rezultate:

1. Prețurile să poată fi actualizate fără intervenția programatorului.
2. NÍTIDO să nu confirme lucrări neprofitabile fără avertizare și justificare.
3. Lucrările atipice să nu fie subevaluate printr-un preț instant greșit.
4. Prestatorii buni să fie favorizați în alocări și Express pe baza performanței reale, nu doar a vitezei de click.
5. Reclamațiile, remediile și dovezile să fie gestionate într-un caz operațional trasabil.
6. Echipa să poată vedea performanța comercială pe comandă, prestator, serviciu, zonă și client.
7. NÍTIDO Pro să transforme clienți cu portofolii în venit recurent și relații B2B controlabile.
8. Extinderea în localități noi să se facă prin configurare de zone, servicii, reguli de tarif și prestatori, nu prin modificare de cod.

## 4. KPI-uri de produs și operațiuni

KPI-urile trebuie calculate în Admin, cu filtru de perioadă, oraș, zonă, serviciu, client și prestator.

| KPI | Definiție |
|---|---|
| Cereri noi | Solicitări trimise într-o perioadă |
| Rată conversie cerere → comandă | Comenzi confirmate / cereri eligibile |
| Timp până la ofertă | Mediana timpului dintre cerere și ofertă |
| Timp până la alocare | Mediana timpului dintre cerere și prestator confirmat |
| Rată acceptare prestator | Alocări acceptate / alocări trimise |
| Rată anulare | Comenzi anulate / comenzi confirmate |
| No-show | No-show / comenzi confirmate |
| Rată reclamații | Comenzi cu reclamație / comenzi finalizate |
| Rată remediere | Reclamații rezolvate prin remediere / reclamații |
| Rating mediu | Rating mediu verificat după finalizare |
| Valoare medie comandă | Venit brut / comenzi plătite |
| Marjă brută | Venit client minus costuri directe configurate |
| Marjă brută % | Marjă brută / venit client |
| Recurență | Comenzi recurente / comenzi finalizate |
| Valoare client | Venit și marjă cumulate per client |
| Performanță prestator | Scor compozit descris în secțiunea 9 |

Nu se declară profit net contabil din acest dashboard. Se afișează **marja brută operațională** pe baza costurilor introduse / disponibile în sistem.

---

# PARTEA III — Upgrade P0 pentru marketplace-ul existent

## 5. Motor de prețuri configurabil

### 5.1 Scop

Se implementează un modul de reguli de preț administrabil din Admin. Acesta calculează prețul afișat și suma transmisă către fluxul Stripe existent.

**Nu modifică Stripe.** Nu schimbă procesatorul, contul, cheile, webhook-urile sau arhitectura de plată.

### 5.2 Moduri de preț

| Mod | Când se aplică | Rezultat pentru client |
|---|---|---|
| Preț instant | Lucrare standard, cu parametri suficienți și reguli clare | Preț calculat și comandă publicabilă / plătibilă conform fluxului existent |
| Estimare | Lucrare cu risc moderat de variație | Interval sau estimare; NÍTIDO confirmă înainte de angajament final |
| Ofertă manuală | Post-constructor, suprafețe mari, murdărie severă, cerințe atipice, poze necesare | Cererea intră la ofertare; nu se promite preț final automat |

### 5.3 Reguli configurabile din Admin

- Serviciu și subserviciu
- Tip proprietate
- Zonă / localitate
- Preț de bază
- Tarif per oră
- Tarif per metru pătrat
- Tarif per cameră
- Tarif per baie
- Durată minimă
- Prag minim de comandă
- Cost materiale
- Cost deplasare / zonă
- Cost urgență
- Cost seară
- Cost weekend / sărbătoare
- Cost animale
- Cost grad de murdărie
- Cost geamuri
- Cost cuptor
- Cost frigider
- Cost balcon / terasă
- Cost interior dulapuri
- Alte extra-opțiuni
- TVA, dacă este aplicabil
- Discounturi și coduri promoționale
- Regulă de avans / plată, numai dacă este compatibilă cu flow-ul Stripe existent
- Condiție de ofertare manuală
- Condiție de fotografii obligatorii

### 5.4 Formula conceptuală

```text
Preț comandă =
  preț de bază
  + camere / băi / m² / ore
  + opțiuni suplimentare
  + materiale
  + deplasare
  + urgență / seară / weekend / sărbătoare
  + grad de murdărie
  - discounturi
  + TVA, dacă este aplicabil
```

### 5.5 Versionare și audit de preț

Pentru fiecare ofertă și comandă se salvează obligatoriu:

- Prețul afișat clientului
- Componentele exacte ale prețului
- Regula de tarifare și versiunea ei
- Coduri promoționale / discounturi aplicate
- Cost prestator estimat
- Motivul pentru ofertare manuală, când există
- Orice modificare manuală a prețului
- Operatorul care a făcut modificarea
- Dată, oră și motiv
- Suma transmisă către flow-ul Stripe existent
- Referința de plată și statusul primit din integrarea existentă

### 5.6 Regula plăților după ofertă

După ce o sumă este transmisă în flow-ul Stripe existent sau plata este confirmată, prețul nu poate fi suprascris tacit.

Pentru o schimbare ulterioară, sistemul trebuie să oblige operatorul să aleagă un flux explicit permis de integrarea actuală, de exemplu:

- anulare înainte de plată;
- ofertă revizuită înainte de plată;
- credit intern pentru comandă viitoare;
- rambursare numai prin mecanismul Stripe deja existent și autorizat;
- nouă comandă / diferență, numai dacă flow-ul existent și politica aprobată permit.

Programatorul nu poate inventa un nou flux Stripe pentru a rezolva o schimbare de preț.

## 6. Controlul marjei pe comandă

### 6.1 Scop

NÍTIDO trebuie să vadă dacă o comandă este comercial sănătoasă înainte de confirmare sau alocare finală.

### 6.2 Calcul operațional

```text
Marjă brută estimată =
  venit client
  - TVA, dacă este aplicabil și configurat separat
  - cost prestator
  - cost materiale
  - cost deplasare / logistică
  - discount suportat de NÍTIDO
  - cost Stripe, dacă este disponibil din integrarea existentă
  - alt cost direct configurat
```

Aceasta este **marjă brută operațională**, nu profit net contabil.

### 6.3 Funcții obligatorii

- Cost prestator introdus pe comandă sau derivat dintr-o regulă configurabilă
- Costuri directe suplimentare configurabile
- Prag minim de marjă în valoare și/sau procent
- Alertă vizibilă când marja este sub prag
- Confirmare cu justificare obligatorie pentru comandă sub prag
- Raport de comenzi sub prag
- Marjă estimată vs. marjă realizată după închiderea lucrării
- Filtru după serviciu, oraș, zonă, prestator, client, canal și perioadă

### 6.4 Interdicție

Sistemul nu va afișa „profit net” fără integrare contabilă completă și validare financiară. Denumirea corectă în MVP este `Marjă brută operațională`.

## 7. Ofertare și excepții

### 7.1 Matrice obligatorie

| Tip comandă | Metodă corectă | Cerință minimă |
|---|---|---|
| Curățenie standard | Preț instant | Parametri compleți și zonă activă |
| Curățenie generală / profundă | Estimare + întrebări | Grad murdărie, suprafață, extra-opțiuni |
| După mutare | Estimare sau ofertă | Stare proprietate, mobilat/nemobilat, fotografii când este necesar |
| Post-constructor | Ofertă manuală | Fotografii obligatorii și confirmare operator |
| Proprietate mare / vilă | Ofertă manuală sau regulă specială | Suprafață, camere, băi, acces, fotografii dacă este necesar |
| Airbnb / cazare recurentă | Tarif per proprietate + checklist | Proprietate configurată, SLA, checklist, fereastră de execuție |
| Birou recurent | Ofertă B2B / regulă contractuală | Locație, frecvență, suprafață, interval, persoană contact |
| Zonă neacoperită | Lead pentru analiză | Fără promisiune automată de preluare |

### 7.2 Beneficiu urmărit

Nu se mai acceptă ca o lucrare complexă să intre în același calculator simplu ca o curățenie standard. Acest control reduce subevaluarea, anulările, disputele și pierderile.

## 8. Express controlat

### 8.1 Principiu

Mecanismul Express rămâne. Nu se elimină și nu se transformă în alocare manuală unică.

Dar Express trebuie să prioritizeze **prestatorii eligibili și performanți**, nu doar primul click.

### 8.2 Eligibilitate Express

Un prestator poate primi / accepta lucrări Express numai dacă îndeplinește condiții configurabile:

- Este activ, aprobat și nedisponibilitatea nu este setată
- Are documentele necesare valide
- Acoperă zona și serviciul
- Are capacitate disponibilă în intervalul cerut
- Nu este suspendat sau în revizuire
- Are Provider Score peste pragul minim
- Nu are incidente grave deschise sau limitări active
- Are rata de acceptare, anulare și no-show în limitele configurate

### 8.3 Comportament tehnic

- Atribuirea rămâne atomică la nivel de server
- Sistemul nu permite două acceptări valide pentru aceeași lucrare
- Acțiunea este auditabilă
- Dacă prestatorul nu răspunde în fereastra configurată, lucrarea se propagă următorilor eligibili sau intră în intervenție operator
- Dacă nu există prestator eligibil, clientul nu primește confirmare falsă; comanda intră în status `Necesită alocare manuală`

## 9. Provider Score intern

### 9.1 Scop

Se introduce un scor intern pentru prestatori. Nu se expune public ca algoritm complet în MVP.

### 9.2 Componente recomandate

| Componentă | Măsurare |
|---|---|
| Acceptare | Alocări acceptate / alocări primite |
| Anulări | Anulări după acceptare / lucrări acceptate |
| No-show | No-show / lucrări confirmate |
| Punctualitate | Sosiri la timp / lucrări cu oră stabilită |
| Rating verificat | Medie evaluări după lucrări reale |
| Reclamații | Reclamații confirmate / lucrări finalizate |
| Remedieri | Lucrări remediate / reclamații |
| Răspuns | Timp median până la acceptare/refuz |
| Dovezi | Completitudinea și validitatea pozelor / checklisturilor |
| Capacitate | Lucrări finalizate și capacitate disponibilă |
| Marjă | Marjă operațională generată pentru NÍTIDO |

### 9.3 Reguli

- Formula și ponderile sunt configurabile de Super Admin / Manager operațional
- Scorul este folosit pentru alocări și eligibilitate Express
- Un scor mic nu suspendă automat o firmă fără regulă explicită; poate declanșa revizuire
- Operatorul poate face excepție, dar justificarea este obligatorie și auditată
- Dashboard-ul trebuie să arate motivii principali ai scăderii scorului

## 10. Incidente, reclamații și remedieri

### 10.1 Scop

Reclamația devine un caz operațional cu dovezi, termene, decizii și impact asupra prestatorului. Nu rămâne doar mesaj în chat sau notă liberă.

### 10.2 Date obligatorii pentru incident

- Număr caz / identificator
- Comandă asociată
- Client, prestator și proprietate asociate
- Categorie
- Descriere
- Fotografii / documente
- Severitate
- Dată raportare
- Proprietar intern al cazului
- Termen de răspuns prestator
- Status caz
- Decizie
- Acțiune financiară, dacă există
- Impact Provider Score
- Istoric conversație / note

### 10.3 Categorii

- Curățenie incompletă
- Întârziere
- No-show prestator
- Deteriorare bunuri
- Comportament necorespunzător
- Cost suplimentar neaprobat
- Problemă acces / chei
- Dovezi insuficiente
- Altă problemă

### 10.4 Rezoluții

- Respinsă cu motiv
- Remediere programată
- Reducere / credit intern pentru viitor
- Rambursare parțială sau totală numai prin fluxul Stripe deja existent, dacă acesta permite și utilizatorul are drept
- Penalizare prestator
- Suspendare / revizuire prestator

### 10.5 SLA intern configurabil

- Timp maxim de preluare caz
- Timp maxim de răspuns prestator
- Timp țintă pentru rezoluție
- Alertă când cazul depășește SLA

## 11. Dovezi de execuție și checklisturi

Se extinde infrastructura existentă de fotografii în dovezi operaționale configurabile.

### 11.1 Cerințe P0

- Checklist per serviciu, administrabil din Admin
- Checklist per proprietate pentru NÍTIDO Pro
- Fotografii sosire / finalizare când regula serviciului o cere
- Marcaj elemente neexecutate cu motiv
- Observații prestator
- Observații operator
- Timp de start / finalizare
- Dovezi acces, doar dacă sunt necesare și cu expunere minimă a datelor sensibile

### 11.2 Reguli date sensibile

- Codurile de acces, interfon și instrucțiunile sensibile se dezvăluie numai după alocare validă
- Prestatorul vede numai ce îi este necesar pentru lucrarea alocată
- Fotografii private nu sunt publice și au acces limitat
- Toate accesările administrative sensibile trebuie logate dacă infrastructura permite

## 12. CRM operațional pentru clienți

### Funcții P0

- Etichete configurabile: nou, recurent, VIP, corporate, proprietar portofoliu, risc ridicat, anulări repetate, blocat
- Istoric complet cereri, comenzi, plăți / referințe Stripe, evaluări, reclamații și credite
- Valoare client și marjă brută operațională cumulată
- Număr locații / proprietăți asociate
- Note interne cu autor și dată
- Blocare / limitare pentru fraudă sau abuz, cu justificare

---

# PARTEA IV — NÍTIDO Pro

## 13. Definiție și scop

**NÍTIDO Pro este sistemul de operare pentru proprietăți care centralizează lucrările recurente, verificările, aprobările, dovezile foto, costurile și furnizorii într-un singur flux controlat.**

NÍTIDO Pro este pentru:

- Proprietari cu mai multe apartamente / case / vile
- Administratori de proprietăți
- Gazde și operatori de cazare pe termen scurt
- Birouri cu lucrări recurente
- Portofolii de proprietăți eligibile

Nu este pentru un client B2C care are o singură curățenie punctuală; acel client rămâne în NÍTIDO Marketplace.

## 14. Propunere de valoare NÍTIDO Pro

| Problemă client B2B | Răspuns NÍTIDO Pro |
|---|---|
| Lucrările sunt coordonate în WhatsApp, apeluri și foi de calcul | Calendar, status, atribuiri și istoric într-un singur loc |
| Nu există dovadă clară că lucrarea a fost făcută corect | Checklisturi și fotografii înainte / după |
| Costurile sunt dispersate și dificil de urmărit | Istoric de cost per proprietate, lucrare și furnizor |
| Intervențiile suplimentare sunt aprobate necontrolat | Flux de aprobare pentru costuri / lucrări neplanificate |
| Sunt folosiți furnizori diferiți fără standard | Rețea de parteneri eligibili și Provider Score |
| Nu există raportare lunară centralizată | Raport exportabil per proprietate și portofoliu |

## 15. Poziționare UX și navigație

### 15.1 Buton / intrare publică

Butonul **NÍTIDO Pro** trebuie să fie vizibil în meniul principal desktop, între secțiunile de produs și acțiunile de autentificare / postare lucrare.

Structură recomandată desktop:

```text
[Logo NÍTIDO]  Cum funcționează  Servicii  Pentru clienți  Pentru firme  NÍTIDO Pro  [Autentificare]  [Postează o lucrare]
```

Pe mobil, NÍTIDO Pro apare în meniul principal, sus în lista de navigare și cu etichetă `Pentru portofolii și companii`.

### 15.2 Reguli de design

- Nu poziționa NÍTIDO Pro ca simplă categorie de curățenie
- Folosește diferențiere vizuală premium, dar păstrează design system-ul NÍTIDO
- CTA principal: `Solicită o demonstrație` sau `Discută cu un specialist`
- CTA secundar: `Vezi cum funcționează`
- Nu promite „property management complet” sau intervenții nelimitate
- Nu afișa preț fix public înainte de definirea ofertării comerciale; folosește calificare / contact B2B

## 16. Landing page `/nitido-pro`

### 16.1 Hero

**H1:** `NÍTIDO Pro — operațiuni controlate pentru proprietățile tale.`

**Subtitlu:** `Centralizează curățenia recurentă, verificările, dovezile foto, costurile și furnizorii într-un singur flux operațional.`

**CTA primar:** `Solicită o demonstrație`

**CTA secundar:** `Vezi cum funcționează`

### 16.2 Secțiuni obligatorii

1. Pentru cine este NÍTIDO Pro
2. Problemele pe care le elimină
3. Cum funcționează în 4 pași
4. Funcțiile principale
5. Dovezi și control de calitate
6. Costuri și aprobări controlate
7. Rețea de parteneri verificați
8. Raportare și istoric per proprietate
9. Formular de calificare
10. FAQ B2B

### 16.3 Formular de calificare

Câmpuri minime:

- Nume
- Companie, dacă există
- E-mail
- Telefon
- Rol: proprietar, administrator, gazdă, birou, altul
- Număr proprietăți / locații
- Tip proprietăți
- Localități / zone
- Servicii necesare
- Frecvență estimată
- Volum aproximativ lunar
- Problemă principală actuală
- Acord pentru contactare
- Consimțământ marketing separat, opțional și nebifat

Lead-ul NÍTIDO Pro intră în Admin cu status de calificare; nu generează automat cont Pro.

## 17. Funcționalități NÍTIDO Pro P0

### 17.1 Organizații și utilizatori

- Organizație / companie / portofoliu
- Utilizatori în organizație
- Roluri: Owner, Manager, Operator, Viewer / Financiar
- Acces limitat la proprietățile și rapoartele autorizate

### 17.2 Proprietăți și locații

- Profil proprietate
- Tip proprietate
- Adresă protejată
- Instrucțiuni de acces cu control de vizibilitate
- Contact local
- Checklist implicit
- Servicii recurente configurate
- Furnizor preferat, dacă există
- Istoric lucrări, incidente, costuri și fotografii

### 17.3 Lucrări recurente

- Frecvență: zilnic, săptămânal, bilunar, lunar sau regulă configurabilă
- Fereastră de executare
- Prestator preferat sau regulă de alocare
- Checklist per lucrare
- Alertă dacă lucrarea nu este acceptată / finalizată
- Reprogramare cu audit

### 17.4 Aprobări

- Prag valoric configurabil pentru aprobarea clientului Pro
- Cerere de aprobare pentru extra-cost sau lucrare neplanificată
- Clientul vede motiv, sumă, fotografii / dovezi și opțiunile de aprobare
- Decizie: aprobat, respins, solicită clarificări
- Toate deciziile se salvează cu dată, utilizator și comentariu

### 17.5 Raportare

- Istoric per proprietate
- Comenzi finalizate / anulate / incidente
- Cost și marjă operațională internă unde este permis rolului
- Dovezi foto
- Prestator executant
- Export CSV / PDF ulterior, dacă este aprobat
- Raport consolidat pentru portofoliu

## 18. NÍTIDO Pro Partner

Partenerii Pro sunt prestatori selectați pentru lucrări recurente și standardizate; nu sunt activați automat.

### Pagina `/parteneri-pro`

**H1:** `Devino partener NÍTIDO Pro.`

**Subtitlu:** `Lucrări recurente, calendar predictibil, standarde clare de execuție, proceduri de acces și raportare operațională.`

### Cerințe partener

- Aplicare
- Verificare identitate / entitate și documente configurabile
- Servicii și zone
- Capacitate / echipă
- Disponibilitate
- Acceptare termeni colaborare
- Perioadă de probă / verificare operațională, dacă este configurată
- Scor intern, incidente, checklisturi și SLA

### Beneficiu pentru NÍTIDO

NÍTIDO Pro Partner creează o bază stabilă de capacitate pentru lucrări recurente și reduce dependența de firme care acceptă doar ocazional.

---

# PARTEA V — UX, operațiuni și securitate

## 19. Formular de comandă Marketplace

Formularul existent trebuie auditat și extins numai unde este necesar pentru pricing, ofertare și dovezi.

### Pași recomandați

1. Serviciu și extra-opțiuni
2. Locație și proprietate
3. Dată, interval și detalii lucrare
4. Client / facturare
5. Preț instant, estimare sau cerere de ofertă
6. Flux Stripe existent, fără modificare a arhitecturii

### Date de comandă

- Adresă, localitate, județ, cod poștal
- Tip proprietate: apartament, casă, vilă, birou, spațiu comercial, cazare, altul
- Camere, băi, suprafață
- Etaj, lift, parcare
- Mobilat / nemobilat
- Animale
- Data, intervalul, flexibilitate
- Grad murdărie
- Materiale, aspirator, cerințe speciale
- Fotografii când regula serviciului o cere
- Instrucțiuni acces; datele sensibile sunt protejate

## 20. Statusuri comandă

| Status | Semnificație |
|---|---|
| Draft | Formular început, netrimis |
| Cerere nouă | Cerere transmisă |
| În afara ariei | Zonă neacoperită; lead pentru analiză |
| În analiză | Operatorul verifică |
| Necesită clarificare | Lipsesc date |
| Ofertă transmisă | Clientul trebuie să accepte |
| Ofertă acceptată | Clientul a acceptat |
| În așteptare plată | Urmează flow-ul Stripe existent |
| Plată confirmată | Confirmare din integrarea existentă |
| În căutare prestator | Căutare / selecție activă |
| Necesită alocare manuală | Express nu are candidat eligibil sau cazul cere intervenție |
| Alocată | Prestator selectat, neconfirmat |
| Confirmată | Client și prestator confirmați |
| În desfășurare | Lucrarea a început |
| Finalizată — în verificare | Dovezi / confirmare în verificare |
| Finalizată | Comandă închisă |
| Reclamație deschisă | Caz operațional deschis |
| Rezolvare în curs | Incident în analiză |
| Rambursare parțială | Numai prin mecanism Stripe existent, dacă este disponibil |
| Rambursare totală | Numai prin mecanism Stripe existent, dacă este disponibil |
| Anulată de client | Clientul anulează |
| Anulată de prestator | Prestatorul anulează |
| Anulată de NÍTIDO | Operatorul anulează |
| No-show client | Clientul nu permite lucrarea |
| No-show prestator | Prestatorul nu se prezintă |

Orice tranziție importantă este înregistrată în audit log cu autor, moment, status precedent, status nou și motiv când este cerut.

## 21. Roluri și permisiuni

| Rol | Permisiuni principale |
|---|---|
| Client Marketplace | Cereri, comenzi, date proprii, evaluări, reclamații |
| Prestator | Profil, documente, disponibilitate, lucrări alocate, dovezi, statusuri proprii |
| Operator NÍTIDO | Cereri, alocări, clarificări, statusuri, note interne; acces financiar limitat |
| Manager operațional | Prestatori, zone, prețuri, incidente, raportare operațională |
| Financiar | Referințe plată, rambursări existente, documente și rapoarte financiare |
| Super Admin | Roluri, configurări, audit log, acces complet |
| Owner Pro | Organizație, proprietăți, aprobări, rapoarte și utilizatori Pro |
| Manager Pro | Proprietăți / lucrări autorizate, fără control complet asupra organizației |
| Viewer / Financiar Pro | Vizualizare limitată la proprietăți și rapoarte autorizate |

## 22. Securitate, confidențialitate și date

### Reguli obligatorii

- Clientul vede numai comenzile, adresele și documentele proprii.
- Prestatorul vede numai lucrările alocate și numai datele necesare executării.
- Adresa exactă, codurile, interfonul și instrucțiunile sensibile se expun după alocare validă și conform nevoii operaționale.
- Fotografiile private și documentele prestatorilor nu sunt publice.
- NÍTIDO nu stochează date complete de card; se păstrează numai referințele necesare din Stripe existent.
- Parolele se stochează hashed.
- Se aplică control bazat pe roluri, rate limiting, CAPTCHA, back-up, logging și separare staging / producție.
- Consimțământul de marketing este separat de baza necesară executării serviciului.
- Cookie banner-ul și politicile de confidențialitate trebuie menținute / actualizate corespunzător.

### Interdicție de declarare

Echipa nu poate declara produsul „100% securizat”, „complet conform GDPR” sau „gata de producție” fără verificare tehnică, juridică și operațională separată.

---

# PARTEA VI — Tehnic, date și integrare

## 23. Principii tehnice

- Se păstrează arhitectura funcțională existentă când este justificat.
- Se introduc module separate și denumiri clare pentru pricing, score, incidents și Pro.
- Nu se realizează migrare distructivă fără back-up, plan de rollback și aprobare.
- Se evită logica financiară critică exclusiv în frontend.
- Calculul final al prețului și validarea regulilor trebuie să fie server-side.
- Atribuirea Express rămâne server-side și atomică.
- Accesul la date sensibile se verifică server-side.
- Toate modificările administrative critice se loghează.

## 24. Entități de date recomandate

Echipa adaptează schema la baza existentă; nu dublează entități fără nevoie.

### Marketplace și upgrade

- ServiceCategory
- Service
- ServiceAddOn
- ServiceArea
- PricingRule
- PricingRuleVersion
- Quote
- QuoteRevision
- Booking / Order
- BookingLineItem
- ProviderAssignment
- ProviderScore
- ProviderScoreEvent
- ProviderAvailability
- PaymentReference
- RefundReference
- ProviderSettlement
- MarginSnapshot
- Incident / ComplaintCase
- IncidentAttachment
- IncidentEvent
- ChecklistTemplate
- ChecklistRun
- EvidencePhoto
- InternalNote
- AuditLog
- ConsentRecord

### NÍTIDO Pro

- ProOrganization
- ProMembership
- ProProperty
- ProPropertyAccessInstruction
- ProRecurringPlan
- ProApprovalRequest
- ProApprovalDecision
- ProPortfolioReport
- ProPartnerEligibility

## 25. Stripe — reguli tehnice ferme

### Se păstrează

- Contul Stripe actual
- Integrarea actuală
- Cheile / secret management actual
- Webhook-urile actuale
- Metodele de plată active
- Autorizația, captura, rambursarea și statusurile existente, în măsura în care există și funcționează

### Este permis

- Pricing engine trimite suma validă către fluxul Stripe existent
- Comanda este corelată cu referința de plată existentă
- Statusurile primite din Stripe sunt afișate în comandă
- Costul Stripe poate fi importat / afișat dacă datele sunt deja disponibile sau pot fi citite fără schimbarea flow-ului de plată
- Rambursările folosesc numai capacitatea deja existentă și utilizatori autorizați

### Este interzis fără aprobare explicită

- Înlocuire procesator
- Migrare Stripe
- Schimbare cont, chei sau webhook-uri
- Stripe Connect
- Split payment
- Payout automat către prestatori
- Schimbarea modului de autorizare/captură
- Schimbarea unei plăți existente fără flux explicit aprobat
- Adăugarea unor taxe Stripe clientului fără regulă comercială aprobată

---

# PARTEA VII — Prioritizare și excluderi

## 26. Roadmap

| Prioritate | Livrabile |
|---|---|
| **P0 — obligatoriu** | Audit sistem existent; motor preț configurabil; versionare preț; ofertare manuală; marjă brută operațională; alerte sub prag; Express cu eligibilitate; Provider Score intern; incidente și remedieri; checklisturi; CRM operațional; roluri și audit log; dashboard operațional; fundația NÍTIDO Pro: organizații, proprietăți, lucrări recurente, aprobări și raportare de bază |
| **P1 — după P0 stabil** | Coduri promoționale extinse; segmentare avansată; SLA automatizate; raportări și exporturi avansate; notificări SMS/WhatsApp dacă infrastructura este aprobată; calendar Pro avansat; facturare/documente B2B; dashboard Pro consolidat |
| **P2 — numai după date reale** | Matching semi-automat; recomandări de prestator; aplicații mobile; integrare contabilitate; API extern; automatizări B2B extinse |
| **P3 — numai dacă este justificat** | Preț dinamic; AI pentru estimări foto; GPS live; alocare complet automată; extindere în servicii de mentenanță cu flux separat și validat |

## 27. Excluderi explicite

- Înlocuirea sau modificarea Stripe
- Stripe Connect, split payments sau payout automat
- Marketplace general de meseriași
- Multi-țară, multi-monedă
- Aplicații native iOS / Android
- Chat în timp real nou dacă mesageria contextuală existentă funcționează
- GPS live
- Licitație între prestatori
- AI care decide automat reclamații, prețuri sau prestatori
- Extindere națională automată fără densitate locală de cerere și prestatori
- Rescriere completă a platformei fără audit și aprobare

---

# PARTEA VIII — QA și Definition of Done

## 28. Scenarii QA obligatorii

### Pricing

1. O lucrare standard cu parametri compleți calculează corect prețul.
2. O lucrare cu extra-opțiuni aplică toate regulile relevante.
3. O lucrare post-constructor intră la ofertare manuală și nu promite preț final.
4. O regulă de tarif modificată nu schimbă retrospectiv prețul unei comenzi existente.
5. Orice editare manuală a prețului lasă audit trail.
6. O comandă sub prag de marjă alertează și cere justificare.

### Stripe

1. Suma trimisă flow-ului Stripe existent corespunde ofertei / comenzii aprobate.
2. O referință de plată este legată de comanda corectă.
3. Statusul primit prin mecanismul existent actualizează corect interfața.
4. Testele nu afectează plăți reale și folosesc infrastructura aprobată existentă.
5. Nu apar schimbări de cont, chei, webhook-uri sau procesator fără aprobare.

### Express și prestatori

1. Doi prestatori nu pot câștiga aceeași lucrare Express.
2. Prestator neeligibil nu vede / nu poate accepta lucrarea.
3. Prestator cu document expirat, scor sub prag sau capacitate epuizată este exclus conform regulii.
4. O excepție făcută de operator este logată cu motiv.

### Incidente și dovezi

1. Clientul poate deschide caz cu poze.
2. Prestatorul vede numai incidentul și datele aferente lucrării sale.
3. Operatorul poate stabili termen, decizie și acțiune.
4. Decizia actualizează Provider Score când regula o cere.
5. Fotografii private nu sunt accesibile altor prestatori sau publicului.

### NÍTIDO Pro

1. Un utilizator Pro vede numai organizația și proprietățile autorizate.
2. O lucrare recurentă se generează / apare corect conform frecvenței configurate.
3. O cerere de extra-cost nu poate fi executată ca aprobată fără decizia clientului, când pragul cere aprobare.
4. Raportul proprietății afișează lucrări, dovezi și costuri autorizate.
5. Datele de acces sunt vizibile doar în contextul lucrării alocate.

## 29. Definition of Done

O funcționalitate este considerată livrată numai dacă:

- Este implementată în repository și nu doar prezentată ca mockup.
- Respectă rolurile și permisiunile.
- Are validare server-side pentru regulile critice.
- Are tratare de erori și mesaje clare pentru utilizator.
- Este testată pe desktop și mobil.
- Este testată pentru rolurile relevante.
- Lasă audit trail când acțiunea este financiară sau operațională critică.
- Nu modifică Stripe în afara permisiunilor din acest document.
- Are documentație de operare pentru Admin, dacă schimbă un flux operațional.
- Are test / scenariu QA documentat.
- Nu introduce regresii în funcțiile existente confirmate în audit.

---

# PARTEA IX — Livrabile și handover

## 30. Livrabile obligatorii

1. `NITIDO_EXISTING_SYSTEM_AUDIT.md`
2. PRD / plan tehnic corelat cu acest brief și cu repository-ul real
3. Inventar de fișiere / module create sau modificate
4. Migrații de bază de date și plan de rollback
5. Implementare P0
6. Documentație Pricing Admin
7. Documentație Provider Score și reguli de eligibilitate Express
8. Documentație Incidents / Complaints
9. Documentație NÍTIDO Pro Admin și utilizator Pro
10. Ghid QA și rezultate testare
11. Document privind punctele de integrare cu Stripe existent, fără schimbarea Stripe
12. Backlog P1/P2 cu motivul amânării fiecărei funcții
13. Plan de deploy staging → producție
14. Plan de back-up și restaurare
15. Transfer complet de acces la cod, repository, hosting, bază de date, analytics, e-mail și configurările necesare către proprietarul NÍTIDO

## 31. Format obligatoriu de raportare al echipei

La finalul fiecărei etape, echipa livrează un raport scurt cu:

- Ce a fost verificat
- Ce a fost modificat
- Fișiere / module afectate
- Decizii luate și ipoteze
- Teste rulate și rezultate
- Riscuri / limitări
- Ce nu a fost implementat
- Orice nevoie reală de aprobare înainte de etapa următoare

---

# PARTEA X — Instrucțiunea finală

Construiți pe fundația existentă. Nu reconstruiți NÍTIDO ca un marketplace generic și nu propuneți alt procesator de plată.

Ordinea corectă de execuție este:

1. Audit sistem existent
2. Pricing configurabil și auditabil
3. Marjă și control al comenzilor neprofitabile
4. Express bazat pe eligibilitate și performanță
5. Provider Score
6. Incidente, remedieri și dovezi operaționale
7. CRM și dashboard de business
8. NÍTIDO Pro pentru portofolii eligibile
9. QA, documentație și lansare controlată

Succesul nu este un UI nou. Succesul este ca NÍTIDO să poată confirma lucrări profitabile, să selecteze mai bine prestatorii, să gestioneze problemele documentat și să convertească portofolii de proprietăți în venit recurent — fără să compromită funcțiile deja construite și fără să atingă Stripe.
