# Completarea interfeței multilingve

Versiunea este publicată și verificată pe sandbox și LIVE: **nouă limbi existente, fiecare cu 5.299 de texte**. Cele 648 de intrări adăugate în fiecare catalog acoperă paginile publice, rezervarea și conturile. Domeniul rămâne `ro`, `bg`, `hr`, `cs`, `da`, `nl`, `en`, `fr`, `de`.

## Modificare

Migrarea procesează acum și fișierele care importau deja `UiText`, unește importurile și verifică separat conectarea textelor la traducere. Extragerea include și forma scurtă `<UiText text="Recenzii"/>`. Cele șase etichete scurte omise au fost completate în toate limbile; două traduceri existente din meniul danez au fost corectate manual.

`UiElement` traduce atributele de accesibilitate, imaginile și etichetele inclusiv pentru componentele Image/Link. Valorile formularelor, destinațiile, acțiunile și conținutul utilizatorilor rămân separate de traducere. Testele verifică păstrarea textului recenziilor și a numelui firmei. Insigna de noutate este verificată în limba aleasă.

Verificările `prebuild` resping sursa neacoperită, textele neconectate și cataloagele incomplete. CI folosește aceeași poartă ca imaginea de publicare. Catalogul sursă conține 5.223 de texte extrase și 76 de intrări existente păstrate pentru utilizări dinamice.

Au fost corectate contrastul paginii „Despre noi”, contrastul legăturii „Acasă” de pe telefon și dimensionarea grilelor cu texte daneze/olandeze mai lungi. Cercul pur decorativ din pagina „Despre noi” nu mai este expus cititoarelor de ecran.

## Verificări

- Regresie GitHub: 2.323 de teste Vitest în 221 de fișiere, ESLint și compilarea de producție trecute, [execuția 40036037290](https://github.com/Nelu251174/nitido/actions/runs/40036037290).
- 17 teste pentru cataloage, extragere, generator și filtrarea exportului: trecute, fără apeluri externe.
- ESLint și TypeScript: fără erori; compilarea de producție și poarta completă de publicare trec.
- Verificare statică: apelurile externe și atributele de control/formulare din cele 46 de fișiere de interfață sunt păstrate.
- Browser izolat, bază de date sintetică: 72 de verificări funcționale, 72 de pagini și 288 de vizualizări la 360, 390, 768 și 1440 px, în toate cele nouă limbi. Fără erori JavaScript, depășiri sau încălcări WCAG detectate după corecția contrastului paginii de pornire.
- Ultima corecție schimbă exclusiv culoarea legăturii „Acasă”. Compilarea de producție și cele nouă pagini de pornire au fost reverificate după această corecție; celelalte 63 de pagini păstrează rezultatul din aceeași versiune de cataloage și layout.
- Compilarea iOS nesemnată pe sursa `07d0d6845501c2d1b966fc6cf22982a50582b644`: trecută. Nu s-a încărcat un binar nou în magazine.

## Cost și preluarea cataloagelor

Generarea celor opt traduceri a consumat 90 de cereri, 269.042 de tokenuri de intrare și 159.269 de ieșire. Costul înregistrat, calculat conservator de generator, este **0,918492 USD**, sub plafonul aprobat de 5 USD. Completările manuale nu au implicat alte apeluri la furnizor. Fișierul `catalog-generation-20261024.json` păstrează separat chitanța și hash-urile artefactelor originale cu 5.293 de intrări, înainte de cele șase completări manuale.

Cataloagele au fost preluate prin integrarea GitHub/Coolify existentă, folosind accesul de citire a jurnalelor și un filtru strict pentru marcajul acestei execuții, revizie, fișiere permise și SHA-256. Nu s-a creat serviciul temporar refuzat de utilizator, nu s-au montat volume suplimentare și nu s-au exportat jurnale brute, chei, fotografii sau baze de date. Sarcinile punctuale sunt încheiate și eliminate; fluxul de export este exclusiv manual.

## Publicare și limite

Sursa publicată este `b978d3da887427f8a612207424ea31f5fc3a2b45`. Sandbox: 24 octombrie 2026, 01:56:11; LIVE: 01:58:49, ora României. Ambele sunt sănătoase. Au trecut 66 de verificări ale paginilor/API-urilor, 48 de resurse JS/CSS și 36 de probe ale limbii manuale și ale textelor publicate; regulile CSS corectate sunt prezente pe ambele medii. Copiile de siguranță și restaurarea izolată au trecut înaintea publicării. Codul pentru revenire este `d25796ca7e5bd8670eeb0326aa062e311aded729`; volumele bazei de date și ale fișierelor sunt păstrate.

Dovezile de backup, restaurare izolată, CI și publicare sunt păstrate în `docs/evidence/translations-refresh-20261024.json`.

Această etapă actualizează interfața web încărcată și de aplicațiile mobile. Nu modifică schema bazei de date, prețurile sau fluxurile de plată și nu trimite notificări. Nu certifică remedierea problemei separate de pornire a aplicației Android. Traducerile generate automat necesită în continuare revizie lingvistică specializată pentru textele juridice.
