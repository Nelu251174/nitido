# Brief master furnizat de beneficiar — transcriere integrală

Sursă: NITIDO_Brief_Master_Update_v1_0(1).docx. Text extras fără modificarea cerințelor.

01  Mandatul proiectului

NITIDO Brief master pentru modernizarea platformei

Beneficiar Nelu Tofan  |  Destinatar Echipa de dezvoltare  |  Versiune 1.0

Solicit modernizarea completă a NITIDO.RO, cu o experiență premium pe mobil și desktop, fluxuri comerciale coerente și o bază tehnică extensibilă. Implementarea trebuie să păstreze comportamentele existente validate și să adauge funcțiile din acest brief în etape verificabile.

Rezultatul cerut

Website public modern și aplicație web completă pentru clienți, firme, echipe și administratori.

Rezervare Standard la preț fix, cu alegerea firmei de către client; Express cu prima acceptare eligibilă confirmată de server.

Rezervări recurente, proprietăți salvate, control documentat al calității, calendar pentru firme și administrare business.

Module extensibile pentru proprietăți turistice, abonamente software și integrări, activate după îndeplinirea dependențelor.

Baza acestei specificații

Au fost citite paginile publice NITIDO la 11 septembrie 2026 și cercetate Housekeep, Helpling, Turno, Properly, Jobber și Housecall Pro. Nu a fost auditat repository-ul și nu au fost testate conturi autentificate, plăți reale sau infrastructura. Afirmațiile site-ului descriu prezentarea publică; nu reprezintă verificarea implementării din backend.

Cum se execută

Programatorul începe cu inventarul real al codului și o matrice existent / parțial / lipsă / defect. Reutilizează modulele funcționale. Nu rescrie întregul produs fără justificare tehnică și evaluarea migrării. Denumirile de entități și rutele din brief sunt propuneri de contract, de adaptat compatibil la proiect.

Priorități: P0 = integritate și blocaje de lansare; P1 = modernizarea principală; P2 = recurență și operațiuni; P3 = extensii business și integrări.

STATUS: BUN DE TRIMIS pentru audit și implementare etapizată. Nu reprezintă acceptarea produsului final sau aprobarea publicării. Tarifele noi și politicile neconfirmate sunt centralizate la final.



02  Corectarea produsului actual

ID

Constatare publică

Cerință

AUD01

Exemplu 120 m² la 450–600 lei și estimator la 780 lei

Aceeași regulă de calcul sau diferență de serviciu explicită. Exemplele folosesc catalogul activ.

AUD02

Oferte pe homepage și preț fix în pagina firmelor

Standard compară firme și disponibilitate la prețul calculat. Nu se introduce negociere de preț implicită.

AUD03

Push simultan promis; push nativ neconfirmat în altă pagină

Inventar real al canalelor. Promisiunile urmează capabilitățile livrate.

AUD04

Regula primului Accept apare și ca explicație generală

Separarea consecventă a Standard de Express pe toate paginile și în aplicație.

AUD05

Formulări despre server și cod în pagini comerciale

Rescriere pentru client: serviciu, cost, confirmare, anulare, suport.

AUD06

Tracking și preluare instant prezentate comercial

Se separă statusul lucrării de GPS. Disponibilitatea Express trebuie susținută de capacitatea reală.

AUD07

Momentul plății este explicat neuniform

Separarea finalizării operaționale, capturării, transferului și intrării banilor în bancă.

AUD08

Recenzii încă fără lucrări și număr public de firme

Se afișează exclusiv date verificabile. Fără recenzii fictive sau numere simulate în producție.

Reguli care se păstrează

Adresa exactă este protejată până la alocare. Firmele eligibile și recenziile verificate sunt fundamentul încrederii. Alocarea și rezultatul plății rămân decise în backend. Clientul nu poate modifica prețul, câștigătorul sau starea financiară prin interfață.

Ce nu se presupune

Verificarea unei firme în registru nu certifică automat personalul, asigurarea sau calitatea serviciului. Abonamentele Start, Pro sau Teams nu sunt tratate ca produse active. Hărțile, GPS-ul și notificările native nu sunt considerate funcționale doar pentru că sunt menționate comercial.

Acceptare AUD: fiecare constatare este închisă cu pagina corectată și, pentru promisiuni funcționale, dovada comportamentului real. Copia comercială trebuie verificată pe toate rutele publice, emailurile și mesajele din aplicație.



03  Design și experiență mobilă

Direcția vizuală

Interfață luminoasă, clară și premium, cu fotografii autentice de spații și servicii. Se păstrează identitatea NITIDO recognoscibilă. Direcție propusă pentru prototip: fundal #F7F9FC, suprafețe #FFFFFF, text #111827, acțiune principală #0F766E, accent Express #B45309. Paleta finală se validează vizual și prin contrast; nu este un rebranding aprobat.

Tipografie consecventă, reutilizând Inter și Sora dacă auditul confirmă utilizarea și licențele. Corp 16 px pe mobil; evitarea textelor comerciale sub 14 px.

Grilă de spațiere 4/8 px; colțuri 12–16 px; umbre discrete; o acțiune principală pe zonă. Stările nu se comunică exclusiv prin culoare.

Design verificat la 360, 390, 430, 768, 1024 și 1440 px. Fără derulare orizontală și fără suprapunerea suportului peste butonul principal.

Navigare mobilă client: Acasă, Rezervări, Mesaje, Cont. Pentru echipă: Azi, Lucrări, Mesaje, Cont.

Controale tactile de minimum 44 × 44 px ca obiectiv de produs; tastatură, focus vizibil, etichete, cititoare de ecran și reducerea animațiilor.

Prima pagină

Primul ecran conține promisiunea serviciului și formularul Localitate → Tip serviciu → Suprafață → Dată. Butonul continuă către configurare. Urmează diferența Standard/Express, ce include serviciul, încrederea documentată, explicația plății, recenziile reale și intrarea pentru firme și business. Nu se afișează carduri demo ca lucrări live.

Componente obligatorii

