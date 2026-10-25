# Marketing: județe și colectare publică

Cerința curentă acoperă întreg județul Constanța și București, separat de Ilfov. Utilizatorul a cerut ulterior pornirea Bucureștiului înainte de finalizarea Constanței. Cele 2.337 de înregistrări procesate anterior priveau municipiul, nu județul.

Market se deschide în secțiunea Județe, cu toate cele 41 de județe și București. Contactele au apartenențe județ/localitate, iar o adresă comună mai multor sedii rămâne vizibilă în fiecare județ sursă fără schimbarea acordului, categoriei sau a stării contactului existent. Inventarul separat include și firmele pentru care nu s-a găsit email. Localitatea necunoscută este etichetată explicit; nu este înlocuită cu municipiul reședință.

Nu există plafon de 200 de contacte pe județ. Limitele de 200 de rânduri și 250 KB sunt limite de cerere/lot pentru formularul mic. Importul de volum citește fișierul treptat, validează toate loturile, prezintă primele 25 de contacte și apoi salvează toate loturile, cu progres și respectarea limitei de cereri. Reluarea omite duplicatele. Exportul trimite toate rezultatele filtrate în pagini interne de 500, fără vechea trunchiere la 5.000.

Colectorul persistă coada CT → B, inventarul și progresul. Încărcarea paginii nu pornește colectarea. Implicit, un județ anterior în pauză sau cu acoperirea nerevizuită blochează județele următoare. Pornirea separată explicită este descrisă mai jos. Se utilizează aceeași închiriere exclusivă a colectorului existent; nu rulează lucrători concurenți asupra aceleiași cozi.

Surse implementate:

- OSM/Geofabrik: limită administrativă de județ admin_level=4, ISO RO-CT/RO-B etc., cu arhivă verificată și loturi de cel mult 500 de înregistrări, fiecare cu SHA-256. Pregătirea sursei nu deschide baza de date a aplicației. Testul de scalare acoperă 100.004 firme fără plafon de inventar. Inventarul real CT pregătit în sandbox are 4.682 de înregistrări în 10 loturi, limita administrativă 2367022.
- Ghidul.ro: indexul public de categorii, legătura de județ furnizată de fiecare categorie, toate legăturile de paginare pentru acel județ și profilurile de firme. Sunt excluse capitolele de administrație publică. Fiecare rând este verificat pentru județ; nu se folosesc rezultate naționale drept rezultate ale județului. Nu se urmează căutările interzise în robots.txt și nu se folosesc autentificare, formulare sau CAPTCHA. Frontieră persistentă, cereri seriale, pauze robots/Crawl-delay/Retry-After și oprire la refuz sau rezultate incomplete.
- Site-urile publice ale firmelor și paginile lor de contact permise prin robots.txt. Se păstrează toate adresele găsite în paginile parcurse, fiecare cu URL-ul sursă.

„Sursă și domeniu verificate” înseamnă sintaxă validă, dovadă dintr-o sursă publică și MX declarat. Nu se verifică prin SMTP, nu se trimit mesaje și nu se garantează existența efectivă a căsuței. Lipsa MX explicit, erorile DNS și lipsa dovezii rămân separate; verificarea tehnică nu acordă consimțământ și nu reactivează un contact.

Procesarea unui inventar OSM ori a unui catalog nu demonstrează că au fost găsite toate firmele sau toate emailurile publice de pe Internet. Starea `review` păstrează județul nefinalizat până la verificarea acoperirii și a surselor/site-urilor inaccesibile. București nu este deblocat de finalizarea inventarului municipiului ori numai a sursei OSM.

Verificări locale: 140 de teste Marketing trecute (un test de fum extern este omis fără configurarea lui), inclusiv CSV cu 100.001 rânduri/501 loturi, manifest cu 100.001 înregistrări, export peste 5.000, integritatea loturilor, mai multe adrese/firmă, acord retras păstrat, limite geografice și blocarea Bucureștiului. Buildul de producție a trecut cu trimiterea Marketing oprită. Starea efectiv publicată și rezultatele reale trebuie verificate separat în Coolify; documentul nu reprezintă o declarație de finalizare a județului.


## Publicare verificată la 24.10.2026

LIVE publică efectiv `7d97bfb733341a0623babb7e73d7788f4dc88b45`, pe baza versiunii LIVE anterioare `177cdbc`; main nu a fost folosit ca bază. Sandbox publică varianta corespunzătoare `0bd5a2bccd78044979c33b0e42ad7621a53ee2c2`, păstrând baza sa de autentificare. Deploy-ul LIVE `gual2eavuc7jfofxt8ziuqtn` este finalizat și aplicația este sănătoasă. Diferența față de versiunea LIVE anterioară nu modifică autentificarea, inițializarea generală a bazei sau Compose-ul de producție; Dockerfile adaugă numai scriptul de pregătire a sursei Marketing.

