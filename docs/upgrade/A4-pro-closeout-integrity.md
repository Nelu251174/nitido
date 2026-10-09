# A4 — controlul remedierii și închiderii Pro

## Probleme reproduse și remediate

- Reprogramarea pentru remediere putea suprapune o altă lucrare activă pe aceeași proprietate. Acum verifică intervalul înainte de modificare, în tranzacția comenzii. Intervalele adiacente rămân permise.
- Costul final anterior rămânea atașat unei lucrări retrimise la execuție. Remedierea îl resetează împreună cu checklistul, iar auditul păstrează costul, răspunsurile și intervalul anterior, plus noul interval. Costul necesită o nouă trimitere spre verificare.
- Anularea lăsa devize pending. Acestea devin superseded în aceeași tranzacție; deciziile istorice rămân păstrate și nicio aprobare nouă nu se poate executa pe lucrarea închisă.
- Un operator limitat la o proprietate putea modifica un cost general fără property_id. Scope-ul null cere acum un rol autorizat cu acces general. O apartenență viewer generală nu extinde drepturile operatorului. Listarea și modificarea folosesc aceeași regulă.

## Verificare

Cele trei defecte principale au fost reproduse prin teste care eșuau înaintea corecției. Au fost adăugate șapte scenarii:

1. Respingerea remedierii suprapuse, păstrarea raportului și acceptarea unui interval adiacent.
2. Închiderea aprobărilor pending la anulare, cu istoric păstrat.
3–5. Erori injectate separat la cost, audit și notificare: închiderea este anulată complet, apoi reluată fără cost sau audit duplicat.
6. Modificarea costurilor în limitele proprietăților autorizate, inclusiv costuri generale și roluri mixte.
7. Parcurs API: rezervare, blocare înainte de aprobare, aprobator separat, ofertare, protejarea adresei, acceptare, execuție, checklist, dovadă foto, cost autorizat, control calitate, retry și export cu un singur cost.

Ultimul scenariu folosește o înregistrare media de test și autentificare simulată; nu reprezintă un upload de pe telefon sau o probă în sandbox. Tranzacțiile rulează pe SQLite de test cu chei externe active. Testul existent de eșec al auditului la anulare verifică și păstrarea devizului pending după rollback.

51 teste Pro trecute cu TZ=UTC și TZ=Europe/Bucharest. TypeScript noEmit și git diff --check trecute.

## Starea livrării

Pachetul continuă PR #79 și include corecțiile precedente. Tema crem este păstrată. Nu există migrare de schemă, schimbare Stripe sau prag comercial nou. Nu s-a publicat în LIVE, TestFlight ori Google Play.

A4 rămâne în pregătirea pilotului. Validarea browser pe roluri în sandbox, dispozitivele mobile, backup/restaurare și pilotul real nu sunt declarate închise. Automatizările A5 care schimbă alocarea așteaptă rezultatele pilotului și pragurile aprobate.