Butoane și câmpuri, selector adresă, calendar, interval orar, selector serviciu, card firmă, comparație, rezumat de preț, cronologie, uploader foto, listă de sarcini, dialog confirmare, alerte și notificări. Fiecare componentă are stări normală, încărcare, goală, eroare, dezactivată și succes.

Livrabil de design

Prototip navigabil și componente documentate pentru toate rolurile; asset-uri exportabile și licențe. Capturi reale la rezoluțiile de acceptare. Întâi se validează homepage, configuratorul și detaliul lucrării, apoi se aplică sistemul pe toate ecranele. Acest brief definește designul cerut, dar nu înlocuiește machetele finale.



04  Inventarul ecranelor publice și client

Rutele sunt orientative. Se păstrează URL-urile existente sau se introduc redirecționări verificate. Fiecare ecran trebuie să funcționeze prin link direct și după refresh.

ID

Ecran

Conținut și acțiuni principale

PUB01

Acasă

Configurare rapidă, Standard/Express, servicii, încredere, acțiune pentru firme.

PUB02

Servicii și detalii

Ce include/exclude, parametri necesari, extraopțiuni și intrare în configurator.

PUB03

Prețuri

Reguli comerciale, exemple coerente, estimare și cost final înainte de confirmare.

PUB04

Cum funcționează

Fluxuri distincte Standard și Express, de la cerere la finalizare.

PUB05

Pentru firme

Eligibilitate, proces, costuri publicabile, calendar și înscriere.

PUB06

Încredere și siguranță

Verificări reale, recenzii, date personale, remedieri și plăți.

PUB07

Business și Host

Beneficii, formular de interes; activare numai când modulul este disponibil.

PUB08

Oraș și serviciu

Acoperire reală, conținut local util și disponibilitate; fără pagini duplicate.

PUB09

Contact și suport

Canale, program și formular cu identificator de solicitare.

PUB10

Companie și documente

Despre noi, termeni, confidențialitate, cookie-uri; date reale ale operatorului.

AUTH01

Autentificare și recuperare

Client/firmă, verificare contact, recuperare, invitații și sesiuni.

CLI01

Panou client

Următoarea rezervare, acțiuni necesare, repetare și proprietăți.

CLI02

Configurare lucrare

Serviciu, spațiu, extraopțiuni, dată, mod, rezumat, cont și plată.

CLI03

Firme candidate

Profiluri comparabile, disponibilitate, selectare sau așteptare Express.

CLI04

Detaliu lucrare

Status, firmă, program, preț, mesaje, fotografii, anulare și suport.

CLI05

Finalizare și evaluare

Raport pe sarcini, confirmare/remediere, stare plată și recenzie.

CLI06

Rezervări și recurențe

Viitoare/istoric, filtre, repetare, pauză și editare serie.

CLI07

Proprietăți

Adresă, caracteristici, preferințe și instrucțiuni de acces protejate.

CLI08

Plăți și documente

Metode salvate prin procesator, tranzacții, documente și rambursări.

CLI09

Mesaje și notificări

Conversații pe lucrare, citire, atașamente și preferințe.

CLI10

Cont și recomandări

Profil, securitate, credit eligibil, preferințe și cereri de date.



05  Inventarul ecranelor profesionale

ID

Ecran

Conținut și acțiuni principale

FIR01

Înscriere și verificare

Date companie, acoperire, servicii, documente și status distinct de verificarea plăților.

FIR02

Oportunități

Lucrări eligibile, preț/net, program, trimitere candidatură sau accept Express.

FIR03

Calendar și capacitate

Echipe, intervale, indisponibilități, durată și timp de deplasare.

FIR04

Lucrare alocată

Detalii permise, echipă, mesaje, acces și instrucțiuni.

FIR05

Execuție mobilă

Sosire, sarcini, poze, probleme, finalizare și reîncercare upload.

FIR06

Echipe și membri

Invitații, roluri, suspendare acces, disponibilitate și lucrări atribuite.

FIR07

Câștiguri și documente

Brut, comision, net, ajustări și stări de transfer/payout.

FIR08

Profil public și reputație

Servicii, dovezi autorizate, recenzii eligibile și indicatori expliciți.

FIR09

Setări firmă

Acoperire, notificări, cont de plăți și documente care expiră.

BIZ01

Portofoliu

Proprietăți/sedii, filtre și acțiuni necesare.

BIZ02

Calendar portofoliu

Lucrări pe locație, aprobare, programare repetată și conflicte.

BIZ03

Bugete și rapoarte

Cost pe locație, perioadă, centre de cost și export.

HOST01

Pregătirea proprietății

Rezervări importate, curățenie, lenjerie, consumabile și inspecție.

HOST02

Integrări

Conectare/revocare calendar, ultimă sincronizare și erori.

ADM01

Operațiuni

Nepreluate, întârziate, anulate, blocate financiar și incidente.

ADM02

Companii și utilizatori

Verificare, roluri, documente, suspendări și audit.

ADM03

Suport și calitate

Tichete, dovezi, remedieri, contestații și termene.

ADM04

Excepții financiare

Autorizări, capturări, rambursări, transferuri și reconciliere.

ADM05

Catalog și configurare

Servicii, tarife versionate, zone, reguli și feature flags.

ADM06

Analiză și conținut

Conversie, retenție, capacitate, costuri și pagini comerciale.

Acoperirea stărilor

Pentru fiecare ecran se livrează varianta fără date, eroarea de serviciu extern, sesiunea expirată și accesul interzis. Butoanele neimplementate nu se afișează ca funcționale. Datele de demonstrație sunt limitate la mediul de test și marcate explicit.



06  Identitate roluri și permisiuni

Conturi și organizații

Un utilizator poate avea apartenență la mai multe organizații. Contextul activ este vizibil și verificat de backend. Un client individual poate deține mai multe proprietăți; un client business poate invita membri cu permisiuni limitate. O firmă poate avea mai multe echipe.

Rol

Permis

Interzis implicit

Client

Propriile proprietăți, rezervări, mesaje, plăți și recenzii

Datele altor clienți sau documentele interne ale firmelor.

Administrator client business

