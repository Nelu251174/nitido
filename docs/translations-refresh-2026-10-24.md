# Completarea interfeței multilingve — versiune de lucru

Lucrarea este pregătită în cod, dar **nu este publicabilă**: cele 642 de texte noi trebuie completate în BG, HR, CS, DA, NL, EN, FR și DE. Manifestul este marcat explicit `complete: false`. Nu s-a publicat această etapă pe sandbox sau LIVE.

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

## Blocajul generării

După aprobarea explicită a unui plafon de 5 USD, s-a încercat generatorul existent cu cheia deja configurată pe sandbox. Au fost reutilizate cele 4.651 de traduceri existente per limbă; numai textele noi urmau să fie trimise. Serviciul a raportat cotă/sold indisponibil. Nu a returnat traduceri, iar contoarele de tokenuri de intrare și ieșire au rămas la zero. Nu s-au exportat chei și nu s-au trimis date ale clienților.

Sarcina temporară și cele șapte verificări de diagnostic au fost șterse după încheiere. Nu există o reluare automată. Checkpointul privat păstrează contabilizarea încercării; o reluare trebuie să respecte același plafon cumulat, fără resetarea lui.

Sandbox și LIVE au rămas sănătoase la sursa `d25796ca7e5bd8670eeb0326aa062e311aded729` din etapa GeoIP. Această etapă privește interfața web încărcată și de aplicațiile mobile; nu rezolvă și nu certifică problema separată de pornire a aplicației Android.

## Rămas pentru finalizare

Completarea și verificarea celor 642 de intrări în fiecare dintre cele opt cataloage, verificări în browser pentru toate cele nouă limbi, apoi backup, publicare pe sandbox și LIVE și verificări după publicare. Până atunci PR-ul rămâne draft și poarta de publicare rămâne închisă.