Colectarea reală a județului rămâne în curs. La verificarea sandbox au fost procesate 4.393/4.682 înregistrări OSM, cu 40 de emailuri având sursă și MX verificate și două invalide; catalogul suplimentar începuse parcurgerea categoriilor. Cifrele sunt un punct de control, nu rezultatul final. Livrarea Marketing era blocată și outboxul gol.

Prima pregătire temporară a județului pe LIVE a fost întreruptă la înlocuirea containerului (arhiva și trei treceri erau procesate, inventarul final nepublicat). Pregătirea a fost reluată pe containerul noii versiuni înainte de pornirea cozii. Verificarea succesului acestui pas și a progresului LIVE este obligatorie; nu deduce finalizarea din starea deploy-ului.


### Confirmare sursă și pornire LIVE

La 2026-10-24 23:23:39 UTC pregătirea LIVE a reușit: 331.678.126 octeți sursă, limita administrativă 2367022, 4.682 înregistrări, 10 loturi, 563.122 octeți inventar final, livrare blocată. Au fost verificate toate cele patru treceri ale arhivei. Coada CT → B a fost pornită explicit pe noua versiune.

La 23:27:33 UTC aplicația LIVE importase și verificase toate cele 10 loturi/4.682 înregistrări și procesase primele 200. Catalogul suplimentar era în coadă, București era în așteptare, outboxul era gol și livrarea blocată. Rutele administrative noi și exportul au răspuns 401 fără sesiune, atât pe LIVE, cât și pe sandbox. Acesta este un punct de control al unei colectări în curs, nu finalizarea județului.


### Remediere catalog: mai multe firme în același tabel

La verificarea din 25.10, colectarea era în pauză în ambele medii la prima listă de firme din catalogul suplimentar. Diagnosticul structural pe pagina publică a confirmat HTTP 200, nouă firme declarate, nouă titluri și nouă etichete Constanța, dar un singur tabel HTML. Parserul anterior lua numai primul titlu din fiecare tabel și considera în mod eronat pagina incompletă.

Parserul citește fiecare titlu și îi asociază numai metadatele din propriile rânduri, oprindu-se înaintea firmei următoare. Validarea numărului de rânduri folosește toate titlurile din listă, iar salvarea rămâne filtrată după județ. Lipsa metadatelor, un județ necunoscut și trunchierea reală continuă să oprească importul. Reluarea explicită poate reîncerca erorile de structură HTML; nu resetează refuzuri de acces, robots sau erori de transport și păstrează termenele sursei.

Verificări: 144 teste Marketing trecute, inclusiv nouă firme într-un tabel, firme din județe diferite în același tabel, metadate lipsă fără preluarea județului firmei următoare și reluare care păstrează refuzul de acces și pauza sursei. Buildul local de producție a trecut. Publicarea și verificarea reluării în sandbox/LIVE se înregistrează separat.


Confirmare după remediere: sandbox publică `4b2f781dfb93c6d24eed0fcdee47cfb9f4902c0b`, iar LIVE publică `c2ea79e70edbcef85ef4d43c98514a765797450f`; ambele sunt sănătoase. Reluarea a reîncercat numai lista verificată care fusese oprită de eroarea parserului, fără refacerea inventarului OSM sau a verificărilor existente.

La punctul de control după publicare, LIVE procesase 14 liste din catalog și avea 46 de profiluri în coadă, fără pagini blocate sau erori de sursă. Sandbox avansase la 86 de liste și 282 de profiluri în coadă. LIVE păstra 417 emailuri cu sursă și MX verificate, 12 invalide și nouă care necesitau verificare; cele 4.682 de rânduri OSM erau procesate. Acestea sunt valori intermediare, nu finalizarea județului. București rămânea în așteptare, livrarea era blocată și outboxul gol în ambele medii. Sarcinile temporare de diagnostic/reluare au fost șterse și absența lor a fost verificată.


### Verificare extinsă a site-urilor publice

După procesarea catalogului, inventarul județului avea 5.590 de înregistrări: 4.682 OSM și 908 din catalog. Cele 1.530 de pagini de catalog erau procesate fără pagini blocate, însă județul rămânea în `review`: 1.470 de rânduri aveau site, iar multe verificări anterioare ale site-urilor nu reușiseră. Această stare nu deblochează București.