Portofoliu, membri, bugete și aprobări ale organizației

Acces la altă organizație prin schimbarea ID-ului.

Responsabil locație

Lucrările și confirmările locațiilor atribuite

Configurarea globală a facturării și a membrilor.

Proprietar firmă

Profil, echipe, oportunități, calendar și situații financiare

Modificarea prețului unei lucrări confirmate sau a recenziilor.

Dispecer firmă

Planificare și alocarea echipelor firmei

Schimbarea contului bancar și aprobarea rambursărilor.

Membru echipă

Lucrări atribuite, sarcini, poze și status

Alte lucrări, netul firmei și date financiare sensibile.

Suport și operațiuni

Dosare necesare intervenției, cu audit

Aprobarea arbitrară a plăților și acces general fără motiv.

Financiar

Reconciliere și operațiuni autorizate conform politicii

Rescrierea istoricului financiar.

Owner NITIDO

Politici, roluri administrative și activarea lansării

Ocolirea jurnalizării operațiunilor.

Cerințe de autentificare

Email și telefon normalizate; verificare prin canalul configurat, rate limiting și protecție contra enumerării conturilor.

Recuperare cu token unic, limitat în timp; invalidarea tokenului după folosire. Sesiuni revocabile și logout funcțional.

MFA pentru administratori și pentru modificarea datelor financiare sensibile. Invitațiile au rol, organizație și expirare.

Statuturi distincte: contact verificat, companie verificată în registru, documente revizuite și cont de plăți operațional.

Serviciul registrului indisponibil produce verificare în așteptare, fără etichetă falsă de firmă verificată.



07  Configurare și calculul prețului

Fluxul clientului

Localitate și acoperire → serviciu → spațiu și extraopțiuni → dată și interval → Standard/Express → rezumat → autentificare sau creare cont → publicare. Ciorna se păstrează la autentificare. Adresa completă se colectează protejat și nu apare în lista publică de oportunități.

Catalogul

Categorii inițiale configurabile: întreținere, generală, după renovare, mutare, birouri și pregătire proprietăți turistice. Catalogul definește sarcinile incluse, excluderile, unitățile tarifabile, durata estimată, echipamentul necesar, limitele și disponibilitatea pe zonă. Categoria se activează numai dacă există capacitate eligibilă.

Date: tip spațiu, suprafață, camere, băi, nivel declarat de dificultate, dată, interval, acces, materiale incluse și extraopțiuni.

Extraopțiuni cu unități clare: număr aparate, suprafață geamuri, cantitate lenjerie sau timp suplimentar. Nu se dublează sarcini deja incluse.

Lucrările în afara limitelor catalogului ajung la evaluare asistată. Nu se emite automat un preț pretins definitiv pentru o cerere insuficient descrisă.

Contract de calcul

Valoare serviciu = max(minim catalog, componentă fixă + Σ cantitate × tarif unitar + extraopțiuni + suplimente aprobate). Se aplică numai regulile efectiv configurate, fără dublarea componentelor. Fiscalitatea și baza comisionului se mapează la modelul comercial validat. Toate sumele sunt întregi în bani, cu monedă explicită.

Suma clientului = valoare finală serviciu + taxe de platformă aprobate − reduceri eligibile − credit consumat; minim zero. Reducerile și creditul au finanțator explicit. Netul firmei nu scade automat din cauza unei promoții suportate de NITIDO. Formula netului și baza comisionului sunt versionate.

Preț fix și modificări

La publicare se salvează snapshot cu parametri, defalcare, versiune tarif și expirarea estimării. Standard nu permite firmei să liciteze alt preț. O modificare de scop produce o propunere nouă, acceptată de client și de firmă, cu efect financiar confirmat înainte de executarea suplimentului. Fără majorare silențioasă.

Creditul de recomandare de 20 lei este menționat în pagina publică actuală: valoarea și eligibilitatea se verifică în cod. Acordare propusă la prima lucrare eligibilă finalizată și plătită, după validarea politicii; protecție la auto-recomandare, conturi multiple și rambursări.



08  Alocare Standard și Express

Standard

Lucrarea publicată este vizibilă firmelor eligibile. Firma trimite o candidatură la prețul fix, cu interval confirmabil, echipa/capacitatea disponibilă și mesajul relevant. Clientul compară profilurile și selectează. Backendul reverifică eligibilitatea și rezervă temporar capacitatea pentru confirmarea financiară.

Compararea afișează aceleași dimensiuni pentru toate firmele: lucrări finalizate, recenzii și numărul lor, punctualitate dacă există date suficiente, servicii și disponibilitate. Nu se produce un scor universal opac. O firmă nouă nu primește istoric inventat.

Express

Express este oferit doar pentru zone, servicii și intervale cu capacitate verificabilă. Prima cerere validă de acceptare rezervă atomic lucrarea și capacitatea. Celelalte cereri primesc răspuns determinist că lucrarea nu mai este disponibilă. Clientul vede preluare în curs până la confirmarea completă.

Rezervare și autorizare

Pentru lucrări apropiate: rezervare locală → autorizare → confirmare alocare. Operațiunea externă nu se ține într-o tranzacție lungă de bază de date. Rezervarea temporară are expirare și compensare: plata eșuată eliberează capacitatea; autorizarea sosită după expirare se reconciliază, fără alocare paralelă. Pentru lucrări îndepărtate: metodă salvată → programare condiționată cu capacitate rezervată → autorizare la termen → confirmare financiară, conform secțiunii 13.

Eligibilitate

Companie activă și aprobată, rol valid, zonă și serviciu compatibile, lipsa suspendării și capacitate disponibilă.

Durata și timpul de deplasare sunt luate în calcul. Două rezervări suprapuse nu pot ocupa aceeași echipă peste capacitatea declarată.

Revalidare la candidatură, alegere, acceptare și începerea lucrării; schimbările relevante generează intervenție și notificare.

Oferta expirată sau firma devenită indisponibilă nu poate fi selectată dintr-un ecran vechi.

Nepreluare și înlocuire

