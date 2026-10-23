# Completarea interfeței multilingve — versiune de lucru

Lucrarea este pregătită în cod, iar generarea celor opt cataloage a reușit pe sandbox. **Publicarea este blocată de preluarea fișierelor generate.** Cataloagele din ramură nu au fost încă înlocuite; manifestul rămâne explicit `complete: false`. Nu s-a publicat această etapă pe sandbox sau LIVE.

## Modificare

Textele noi din fișiere care importau deja `UiText` erau omise de migrarea automată. Migrarea procesează acum și aceste fișiere, unește importurile existente și are un mod `--check` care nu modifică sursa. Verificarea este inclusă în `prebuild`, împreună cu acoperirea sursei și validarea cataloagelor.

Robotul principal de verificare folosește acum `npm run build`, astfel încât să ruleze și poarta `prebuild`, la fel ca imaginea Docker de publicare.

Au fost conectate la traducere textele de afișare din paginile publice și conturi, inclusiv etichete de accesibilitate, imagini și legături. Adaptorul `UiElement` acceptă și componentele Image/Link. Valorile formularelor, adresele legăturilor, acțiunile și conținutul utilizatorilor rămân separate de traducere. Testele pentru evaluări verifică explicit păstrarea textului clientului și a numelui firmei.

Verificarea paginii „Despre noi” a identificat contrast insuficient la numerotarea cardurilor și în zona verde de la final. Culorile locale au fost corectate, iar cercul pur decorativ este marcat `aria-hidden`.

Catalogul sursă conține 5.293 de mesaje: 5.213 extrase din codul actual și 80 de intrări existente păstrate pentru utilizări dinamice. Sunt 642 de mesaje noi, cu 40.371 de caractere. Cele opt cataloage publicate anterior au fiecare 4.651 de intrări; nu sunt înlocuite cu texte românești pentru a simula completitudinea. Domeniul rămâne cele nouă limbi existente, fără activarea celor 15 limbi amânate.

## Verificări

- 2.323 de teste Vitest în 221 de fișiere: trecute.
- 13 teste ale cataloagelor, acoperirii sursei și generatorului: trecute, fără apeluri externe.
- ESLint și TypeScript: fără erori.
- Verificare statică a celor 46 de fișiere de interfață: apelurile externe și atributele de acțiune, acces și formulare existente sunt păstrate.
- Verificările sursei și conectării textelor la traducere: trecute, fără modificări suplimentare necesare.
- Compilare Next.js de producție: trecută. Această probă de compilare a fost rulată separat de poarta de publicare; nu reprezintă o versiune multilingvă publicabilă.
- Browser de producție izolat, cu date sintetice: 48 de verificări, 24 de pagini și 72 de vizualizări la lățimi de 360, 768 și 1440 px; fără erori de pagină, depășiri sau încălcări WCAG detectate. Această probă verifică interfața română de rezervă, nu completitudinea celor opt traduceri încă lipsă.
- Validarea pentru publicare respinge corect cataloagele incomplete.

Rezultatele structurate sunt în `docs/evidence/translations-refresh-20261024.json`.

## Generare încheiată; accesul la artefacte rămâne blocat

Generarea a fost reluată cu același checkpoint privat și același plafon cumulat de 5 USD, după rezolvarea cotei furnizorului. Execuția s-a încheiat cu succes la 23 octombrie 2026, 21:58:43 UTC (24 octombrie, 00:58:43 în România). Scriptul confirmă succesul numai după validarea tuturor celor opt cataloage, a celor 5.293 de intrări per limbă, a valorilor protejate și a manifestului cu nouă limbi și hash-ul sursei corect. Sarcina de generare a fost eliminată după încheiere. Nu este programată o reluare și nu este necesară regenerarea textelor.

Fișierele sunt păstrate în checkpointul privat al sandboxului. Tokenul disponibil sesiunii nu permite citirea jurnalelor (`read:sensitive` lipsește). Alternativa prin integrarea GitHub/Coolify existentă a fost testată fără chei sau servicii noi, dar autentificarea acelei integrări este respinsă cu HTTP 401, înainte de crearea vreunei sarcini de export. Fluxul de export este acum exclusiv manual. Cele trei teste ale filtrării artefactelor și ale opririi la permisiuni insuficiente trec. Nu sunt încă disponibile cifrele finale de utilizare/cost din checkpoint.

Nu s-a creat serviciul temporar propus pentru descărcare; utilizatorul l-a refuzat. Nu s-au montat volume suplimentare și nu s-a publicat un endpoint nou. Nu s-au exportat chei, fotografii, baze de date sau jurnale brute.

Sandbox și LIVE au rămas sănătoase la sursa `d25796ca7e5bd8670eeb0326aa062e311aded729` din etapa GeoIP. Această etapă privește interfața web încărcată și de aplicațiile mobile; nu rezolvă și nu certifică problema separată de pornire a aplicației Android.

## Rămas pentru finalizare

Preluarea cataloagelor deja generate printr-un acces de citire autorizat, validarea lor în ramură, verificări în browser pentru toate cele nouă limbi, apoi backup, publicare pe sandbox și LIVE și verificări după publicare. Până atunci PR-ul rămâne draft și poarta de publicare rămâne închisă.