Colectorul județului păstrează acum o frontieră de pagini de contact în `marketing_county_web_pages`, fără vechiul plafon de două legături pe site. Paginile reușite și adresele cu URL sursă se salvează între execuții; o reluare nu recitește paginile deja procesate. Site-urile începute sunt prioritizate înaintea celor încă nedeschise, cu un singur lucrător. Limitele pe citire/execuție nu sunt limite totale pe județ sau site.

Regulile robots, redirectările validate, pauzele pe gazdă și Retry-After persistă separat. Refuzurile HTTP/robots, erorile de certificat, domeniile inexistente, paginile prea mari și erorile temporare au cauze distincte. Refuzurile nu sunt reîncercate automat; erorile temporare au cel mult trei încercări, cu pauze. O pagină inaccesibilă rămâne o limită explicită de acoperire, nu dovadă de colectare completă.

Reluarea verificării păstrează toate contactele, dovezile, acordurile și stările existente. Reia numai site-urile și verificările DNS temporare; verificarea sintaxei respinge și punctele incorecte din partea locală. Nu folosește SMTP. Rutele și autorizarea existente sunt păstrate; autentificarea și celelalte module nu sunt modificate.

Validare: 155 teste Marketing trecute, un test extern omis fără configurare; TypeScript și lint trecute. Testele acoperă frontiera cu peste două pagini, reluarea după redeschiderea bazei, redirectări, robots/refuzuri, Retry-After, Crawl-delay, păstrarea dovezilor și prioritizarea site-urilor începute. Publicarea și progresul real se confirmă separat mai jos.


Confirmare la 25.10.2026, 03:52 UTC: sandbox publică `e004d49371d18b0a8a8417a20515cb9804468fbd`, iar LIVE `d9c90ca9154e32e943af93ac791f409cfc942a00`; ambele deploy-uri sunt finalizate și sănătoase. În sandbox, după reluare, paginile procesate ale noii frontiere au crescut de la 7 la 22, iar rândurile din inventar procesate în această verificare au avansat la 4.253/5.590. Refuzurile și termenele surselor au rămas păstrate.

Pe LIVE, reluarea explicită a pus la verificare cele 1.470 de rânduri cu site și 22 de verificări DNS temporare. La primul control, inventarul CT era 5.590, cu 1.132 emailuri având sursă și MX verificate, 98 invalide, 20 care necesită verificare și 22 în așteptarea reverificării DNS. Aceasta este o verificare suplimentară a acoperirii, nu resetarea datelor sau finalizarea județului. București rămâne în coadă, separat de Ilfov. Livrarea este blocată și outboxul gol. Rutele județelor și contactelor/exportului răspund 401 fără sesiune în ambele medii.

Sarcinile temporare de diagnostic și reluare au fost șterse după verificare în ambele medii, iar absența lor a fost confirmată. Colectarea continuă exclusiv prin schedulerul aplicației.


### Pornirea separată a Bucureștiului, aprobată de utilizator

La 25.10.2026 utilizatorul a cerut explicit pornirea Bucureștiului în timp ce Constanța este încă în lucru. Această cerere modifică ordinea strictă inițială CT → B. Constanța rămâne nefinalizată, iar București și Ilfov rămân regiuni distincte în inventar, contacte și export. Monitorizarea periodică a conversației rămâne dezactivată; cererea pornește colectarea aplicației, nu o automatizare nouă de notificări.

În mod implicit, un județ anterior în pauză sau `review` continuă să blocheze următoarele județe. Numai acțiunea explicită `activate`, auditată prin autorizarea Marketing existentă, permite unui județ aflat în coadă să avanseze separat. Se persistă turele în `marketing_county_dispatch`, pentru ca același lucrător exclusiv să alterneze județele eligibile. Termenele surselor, pauzele și starea `review` a fiecărui județ rămân respectate. Pornirea separată nu modifică acorduri, nu marchează Constanța finalizată și nu pornește un colector concurent.

Testele de pornire separată verifică alternarea CT/B, păstrarea termenelor și pauzelor, lipsa unui job Ilfov și păstrarea Constanței în `review`. Testul sursei folosește explicit limita administrativă admin4/ISO RO-B în prezența limitei RO-IF; parserul catalogului exclude rândurile Ilfov din lista București.