Dacă nu există acceptare, se oferă intervale alternative sau anulare fără taxă neconfirmată. Timpii de așteptare și escaladare sunt configurabili. La anularea firmei se caută înlocuitor; modificările de interval și preț necesită confirmarea clientului. Nu se promite preluare garantată fără un mecanism operațional demonstrat.



09  Execuție și controlul calității

Traseul lucrării

Programată → echipă în drum, dacă funcția există → sosită → în lucru → raport final trimis → confirmată sau remediere solicitată → închisă. Starea operațională se separă de plată. Clientul vede cine execută, intervalul, sarcinile convenite și următoarea acțiune.

Dovezi și sarcini

La sosire: confirmare în aplicație și fotografie relevantă; la final: fotografii și checklist complet. Modelul actual cere cel puțin dovada inițială și finală; regulile noi se extind pe categorii.

Fiecare sarcină are stare, autor, moment și, unde este necesar, fotografie. Nerealizabil cere motiv și notificare; nu este echivalent cu realizat.

Fișierele se verifică prin tip real, dimensiune și acces. Propunere de limite configurabile: 10 MB/foto și 20 fotografii/lucrare; compresie și miniaturi.

Upload întrerupt: progres și reîncercare fără duplicare. Fără finalizare sau capturare dacă dovada obligatorie nu este confirmată de server.

Fotografiile surprind suprafețele relevante. Instrucțiunile interzic documente, persoane sau bunuri sensibile inutile; publicarea în portofoliu cere acord separat.

Recepție și remediere

Firma trimite raportul, clientul primește acțiunile Confirmă lucrarea și Raportează o problemă. Problema se leagă de sarcina afectată, cu descriere și dovadă. Sistemul deschide un dosar și urmărește răspunsul, vizita de remediere sau decizia autorizată. Fereastra de recepție și efectul asupra plății trebuie configurate și comunicate.

Propunerea de recepție explicită poate schimba comportamentul actual de capturare la finalizarea firmei. Programatorul documentează diferența, implementează noua variantă în test și păstrează politica live până la activarea aprobată. Dacă clientul nu răspunde, nu se inventează acceptarea tacită; se aplică numai politica publicată și validată.

Tracking și recenzii

Statusurile live sunt obligatorii. GPS este modul opțional separat: acces limitat la lucrarea activă, consimțământ și indicarea vechimii poziției. Fără coordonate actuale, se afișează statusul, nu o hartă simulată. Recenzia se acordă o singură dată pentru lucrarea eligibilă; moderarea și contestațiile sunt auditate.



10  Contul clientului și recurența

Proprietăți și rezervare repetată

Fișa proprietății salvează adresa, suprafața, camerele, materialele sensibile, preferințele, accesul și sarcinile uzuale. Clientul poate duplica o cerere și revizui data și prețul actual. Repetarea nu reutilizează orbește un tarif expirat, un acord financiar sau un cod de acces vechi.

Rezervări recurente

Frecvențe: săptămânal, la două săptămâni și lunar, cu zi, interval, dată de început, dată de sfârșit opțională și fus orar Europe/Bucharest.

Regulă propusă pentru o zi lunară inexistentă: ultima zi a lunii, afișată înainte de confirmare. Trecerea la ora de vară/iarnă păstrează ora locală convenită.

Editarea oferă Doar această vizită sau Aceasta și următoarele. Vizitele în lucru și cele finalizate nu se modifică retroactiv.

Pauza oprește generarea vizitelor viitoare din intervalul ales; reluarea nu generează retroactiv vizite pierdute. Vizitele deja generate în interval se tratează explicit prin anulare și eliberarea capacității, după politica activă; clientul vede efectele înainte de confirmarea pauzei.

Fiecare apariție are ID, preț snapshot, firmă, status și plată proprii. Cheie unică serie + apariție previne generarea dublă.

Orizont de generare propus pentru test: 30 zile, configurabil. Rezervarea capacității și autorizarea cardului sunt procese distincte.

Firma preferată

Clientul poate solicita aceeași firmă. Firma confirmă capacitatea pentru seria propusă sau vizitele generate. Preferința nu reprezintă garanție absolută. Dacă firma refuză sau devine indisponibilă, clientul vede alternative și poate confirma înlocuirea conform opțiunii alese pentru serie.

Plată și modificări de tarif

Pentru recurență se salvează metoda de plată și acordul corespunzător prin procesator. Fiecare vizită are propriul ciclu financiar. O autentificare suplimentară cerută de bancă produce notificare și acțiune client, fără etichetare falsă de plată reușită. Tarifele noi se notifică și se aplică numai conform acordului, fără rescrierea vizitelor confirmate.

Retenție utilă

Panoul afișează următoarea curățenie, repetare rapidă, documente și solicitări deschise. Mesajele de revenire și recomandările au preferințe separate de notificările tranzacționale. Rezervarea recurentă nu este echivalentă cu un abonament software; cele două produse au contracte și facturare distincte.



11  Instrumente pentru firme și echipe

Calendar și organizare

Calendar zi/săptămână/lună, filtrabil pe echipă, serviciu și zonă. Programarea ocupă capacitate în mod verificabil. Se pot defini concedii, indisponibilități, durate minime și timpi de deplasare. Mutarea prin drag and drop este o propunere; devine confirmată numai după validarea serverului și a clientului când îi schimbă intervalul.

Operațiuni zilnice

Lista Azi separă lucrările confirmate, cele în așteptare și acțiunile urgente. Firma vede brut, comision și net conform drepturilor.

Proprietarul sau dispecerul atribuie echipa. Înlocuirea personalului actualizează accesul și notifică persoanele relevante.

Membrii văd doar lucrările atribuite și datele necesare; retragerea atribuirii revocă accesul la datele curente.

Echipa primește instrucțiuni și poate raporta acces imposibil, client absent, scop diferit sau daună observată înainte de lucru.

Confirmarea sosirii și finalizării cere dovada stabilită. Interfața offline poate păstra ciorne, dar nu confirmă alocări sau plăți offline.

Reputație și verificări

