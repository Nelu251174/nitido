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

Verificări locale: 139 de teste Marketing trecute (un test de fum extern este omis fără configurarea lui), inclusiv CSV cu 100.001 rânduri/501 loturi, manifest cu 100.001 înregistrări, export peste 5.000, integritatea loturilor, mai multe adrese/firmă, acord retras păstrat, limite geografice și blocarea Bucureștiului. Buildul de producție a trecut cu trimiterea Marketing oprită. Starea efectiv publicată și rezultatele reale trebuie verificate separat în Coolify; documentul nu reprezintă o declarație de finalizare a județului.