Confirmare 25.10.2026 08:34 EET: sandbox publică `218480df88878a403cba5cfce6fd4d5ae8210046`, iar LIVE `e533f15a30c14abcbf3525d8c87df02f0b489b0e`; ambele deploy-uri sunt finalizate și sănătoase. Au trecut 158 teste Marketing (un test extern omis), opt teste ale pregătirii sursei OSM, TypeScript și lint. Rutele județelor și exportului București răspund 401/JSON fără sesiune.

Pornirea separată a Bucureștiului a fost executată și auditată în ambele medii. Sandbox a pregătit deja inventarul OSM pentru limita RO-B, relația 377733: 14.001 înregistrări în 29 de loturi, manifest verificat; importul începuse cu primele 500 de înregistrări. Pe LIVE, București este în `preparing`, cu sursa în curs de pregătire; cifrele sandbox nu sunt prezentate drept date deja importate pe LIVE.

Constanța este reluată în `collecting`, fără resetarea datelor: LIVE 5.584/5.590 înregistrări procesate, 1.562 emailuri cu sursă și MX verificate, 105 invalide și 44 care necesită verificare. Județul rămâne nefinalizat. Ambele medii au livrarea blocată și outboxul gol. Sarcinile temporare au fost șterse, iar absența lor a fost verificată.

În timpul înlocuirii containerului LIVE, o pagină deschisă a afișat textul temporar al proxy-ului „no available server” drept eroare de parsare JSON, păstrând fotografia stării din pauza de publicare. Verificarea de după publicare confirmă aplicația sănătoasă, răspuns JSON și colectarea reluată; reîncărcarea paginii citește noua stare.


### Afișarea importului înaintea colectării emailurilor

În etapa de import București, cardul afișa numai firmele deja procesate și emailurile salvate, ceea ce ascundea progresul încărcării sursei. API-ul județelor expune acum distinct numărul de înregistrări importate. Market afișează „Inventar încărcat” și folosește acest număr pentru bara de import; după import afișează separat firmele procesate. Pregătirea sursei are o explicație proprie, fără o bară de colectare goală.

Răspunsurile temporare de proxy care nu sunt JSON sunt înlocuite cu un mesaj clar în română. O citire reușită curăță eroarea anterioară, astfel încât pagina să nu păstreze o eroare tehnică după revenirea serverului. API-ul și autorizarea existente rămân neschimbate.

Validare: 162 teste Marketing trecute (un test extern omis), TypeScript și lint trecute. Testele verifică inclusiv 5.000 de rânduri importate din 14.001 înainte de procesarea vreunei firme, etapa de pregătire fără bară falsă și răspunsuri proxy urmate de recuperare. Publicarea și verificarea reală se consemnează separat mai jos.


Confirmare 25.10.2026 08:52 EET: sandbox publică `2887377316c6a14e192482597270a4af018493a6`, iar LIVE `5d7b805b7373b1c6e6d95aa50abc4ad0399e6c48`; ambele deploy-uri sunt finalizate și sănătoase. Pauza de publicare a păstrat stările și mesajele anterioare în auditul Marketing, fără copii ale bazei și fără resetarea cursorilor sau a termenelor sursei. După reluare, LIVE București a avansat de la 12.500 la 13.000/14.001 înregistrări importate. Sandbox importase toate cele 14.001 înregistrări, procesase primele 400 și avea un email verificat și unul în verificare. Aceste rezultate sandbox nu sunt prezentate drept emailuri deja salvate pe LIVE.

Constanța rămâne nefinalizată și activă. Livrarea este blocată și outboxul gol în ambele medii; rutele județelor și exportului răspund 401/JSON fără sesiune. Sarcinile temporare au fost șterse și absența lor verificată. Monitorizarea periodică a conversației rămâne oprită.


### Următoarele județe pregătite: Brașov și Ilfov

La 25.10.2026 09:04 EET, utilizatorul a cerut pregătirea Brașovului și Ilfovului după încheierea colectării Constanța/București. Ambele sunt salvate în Market în `queued`, în ordinea Brașov → Ilfov, fără activare separată și fără pornirea pregătirii sursei ori a colectării lor. Starea `review` a unui județ curent continuă să le blocheze: numai finalizarea ambelor județe curente permite continuarea planului.

Pregătirea cozii a fost verificată întâi în sandbox și apoi executată pe LIVE, fără republicarea aplicației și fără întreruperea colectorului. În ambele medii, CT și B au rămas în `collecting`, iar BV și IF în `queued`, cu zero înregistrări importate. Testul dedicat confirmă că Brașov nu este procesat nici după finalizarea doar a Constanței, cât timp București este în `review`; după finalizarea ambelor, urmează Brașov, apoi Ilfov. Toate cele 11 teste ale lucrătorului județelor au trecut.