Profilul afișează separat compania verificată, experiența declarată, documentele revizuite, recenziile și istoricul măsurabil. Expirarea documentelor generează avertizare și restricții conform politicii. Nu se confundă validarea CUI cu certificarea profesională. Contestațiile la incidente au dosar și decizie justificată.

Modul software pentru firme

Extensie P3: firma poate administra și lucrări din afara marketplace-ului într-un spațiu distinct, cu sursa lucrării vizibilă. Acestea nu produc recenzii NITIDO verificate și nu intră automat în comisionul marketplace. Funcții posibile: clienți proprii, planificare, rapoarte, documente și costuri. Activarea și monetizarea se validează separat.

Câștiguri

Panoul diferențiază estimat, autorizat, capturat, transferat și plătit în cont bancar. Ajustările și rambursările sunt identificabile. Exportul reproduce exact filtrul și moneda. Nu se afișează un termen garantat de încasare dacă acesta nu este configurat și susținut de procesator.



12  Modulele Business și Host

NITIDO Business

Un cont organizațional gestionează proprietăți și sedii, responsabili locali, centre de cost și bugete. Rolurile separă solicitarea, aprobarea și consultarea documentelor. Pragurile de aprobare sunt configurabile; depășirea bugetului produce blocaj sau aprobare, nu o cheltuială automată.

Import inițial de proprietăți prin CSV cu previzualizare, validare pe rând și prevenirea duplicatelor.

Calendar consolidat, programări recurente, filtre pe locație, firmă, status și interval.

Raport lunar cu lucrări, costuri, întârzieri, probleme și documente. Totaluri separate pe monedă.

Facturarea consolidată se activează numai dacă modelul contractual și fiscal o permite; raportul consolidat nu este automat factură.

Abonament software propus pe organizație și/sau locații active; tarifele, limitele și perioada de probă rămân configurabile și nepublicate până la aprobare.

NITIDO Host

Proprietatea turistică are rezervări, ore de plecare/sosire, durată de curățenie și standard de pregătire. Sistemul generează o lucrare în intervalul disponibil. Lipsa timpului suficient sau a unei firme declanșează alertă, nu confirmarea automată a proprietății pregătite.

Prima integrare poate utiliza iCal autorizat. Se afișează ultima sincronizare și limita acestei surse: nu reprezintă integrare completă, instantanee sau bidirecțională.

UID extern + sursă + proprietate previn dublarea. Modificările și anulările sunt reconciliate, inclusiv după întreruperi.

Rezervările din surse diferite pot descrie aceeași ședere. Se semnalează suprapunerile înainte de generarea unor lucrări duplicate.

Checklist pentru camere, lenjerie, chei și consumabile; inventar cu praguri și alertă. Fără achiziții automate de consumabile în această versiune.

Integrarea directă cu platforme sau PMS se face numai prin acces autorizat și API disponibil. Fără presupunerea că o simplă adresă de calendar oferă toate capabilitățile.

Criterii de activare

P3 se livrează inițial în pilot, cu organizații și proprietăți de test. O modificare de checkout, o anulare și o întârziere de sincronizare trebuie demonstrate fără rezervări sau încasări duplicate. Modulul are oprire independentă fără afectarea rezervărilor Standard existente.



13  Plăți și integritate financiară

Auditul integrării

Se inventariază integrarea Stripe existentă, entitatea contractuală, conturile conectate, tipul de încasare, responsabilitatea comisioanelor și calendarul transferurilor. Nu se schimbă modelul financiar printr-un simplu redesign. Pentru extensii se verifică documentația Stripe curentă și compatibilitatea contului, cu decizie arhitecturală scrisă. Se folosesc componentele oficiale pentru datele cardului.

Stări separate

Plată: metodă necesară → autentificare necesară → autorizare în curs → autorizată → capturare în curs → capturată; ramuri eșuată, expirată, anulată și rambursată parțial/integral. Transferul către firmă și payout-ul bancar au stări proprii. Interfața nu echivalează raportul final cu banii intrați în cont.

Programări viitoare

Preautorizarea are termen de expirare. Backendul urmărește termenul real furnizat de procesator și nu presupune că un hold acoperă săptămâni sau luni. Pentru lucrări îndepărtate se salvează metoda, iar autorizarea se programează în fereastra eligibilă. Rezervarea firmei este condiționată de confirmarea financiară la termen. Eșecul sau cererea de autentificare produce recuperare controlată și notificare.

Reguli obligatorii

Idempotency pentru autorizare, capturare, anulare, refund și transfer; aceeași operațiune retrimisă nu produce bani mișcați de două ori.

Webhooks cu semnătură verificată, deduplicare și procesare sigură în ordine variabilă. Evenimentul este stocat durabil înainte de confirmarea primirii.

Timeout-ul unei cereri externe produce stare necunoscută și reconciliere, nu reîncercare financiară oarbă.

Capturarea respectă politica de recepție activă, dovezile și suma autorizată. Expirarea nu declanșează automat încasarea unei lucrări neexecutate.

Înainte de capturare, anularea eliberează autorizarea; după capturare, remedierea financiară folosește refund. Se reconciliază separat efectul asupra transferului și comisionului.

Sumele, moneda, beneficiarul și referința lucrării sunt verificate pe server. Registrul de evenimente financiare se corectează prin intrări compensatoare, fără ștergerea trecutului.

Reconciliere periodică între evidența locală și procesator, cu coadă de excepții și intervenție autorizată.

Comisioane, taxe, discounturi, finanțatorul creditului, recepția și termenul payout sunt decizii comerciale. Nu se preiau procente sau ținte de profit din alte proiecte ale beneficiarului. Nu se inventează un portofel retragibil sau o garanție escrow.



14  Administrație comunicare și AI

Panoul operațional

Liste distincte: lucrări nepreluate, rezervări financiare în așteptare, întârzieri, firme neverificate, documente expirate, reclamații și diferențe financiare. Fiecare rând are responsabil, vechime, prioritate și următoarea acțiune. Orice intervenție care schimbă alocarea, suspendarea sau banii cere motiv și jurnal de audit.

Notificări

