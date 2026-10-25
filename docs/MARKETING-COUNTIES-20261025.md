# Marketing: județe și colectare publică

Cerința curentă este întreg județul Constanța, urmat de București (separat de Ilfov). Cele 2.337 de înregistrări procesate anterior priveau municipiul, nu județul.

Market se deschide în secțiunea Județe, cu toate cele 41 de județe și București. Contactele au apartenențe județ/localitate, iar o adresă comună mai multor sedii rămâne vizibilă în fiecare județ sursă fără schimbarea acordului, categoriei sau a stării contactului existent. Inventarul separat include și firmele pentru care nu s-a găsit email. Localitatea necunoscută este etichetată explicit; nu este înlocuită cu municipiul reședință.

Nu există plafon de 200 de contacte pe județ. Limitele de 200 de rânduri și 250 KB sunt limite de cerere/lot pentru formularul mic. Importul de volum citește fișierul treptat, validează toate loturile, prezintă primele 25 de contacte și apoi salvează toate loturile, cu progres și respectarea limitei de cereri. Reluarea omite duplicatele. Exportul trimite toate rezultatele filtrate în pagini interne de 500, fără vechea trunchiere la 5.000.

Colectorul persistă coada CT → B, inventarul și progresul. Încărcarea paginii nu pornește colectarea. Un județ anterior în pauză sau cu acoperirea nerevizuită blochează județele următoare. Se utilizează aceeași închiriere exclusivă a colectorului existent; nu rulează lucrători concurenți asupra aceleiași cozi.

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
