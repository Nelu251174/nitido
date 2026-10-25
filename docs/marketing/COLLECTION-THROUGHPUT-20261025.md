# București: ritm de colectare și firme de curățenie

## Diagnostic real înaintea remedierii

La 25.10.2026, 11:14 EET (09:14 UTC), LIVE publica `07af7df1146ff34e5734a74140b03dd0f5dac47d`, sănătos. Colectorul era activ, cu livrarea oprită.

- București avea 864 de contacte în Market: 672 de emailuri distincte și 192 de contacte fără email, cu website. Dintre emailurile contactelor, 333 erau verificate tehnic. Numărul de contacte afișat nu este numărul de căsuțe verificate.
- Inventarul OSM cuprindea 14.001 înregistrări, inclusiv două încadrate explicit ca firme de curățenie. Una nu avea website/email; cealaltă avea ambele, dar încă aștepta procesarea. OSM singur nu oferă lista completă a firmelor de curățenie.
- Toate cele 413 categorii ale catalogului erau descoperite, dar lista București din categoria `curatenie-servicii` încă aștepta. Se citiseră 94 de liste din alte categorii; 3.728 de profiluri descoperite încă așteptau citirea. Ordinea veche procesa toate listele înaintea oricărui profil.
- Adresele deja prezente în sursa importată așteptau selectarea firmei pentru verificarea site-ului. În plus, frontierele deja începute aveau prioritate față de site-urile încă neîncepute, iar verificarea timpurie a emailurilor era limitată la trei adrese per tură.
- Clasificarea profilurilor de catalog folosea numele firmei, fără a folosi categoria explicită a listei. Numele generic al unei firme de curățenie putea fi încadrat ca business.

## Remediere

- O rotație persistentă alternează categoria de curățenie, profilurile, listele și categoriile. Profilurile nu mai așteaptă epuizarea tuturor listelor. Fiecare frontieră păstrează ture și progres; nu se elimină categorii sau pagini pentru a crește artificial viteza.
- Proveniența explicită din categoria de servicii de curățenie este păstrată și folosită la clasificarea inventarului. Un profil găsit anterior în altă categorie păstrează această dovadă când este descoperit și în categoria de curățenie. Categoriile și acordurile contactelor existente nu sunt suprascrise automat.
- Emailurile deja capturate în sursa publică sunt salvate înaintea parcurgerii site-ului, în loturi reluabile de 100 de firme. Limita este per lot; nu există plafon total. Firma rămâne pending până la încheierea frontierei și sunt respectate termenele site-ului.
- Se verifică până la 20 de adrese timpurii într-un buget de cinci secunde, cu cache DNS comun. Un răspuns DNS lent poate depăși o singură dată bugetul cu cel mult durata cererii existente; nu se deschid conexiuni SMTP.
- Site-urile neîncepute pot avansa înaintea unor frontiere adânci deja încercate. Prioritatea pentru firmele de curățenie se aplică între înregistrările cu aceeași vechime a încercării.

Rămân active pauzele robots/Crawl-delay/Retry-After, refuzurile de acces, timeouturile și lucrătorul exclusiv pentru CT/B. Intervalul minim existent al catalogului este trei secunde; nu este eliminat. Nu este promis un termen de finalizare sau un număr de emailuri pe care sursele nu îl demonstrează.

## Verificare

199 teste Marketing trecute; un test extern omis fără configurare. TypeScript și ESLint trecute. Testele noi acoperă progresul profilurilor în prezența a 500 de liste, rotația persistentă, clasificarea din sursă, proveniența multiplă, păstrarea Retry-After/403, salvarea tuturor loturilor de dovezi înaintea site-urilor, acordurile retrase și limita de timp DNS.

Sandbox publică `4bd0fd2de2f0d3152a1549a6101a0c91dd17a9c9`, sănătos. După reluare, primul instantaneu avea 947 de contacte București (inclusiv un contact de curățenie), iar următorul avea 1.036 (inclusiv două de curățenie). Două profiluri din categoria explicită de curățenie erau citite și integrate în inventar, iar 48 așteptau; alte șapte liste de curățenie rămâneau de parcurs. Emailurile contactelor erau 808, dintre care 407 verificate tehnic. Cele două emailuri de curățenie încă așteptau verificarea tehnică; nu sunt declarate căsuțe verificate.

LIVE publică `62c8d0b26634a49a647c0c9015dc6556cd69df24`, sănătos, după finalizarea deploy-ului și reluarea exactă a CT/B. Instantaneul dinaintea publicării avea 958 de contacte București (inclusiv unul de curățenie) și 372 de emailuri verificate tehnic. După reluare, instantaneul avea 1.153 de contacte (inclusiv două de curățenie) și 415 emailuri verificate tehnic. Un profil din categoria explicită de curățenie era citit, 49 așteptau și șapte liste de curățenie rămâneau de parcurs. Cele două emailuri de curățenie încă așteptau verificarea tehnică. Creșterea observată nu reprezintă o promisiune de ritm constant.

CT/B rămân în colectare și nu sunt declarate finalizate. Livrarea este blocată; monitorizarea periodică a conversației nu a fost repornită. Nu s-au modificat autentificarea sau alte module.


Verificarea finală confirmă CT/B în `collecting`, BV/IF/CJ/IS/TM în `queued`, livrarea blocată și outboxul gol. Sarcinile temporare de diagnostic din sandbox și LIVE au fost șterse, iar absența lor a fost verificată.