Evenimente minime: cerere publicată, candidatură nouă, firmă aleasă, acceptare confirmată, plată care necesită acțiune, apropierea vizitei, sosire, raport final, remediere, anulare, înlocuire și document expirat. Canale: în aplicație și email; SMS/push numai cu furnizor configurat și capabilitate verificată.

Livrarea folosește coadă, reîncercări, deduplicare și status. Mesajele nu expun adresa exactă sau coduri de acces pe ecranul blocat. Preferințele comerciale sunt separate de comunicările operaționale. Un mesaj nelivrat nu schimbă automat starea lucrării. Dacă serviciul extern cade, panoul rămâne sursa vizibilă a statusului.

Chat și suport

Conversație legată de lucrare, accesibilă doar participanților și suportului autorizat. Atașamentele au aceleași reguli ca fotografiile. Dosarul de suport include cronologia, dovezile, mesajele și soluția. Fiecare cerere are ID și responsabil. Nu se promit ore de răspuns fără capacitate operațională.

Asistent AI

P1: răspunde din informațiile comerciale validate, explică statusuri autorizate și deschide tichete cu context minim.

P2: transformă descrierea scrisă sau dictată în ciornă de configurare. Clientul verifică înainte de publicare.

P3: semnalează dovezi foto lipsă/neclare și posibile neconcordanțe. Verificarea umană decide problema de calitate.

AI nu stabilește arbitrar prețuri, nu alocă lucrări, nu aprobă rambursări, nu confirmă plăți și nu modifică date bancare.

Datele externe și mesajele utilizatorilor sunt conținut neîncrezut; nu pot schimba permisiuni sau instrucțiuni de sistem.

Timeout-ul sau indisponibilitatea AI oferă formular și suport uman. Se măsoară costul, erorile și escaladările.

Regulile comerciale sunt gestionate dintr-o sursă unică versionată, astfel încât homepage, calculatorul, emailurile și AI să nu descrie produse diferite.



15  Model de date și contracte API

Entități propuse

User, Organization, Membership, ProviderProfile, VerificationRecord, Team, TeamMember, ServiceArea, Availability, Property, ServiceCatalog, PriceVersion, QuoteSnapshot, Job, Application, AssignmentReservation, Assignment, ChecklistTemplate, ChecklistItem, Evidence, RecurrenceSeries, Occurrence, Payment, FinancialEntry, Transfer, Refund, Review, Incident, SupportTicket, Message, Notification, AuditEvent, IntegrationConnection și ExternalReservation.

Invariante de date

O singură alocare activă pe lucrare; o candidatură activă pe firmă și lucrare; capacitate rezervată verificabil.

O apariție unică pe serie și dată logică; un eveniment extern procesat o singură dată; o recenzie eligibilă pe relația client–lucrare–firmă.

Organization ID și verificarea proprietarului pe fiecare resursă privată. Filtrarea doar în frontend este insuficientă.

Bani în unități minore și monedă; timp în UTC plus fusul local pentru planificare; versiune pe prețuri, sarcini și politici.

Tranziții valide și optimistic locking pentru cereri concurente. Indexuri pe organizație, stare, dată, zonă și referințe externe.

Soft delete nu este soluție universală: datele personale și evidențele obligatorii au politici de retenție distincte.

Contract API orientativ

Comportament

POST /quotes

Validează parametri și întoarce defalcare, versiune și expirare.

POST /jobs

Creează din snapshot valid; respinge estimarea expirată sau modificată.

POST /jobs/{id}/applications

Candidatură Standard la preț fix, cu validarea firmei.

POST /jobs/{id}/select

Alegere client; rezervare de capacitate și flux financiar.

POST /jobs/{id}/accept-express

Prima rezervare validă atomică; conflict pentru celelalte.

POST /jobs/{id}/evidence și /complete

Upload autorizat și finalizare condiționată de dovezi.

POST /jobs/{id}/confirm și /issues

Recepție sau problemă conform politicii active.

POST /recurrences și /integrations

Generare idempotentă și conexiuni autorizate.

POST /payments/webhook

Verificare semnătură, stocare durabilă și deduplicare.

API-ul final se livrează în OpenAPI cu payloaduri, validări, drepturi și exemple. Erori stabile: 401 sesiune, 403 acces, 409 conflict, 422 validare, 429 limitare. Răspunsurile conțin cod de eroare și correlation ID, fără secrete. Listele sunt paginate. Compatibilitatea rutelor existente se păstrează prin versiuni sau adaptoare.



16  Arhitectură securitate și operare

Arhitectura recomandată

Se păstrează stackul validat după audit. Răspunsul public indică Next.js, dar nu stabilește întreaga arhitectură. Punct de plecare propus: aplicație modulară, bază de date relațională tranzacțională, stocare privată de obiecte și workers pentru notificări, fotografii, recurențe și sincronizări. Cache-ul nu este autoritatea alocării sau a plății.

Separarea modulelor: identitate, catalog, rezervări, alocare, execuție, plăți, comunicare și business. Outbox tranzacțional sau mecanism echivalent evită pierderea evenimentelor între salvarea lucrării și trimiterea notificării. Furnizorii externi sunt integrați prin adaptoare, cu timeout, retry controlat și monitorizare.

Protecția datelor

Autorizație pe fiecare operațiune și fișier; teste explicite între două organizații. Linkuri semnate cu durată redusă pentru documentele private.

Secrete exclusiv în mecanismul securizat al mediului, acces minim necesar și separare test/producție. Fără chei în repository, browser, capturi sau loguri.

HTTPS, cookie-uri securizate, protecție CSRF când este aplicabilă, validare input, protecție XSS și politici CSP compatibile cu integrările.

Scanare și validare upload, limitarea dimensiunilor și prevenirea execuției fișierelor. Codurile de acces se protejează separat de descrierea publică.

Logurile exclud carduri, tokenuri, parole și mesaje private inutile. Accesul administrativ sensibil este jurnalizat.

Export și ștergere de date prin flux verificat; păstrarea evidențelor necesare se stabilește după validarea politicii legale.

Disponibilitate și recuperare