Livrarea rămâne blocată, outboxul gol, iar monitorizarea periodică a conversației oprită. Sarcinile temporare au fost șterse și absența verificată.


### Criteriu de încheiere și corecția buclelor de legături

Nu există criteriu de oprire la 200 de contacte, la totalul inventarului sau la un număr de emailuri. Când sursele configurate și verificările tehnice au fost procesate, județul intră în `review`, nu în `completed`. Acoperirea și excepțiile surselor trebuie evaluate separat înaintea declarării finalizării. Refuzurile de acces și termenele surselor sunt păstrate.

Diagnosticul anonim al celor șase înregistrări Constanța rămase a găsit două site-uri care generau sute de căi relative repetitive: până la 88, respectiv 61 de segmente, dar câte un singur email distinct. Creșterea artificială a frontierei nu reprezenta acoperire nouă. Corecția respectă baza HTML declarată și persistă amprenta conținutului vizibil și a legăturilor de contact; numai o cale descendentă repetitivă cu același conținut verificat încetează să extindă aceeași buclă. Paginile cu informații diferite continuă să fie parcurse. Nu este introdus un plafon total de pagini sau emailuri.

Emailurile cu dovadă publică se salvează și se verifică pe parcurs, chiar dacă site-ul mai are pagini în așteptare. Firma rămâne `pending` până la încheierea frontierei, iar acordul și starea contactului existent sunt păstrate. Nu se recitesc sau șterg automat dovezile anterioare și nu se resetează refuzurile ori pauzele serverelor.

Validare: 166 teste Marketing trecute, un test extern omis fără configurare, TypeScript și lint trecute. Verificarea reală și versiunile publicate se consemnează după publicare mai jos.


Confirmare 25.10.2026 09:33 EET: sandbox publică `7e7b9b462ff3812e000ad107ee6315b7ca6de0c7`, iar LIVE `093b432028538f2f7b1f839ae1896908932a93b9`; ambele sunt sănătoase, cu deploy-uri finalizate. Pe cele două site-uri afectate din sandbox, listele s-au stabilizat la 655 și 947 de adrese, iar paginile în așteptare au scăzut 40→37 și 55→52, fără generarea altor adrese repetitive. Această stabilizare a rezultat din respectarea bazei HTML; protecția suplimentară prin amprenta conținutului rămâne disponibilă pentru bucle fără o bază declarată.

Pe LIVE, după reluare, Constanța a avansat de la 5.584 la 5.585 înregistrări procesate. Șapte adrese au fost salvate din dovezile parțiale ale site-urilor: șase au fost verificate, ridicând totalul de la 1.562 la 1.568, iar una rămânea în verificare. Alte 105 erau invalide și 44 necesitau verificare. Site-urile restante și excepțiile de acces sunt încă în lucru; județul nu este declarat finalizat. București continua cu 10.202 înregistrări procesate și 122 emailuri verificate.

Brașov și Ilfov au rămas în `queued`. Livrarea este blocată și outboxul gol în ambele medii; ruta județelor răspunde 401/JSON fără sesiune. Sarcinile temporare au fost șterse și absența verificată. Monitorizarea periodică a conversației rămâne oprită.


### Cluj, Iași și Timiș pregătite după Brașov și Ilfov

La 25.10.2026 09:40 EET, utilizatorul a cerut pregătirea Clujului, Iașiului și Timișoarei. În contextul planului pe județe, Timișoara este inclusă în întreg județul Timiș (RO-TM), iar celelalte două sunt întreg județul Cluj (RO-CJ) și întreg județul Iași (RO-IS). Pregătirea înseamnă salvarea în coadă, fără pornirea surselor sau a colectării în această etapă.

Ordinea efectivă a joburilor este CT/B în lucru, apoi Brașov → Ilfov → Cluj → Iași → Timiș. Pozițiile explicite păstrează Clujul și Iașiul după Ilfov, chiar dacă ordinea implicită a listei geografice este diferită. Cele cinci județe viitoare sunt `queued`, fără activare separată și fără înregistrări importate.

Pregătirea a trecut două teste dedicate (ordine, păstrarea județelor active, idempotență și refuzul suprascrierii unui județ pornit), a fost verificată în sandbox și apoi aplicată pe LIVE. Nu a necesitat publicarea unei versiuni noi sau întreruperea colectorului. Livrarea este blocată, outboxul gol, monitorizarea periodică oprită. Sarcinile temporare au fost șterse și absența verificată.
