# Marketing Constanța: inventar OSM verificat, independent de Overpass

API-ul Overpass nu a returnat antete HTTP din sandbox nici pentru o interogare minimă cu fereastră de transport de 90 de secunde. Creșterea timeoutului nu rezolvă blocajul. Colectarea Constanța poate folosi acum un inventar local pregătit din extractul public oficial OSM România de la Geofabrik; procesarea contactelor, deduplicarea, acordurile și exportul rămân cele existente în Marketing.

## Inventarul real

Pregătirea din sandbox a descărcat și verificat integral `331678126` octeți. Cele patru treceri au procesat fiecare `45808442` entități OSM. A fost identificată o singură relație administrativă Constanța, nivel 8/9: `10487782`. Segmentele limitei sunt închise în inele; golurile și punctele din afara limitei sunt excluse. Sunt incluse nodurile, căile și relațiile comerciale din aceleași categorii folosite de colectorul anterior, inclusiv relațiile cu membri imbricați.

Rezultatul este un inventar real de **2337 înregistrări**, într-un fișier de **239017 octeți**. Nu sunt date sintetice. Inventarul nu este registrul ONRC și poate include puncte de lucru ale aceleiași firme; nu garantează un email pentru fiecare înregistrare.

## Pregătire și import

`scripts/marketing-osm-snapshot.cjs` se execută manual dintr-un commit fixat, întâi în sandbox. Pe LIVE cere explicit argumentul `--live`. Refuză origini necunoscute și livrarea Marketing activată. Nu deschide baza aplicației și nu importă module de mesagerie.

Scriptul descarcă doar extractul public România, fără metadatele personale ale contributorilor. Verifică dimensiunea declarată și efectivă, checksumul public al transferului și data sursei. Instalarea parserului fixat la versiunea 2.3.0 folosește un director temporar, cu scripturile npm dezactivate. Arhiva și uneltele sunt eliminate după pregătire. Limita arhivei este 600 MB; spațiul liber și memoria procesului sunt limitate. Această pregătire manuală este separată de cota cererilor Overpass și nu este programată recurent.

Fișierul final se publică atomic la `/app/data/marketing-sources/constanta-osm.json`, cu permisiuni private. Conține identificatorii OSM originali și tagurile necesare firmelor; nu păstrează metadatele contributorilor.

Colectorul verifică originea declarată, municipiul, vechimea de maximum 14 zile, relația administrativă, dimensiunea de maximum 2 MB și SHA-256 al conținutului. Refuză fișierele incomplete, expirate, modificate și linkurile simbolice. Un fișier invalid oprește importul; nu este interpretat ca rezultat gol. În lipsa fișierului, comportamentul Overpass existent este păstrat. Celelalte municipii nu folosesc acest fișier.

Citirea inventarului local nu consumă cota HTTP Overpass. Căutările externe păstrează cotele existente. Răspunsurile 429/503 respectă `Retry-After`, inclusiv după atingerea numărului maxim de încercări și la reluarea manuală. Răspunsurile 403/406 pun colectarea în pauză imediat.

## Procesarea contactelor

Emailurile deja publicate în sursă sunt procesate înaintea site-urilor care pot răspunde lent. Lotul poate include până la 200 de înregistrări locale, cu bugetul existent de 15 secunde verificat între firme. Cererile web rămân seriale, cu verificări DNS/adrese publice, TLS, proxy, robots.txt și limitele individuale existente. Inventarul, progresul și contactele persistă la repornire.

Contactele noi rămân `new` / `not_recorded`. Duplicatele și contactele existente, inclusiv dezabonările, nu sunt suprascrise. Înregistrările fără email/site rămân în inventar și export. Trimiterea Marketing rămâne oprită prin configurația Compose LIVE existentă. Niciun script de pregătire sau verificare nu trimite mesaje.

## Validare

- 107 teste Vitest Marketing trecute, plus suitele Node pentru pregătirea extractului și pornirea jobului.
- Teste pentru limite închise/incomplete, segmente inversate, goluri, relații imbricate/ciclice, categorii și păstrarea exclusivă a datelor necesare.
- Teste pentru integritate, dimensiune, vechime, sursă, limită administrativă, fișiere lipsă/linkuri și refuzul importului invalid.
- Teste pentru procesarea inventarului local cu cota Overpass epuizată, prioritizarea emailurilor publice, timpul verificărilor web și pauzele furnizorului.
- Builduri locale de producție pentru sandbox și LIVE trecute. Pentru acest executor izolat s-a folosit opțiunea de cache documentată de SWC; configurația aplicației și dependențele publicate nu au fost schimbate.
- Diferența față de versiunile publicate privește exclusiv Marketing. Autentificarea, inițializarea bazei și celelalte module rămân identice cu bazele fiecărui mediu.

Rezultatele publicate și numerele actualizate ale contactelor sunt în descrierea PR #150. Sarcinile de intervenție sunt dezactivate și sunt șterse după verificare; colectarea continuă prin workerul obișnuit al aplicației.

Surse: [extractul oficial România](https://download.geofabrik.de/europe/romania.html), [format și procesare Geofabrik](https://download.geofabrik.de/technical.html), [licența ODbL](https://www.openstreetmap.org/copyright).