Monitorizare pentru API, erori frontend, cozi, livrare mesaje, autorizări apropiate de expirare și sincronizări. Backup criptat și probă de restaurare într-un mediu izolat. Obiective propuse: RPO de cel mult o oră și RTO de cel mult patru ore, de validat în raport cu infrastructura și bugetul; nu se promit comercial înainte de demonstrare.

Înainte de lansare: domeniu și HTTPS verificate, sănătatea serviciilor, migrări sigure, observabilitate și rollback documentat. Se verifică infrastructura efectivă și găzduirea autorizată; nu se presupune că un panou sau server menționat anterior reprezintă configurația actuală.



17  Performanță SEO și măsurarea afacerii

Obiective de performanță

Pe paginile publice, obiective Core Web Vitals la percentila 75: LCP ≤ 2,5 s, INP ≤ 200 ms și CLS ≤ 0,1. Înainte de trafic suficient se folosesc teste de laborator reproductibile; nu se prezintă scorul Lighthouse drept măsurare reală a tuturor utilizatorilor. Imaginile sunt responsive, comprimate și încărcate progresiv.

Scenariu inițial de test, propus: 100 utilizatori concurenți timp de 15 minute, cu amestec documentat de listări, configurări și actualizări. Țintă p95 sub 500 ms pentru citiri uzuale și sub 1 s pentru mutații locale, fără latența furnizorilor externi. Se raportează infrastructura și erorile; scalarea superioară cere un test nou, nu o promisiune.

SEO și accesibilitate

Titluri, descrieri, canonical, sitemap, robots și redirecturi. Paginile de cont și mediul de test nu sunt indexabile.

Pagini oraș/serviciu numai cu acoperire și conținut util. Datele structurate descriu entitatea reală; fără evaluări fabricate.

Navigare semantică, etichete, contrast verificat, focus și mesaje de eroare asociate câmpurilor. Obiectiv de implementare: WCAG 2.2 AA, verificat prin audit dedicat.

PWA: instalare pe dispozitive compatibile, actualizare sigură și ecran offline. Datele private și răspunsurile financiare nu se păstrează în cache public. PWA nu echivalează cu publicarea în magazine.

Evenimente și indicatori

Indicator

Definiție

Conversie configurare

Lucrări publicate / configurări începute, în aceeași fereastră de analiză.

Rată de alocare

Lucrări alocate / lucrări eligibile publicate, separat Standard și Express.

Timp până la alocare

Mediană și p90 de la publicare la confirmarea firmei.

Repetare la 30 și 60 zile

Clienți cu a doua lucrare finalizată / cohorta primei lucrări, cu fereastră completă.

Calitate

Anulări, no-show și reclamații raportate la lucrările relevante.

Marjă de contribuție

Venitul platformei minus costuri variabile atribuite: procesare, mesaje, promoții și remedieri suportate.

Evenimente minime: configurare începută, estimare emisă, publicare, candidatură, alocare, autorizare, finalizare, capturare, reclamație și repetare. Se deduplică evenimentele, se păstrează sursa și se exclud testele. Volumul total al lucrărilor nu se raportează ca venit NITIDO. Analiticele respectă opțiunile de consimțământ aplicabile.



18  Etape migrare și livrabile

Etapă

Conținut

Poartă de acceptare

E0 Audit P0

Repository, branch și commit, arhitectură, integrare plăți, inventar funcții, buguri și configurări

Matrice existent/parțial/lipsă/defect și plan de schimbare verificabil.

E1 Design P1

Sistem vizual, homepage, configurare, comparație și detaliu lucrare

Prototip navigabil, toate stările și acceptare vizuală a ecranelor principale.

E2 Nucleu P0 P1

Standard, Express, conturi, preț, execuție, plăți, notificări și admin esențial

Trasee complete în staging și teste de concurență, acces și integritate financiară.

E3 Recurență P2

Proprietăți, preferințe, serii, calendar echipe și remedieri

Fără suprapuneri sau apariții duplicate; plată și anulare testate pe fiecare vizită.

E4 Business P3

Portofolii, aprobări, rapoarte, Host și integrări

Pilot cu date de test, sincronizare și izolare organizațională validate.

E5 Lansare

Migrare, restaurare, SEO, suport, performanță și monitorizare

Acceptare finală a beneficiarului și aprobare explicită pentru publicare.

Migrarea

Se păstrează utilizatori, lucrări, plăți, recenzii și referințe externe. Migrări expand/contract unde este necesar; backfill reluabil și verificări de totaluri. Noile reguli se aplică pe versiuni și nu rescriu contractele lucrărilor existente. Se face simulare pe copie protejată, backup și probă de restaurare. Rollback-ul codului trebuie să fie compatibil cu schema rămasă.

Predarea fiecărei etape

Cod în branch separat și pull request cu scop, commit exact, migrări, capturi și raport de teste.

URL de staging accesibil și conturi de test pentru fiecare rol, furnizate prin canal adecvat; fără date reale sensibile.

Documentație API, model de date, dicționar de configurări și exemplu de mediu fără secrete.

Lista funcțiilor active/inactive, furnizori necesari, costuri recurente estimate și limitări cunoscute.

La final: instrucțiuni de instalare, operare, incidente, reconciliere, backup și rollback; asset-uri și licențe.

Programatorul estimează durata și costul după E0, separat pe etapă și dependență. Nu se livrează un termen ferm construit fără acces la cod. O etapă nu este acceptată doar pentru că build-ul este verde sau pagina arată bine.



19  Teste obligatorii de acceptare

Testele automate acoperă regulile cu risc; verificarea vizuală și traseele complete confirmă experiența reală. Rezultatele sunt legate de commit și mediu. Lista de mai jos este setul minim, extensibil după audit.

ID

Scenariu

Rezultat cerut

T01

Estimator și publicare cu aceleași date

Același preț și aceeași versiune; defalcare identică.

T02

Tarif expirat sau schimbat din browser

Recalculare/eroare clară; serverul respinge manipularea.

T03

Două firme acceptă Express simultan

O singură rezervare/alocare; fără plăți duble.

T04

Clientul selectează două firme simultan

