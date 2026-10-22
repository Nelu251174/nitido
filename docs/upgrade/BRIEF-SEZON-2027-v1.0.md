# NÍTIDO — pregătire primăvară / vară 2027

Versiune 1.0 · 22 octombrie 2026 · mandat: implementare, verificare, apoi publicare LIVE numai după VERDE.

## Rezultatul urmărit

Clientul configurează o lucrare completă, revine la o rutină și găsește disponibilitate reală. Firma vede calendarul, intervalele declarate și conflictele înainte de a accepta. Organizarea și numărul lucrătorilor trimiși aparțin firmei.

Sursa de pornire: `432d4f90ba37ee1cf18489117d20cc59e6a2a19a`. Se reutilizează infrastructura, configuratorul, recurențele, calendarele și controalele existente. Nu se construiește altă platformă sau alt mediu de staging.

## Loturile de implementare

### 1. Pregătește casa pentru primăvară

- Intrare vizibilă cu NEW din noutățile publice și contul clientului.
- Pagină dedicată care folosește configuratorul și catalogul activ existente: spațiu, suprafață, băi, geamuri opționale, data/ora sau flexibilitate, rezumat.
- Lista serviciului general și delimitarea cerințelor speciale sunt vizibile. Nu se promite că geamurile, renovările sau orice alt supliment sunt incluse gratuit.
- Butoanele înainte/înapoi/modificare păstrează selecțiile; continuarea transferă datele către cererea existentă. Simpla configurare nu creează lucrări, nu notifică firme și nu autorizează cardul.
- Prețurile curente sunt estimate în configurator și reverificate de server la publicarea cererii. Nu se activează un pachet comercial sau o reducere nouă.

### 2. Rutina casei mele

- Intrare dedicată în cont și în noutăți. Se reutilizează același modul de recurențe în dashboard și în pagina dedicată.
- Creare: proprietate sau adresă, băi, instrucțiuni, frecvențe existente, prima dată/ora, sfârșit opțional și firmă preferată eligibilă.
- Gestionare: următoarele date, vizite existente, modificarea programului, previzualizarea impactului pauzei de vacanță, pauză/reluare/oprire și eliminarea pauzei.
- Nicio anulare implicită a vizitelor existente, nicio regenerare tacită și nicio alocare garantată firmei preferate. Confirmările comerciale existente se păstrează.
- Orele și limitele de zi folosesc Europe/Bucharest. Eșecul încărcării are reîncercare explicită și nu produce o listă prezentată fals ca fiind completă.

### 3. Planificarea firmei

- Intrare NEW în meniul firmei și lângă publicarea intervalelor.
- Vedere pentru șapte zile, cu navigare în perioade viitoare: lucrări acceptate/începute, intervale declarate, verificarea publicării și indisponibilități ale echipelor proprii.
- Se includ durata și deplasarea din regulile existente. Conflictele, intervalele în verificare și lucrările fără program valid sunt avertismente explicite.
- Datele vin exclusiv din contul firmei autentificate. Nu se publică datele sau adresele clienților în acest sumar.
- Planificarea este citire. Linkurile deschid calendarul, echipele și formularul existent de intervale; nu acceptă lucrări, nu alocă oameni și nu modifică limitele de capacitate.
- Nu se afișează profit estimat fără costuri validate și nu se echivalează intervalul declarat cu o rezervare garantată.

### 4–7. Extensii ulterioare, cu loturi și acceptanță separate

4. Locuința pregătită pentru oaspeți: extinderea modulului existent de închirieri, termen înainte de sosire, checklist pe proprietate, raport de predare și avertizare pentru ferestre prea scurte.
5. Modificări fără surprize: propunere documentată, diferență de preț și aprobare explicită înainte de execuția suplimentelor. Analiza impactului asupra HOLD și a plății precedă implementarea; nicio modificare Stripe implicită.
6. Rezolvăm problema: extinderea remedierilor existente cu problemă structurată, dovezi, responsabil și stare urmăribilă pentru ambele părți.
7. Planul casei pentru tot anul: recomandări opționale folosind servicii efectiv disponibile; fiecare rezervare și notificare cere confirmările și acordurile aferente.

Aceste loturi rămân în calendarul de produs; nu se declară implementate prin livrarea primelor trei.

## Consolidare pentru scalare

- Pilot cu firme și intervale reale; fără date, aprobări sau disponibilități inventate. Extinderea orașelor depinde de oferta validată.
- Matrice mobil/web pe roluri, sesiuni existente, revenire din fundal, navigare din notificări și actualizare.
- Teste de concurență, deduplicare, erori de rețea, volum și recuperare; pragurile se stabilesc după măsurarea infrastructurii și traficului.
- Backup extern serverului și restaurare verificată: se inventariază mai întâi configurația disponibilă, destinația și retenția. Backupul pe același volum nu dovedește protecția la pierderea serverului.
- Indicatori: conversie în rezervare finalizată, timp până la candidatură/alegere, revenire, anulare, remedieri și câștiguri efective. Nu se inventează obiective sau rezultate comerciale.

## Invariante

Prețurile și comisionul actual rămân intacte. HOLD la acceptarea lucrării și capturare la finalizarea validă; fără rescrierea lucrărilor acceptate sau a integrării Stripe. Fără plăți, capturi, transferuri, rambursări ori notificări de probă către utilizatori reali. Testele folosesc date sintetice și dovezi anonimizate. Citirile nu produc mutații.

## Poarta de publicare

VERDE necesită toate verificările aplicabile trecute pentru exact aceeași versiune:

1. Inventarul rutelor, butoanelor și acțiunilor din lot; teste pozitive, erori, revenire, dublă apăsare și autorizare pe rol/proprietar.
2. TypeScript, lint, build de producție și suita de regresie relevantă pentru rezervare, preț, recurențe, calendar, capacitate și plata existentă în mediu de test.
3. Test interactiv în browser pentru fiecare control nou/modificat; desktop 1366/1920 și telefon 360/390/430, fără suprapuneri și cu focus/tastatură verificat.
4. Test pe aplicațiile oficiale Android și iOS: autentificare, navigare, fundal/revenire, păstrarea formularului și deschiderea destinațiilor. Dovada web nu înlocuiește proba nativă.
5. Regresie generală a funcțiilor existente: inventar separat și dovezi; zonele neacoperite sunt NETESTATE, nu TRECUTE prin presupunere.
6. Backup și revenire pregătite înaintea publicării; după publicare se verifică sănătatea și fișierele livrate și se repetă testele de fum.

Orice test fără acces este BLOCAT; unul neexecutat este NETESTAT. O probă automată sau existența butonului nu justifică singură VERDE. Publicarea LIVE rămâne oprită cât timp există blocaje în acceptanța lotului. Modificările independente și pregătirea lor continuă.

## Livrabile

Cod în PR reviewabil, acest brief Markdown, matrice control → test → rezultat → dovadă, rezultate automate, lista blocajelor și plan de revenire. Raportul distinge pregătit local, construit în mediul de test, verificat interactiv, publicat LIVE și publicat în magazine.

## Calendar de produs

Noiembrie–decembrie 2026: consolidare și pilot. Ianuarie–februarie 2027: primele trei loturi validate. Martie–aprilie: extindere controlată. Mai–iunie: proprietăți de vacanță și pregătirea între sejururi. Datele sunt ținte de planificare, nu promisiuni de publicare înaintea acceptanței.