O singură firmă confirmată.

T05

Echipă ocupată de două cereri concurente

Nu depășește capacitatea disponibilă.

T06

Autorizare refuzată sau 3DS abandonat

Nicio alocare finală falsă; rezervarea se eliberează controlat.

T07

Autorizare reușită după timeout local

Reconciliere/compensare; nicio a doua încasare.

T08

Webhook duplicat și în ordine inversă

Istoric coerent; efect financiar executat o singură dată.

T09

Preautorizare expirată înainte de lucrare

Recuperare și notificare; nu este afișată drept plată validă.

T10

Finalizare fără fotografie obligatorie

Finalizarea și capturarea sunt blocate.

T11

Anulare înainte/după capturare

Eliberare sau refund corect, cu reconcilierea comisionului/transferului.

T12

Firmă suspendată sau verificare indisponibilă

Nu apare eligibilă în mod fals; flux de reverificare.

T13

Client sau firmă schimbă ID-ul resursei

Acces refuzat; fără date din alt cont/organizație.

T14

Acces la adresă înainte de alocare

Adresa, codurile și fotografiile private nu sunt expuse.

T15

Job recurent generat de două workers

O singură apariție și o singură plată.

T16

Pauză serie și schimbare de oră sezonieră

Program local corect; fără apariții în perioada suspendată.

T17

Import calendar repetat/modificat/anulat

Fără lucrări duplicate; conflictele sunt vizibile.

T18

Upload întrerupt și notificare eșuată

Reîncercare sigură; starea lucrării rămâne corectă.

T19

Recenzie fără lucrare și abuz de recomandare

Neeligibilitatea este respinsă și creditul nu se dublează.

T20

AI primește instrucțiune să ramburseze

Nu modifică plata și nu expune informații neautorizate.

T21

Mobil, tastatură și refresh pe link direct

Ecrane lizibile, focus corect și stare recuperabilă.

T22

Restaurare și rollback în staging

Date și totaluri coerente; procedură reproductibilă.



20  Decizii comerciale și criteriul final

Aceste decizii nu blochează auditul, designul și dezvoltarea în test. Blochează activarea în producție a funcției afectate până când valoarea sau politica este confirmată. Se păstrează configurația live validată; nu se inventează una nouă.

Decizie

Ce trebuie stabilit

Comportament până la confirmare

Comision și fiscalitate

Entitate, bază de calcul, taxe, emitent documente și costuri procesator

Regulile actuale verificate; fără procent nou în cod.

Tarife și Express

Catalog, minime, suplimente și acoperire inițială

Exemple numai din catalogul activ; Express doar unde este susținut.

Recepție și reclamații

Cine confirmă, termen, lipsa răspunsului și efect asupra capturării

Politica actuală păstrată; varianta nouă doar în test.

Anulare și no-show

Ferestre, taxe, dovezi și contestații

Nicio penalizare nouă fără politică publicată.

Transfer și payout

Moment, condiții, rambursări și excepții

Starea procesatorului; fără promisiune bancară inventată.

Abonamente și credit

Prețuri, limite, eligibilitate și finanțator promoții

Funcții comerciale noi inactive; fără debitări automate.

Date și integrare

Retenție, GPS, calendar, canale și furnizori

Acces minim și funcții dependente dezactivate.

Publicare și aplicații

Mediu țintă, acces, buget și aprobarea lansării

Staging; magazinele sunt un livrabil separat de PWA.

Definiția finalizării

Toate cerințele etapei sunt implementate, testate și demonstrabile. Nu există defecte critice de acces, preț, alocare sau bani. Conținutul public descrie doar capabilitățile active. Fiecare rol finalizează traseul complet. Migrarea, restaurarea și rollback-ul au dovadă. Beneficiarul primește URL, conturi de test, commit, documentație și lista limitărilor.

Instrucțiune pentru programator

Începe cu E0. Prezintă diferențele dintre acest brief și codul existent, apoi implementează pe etape. Păstrează separat funcțiile propuse, cele dezvoltate și cele validate. Nu modifica arbitrar prețurile, comisioanele, politicile sau integrarea financiară. Solicită acceptarea pe rezultate concrete, cu capturi și teste. Publicarea se face după aprobarea beneficiarului.

Acceptarea acestui document permite estimarea și începerea lucrului; nu certifică produsul existent. BRIEF COMPLET PENTRU PROGRAMATOR. URMĂTORUL PAS: acces la repository și audit E0.



21  Surse și trasabilitate

Surse consultate la 11 septembrie 2026. Referințele internaționale susțin direcțiile de produs; nu demonstrează că NITIDO are deja aceleași funcții și nu garantează rezultate comerciale. Recomandările sunt adaptări pentru NITIDO.

NITIDO pagina principală — Standard/Express, estimator, statusuri, prezentarea plății și recenziilor.

NITIDO Prețuri — Preț automat, credit de recomandare și lipsa abonamentelor active declarate.

NITIDO Pentru firme — Preț fix, verificare, alocare și limitele declarate ale push/GPS.

NITIDO Încredere — Dovezi foto, eligibilitatea recenziilor și protecția adresei.

Housekeep — Recurență, continuitate și administrarea serviciului.

Helpling — Căutare locală și compararea profilurilor.

Turno — Calendar, operațiuni pentru proprietăți turistice și consumabile.

Properly — Instrucțiuni vizuale și controlul dovezilor de execuție.

Jobber Client Hub — Portal client pentru cereri, programări și plăți.

Housecall Pro — Calendar, echipe, costuri și instrumente operaționale.

Stripe autorizare și capturare — Expirarea autorizării și separarea de capturare.

Stripe webhooks — Confirmarea securizată și procesarea evenimentelor.

Web Vitals — Pragurile LCP, INP și CLS și evaluarea la percentila 75.

Trasabilitatea implementării

În backlog, fiecare task leagă secțiunea din brief, ecranele afectate, criteriul de acceptare și testele T01–T22 relevante. Programatorul poate detalia taskurile, dar nu elimina cerințe fără evidențiere. Schimbările de scop se notează într-o versiune nouă a brief-ului.