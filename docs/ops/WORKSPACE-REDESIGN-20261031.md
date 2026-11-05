# CLIENT și ADMIN — reorganizarea spațiilor de lucru

Implementarea pornește din versiunea LIVE `c2d8bd57b00dcb80de4ed82172ef0d0492ca479b`,
ramura `codex/admin-inbox-compact-20261030`. Beneficiarul a aprobat propunerea comună
pentru cele două zone și a cerut schimbarea efectivă a interfeței.

## CLIENT

Navigarea principală are șase destinații: Acasă, Rezervări, Locuințe, Mesaje,
Plăți și Cont. Rezervarea nouă are o acțiune separată. Acasă prioritizează
rezervarea reală, acțiunile existente și ultimele trei rezervări. Funcțiile
suplimentare rămân accesibile într-o zonă compactă și în contextul lor.

Pagini noi: `/client/rezervari`, `/client/plati`, `/client/cont`. Fluxul existent
de configurare și operațiunile financiare sunt reutilizate în `ClientWorkspace`.
Legăturile vechi cu fragmente și bara de navigare mobilă rămân compatibile.
Căutarea și referința rezervării se păstrează în adresă, inclusiv la reîncărcare.

## ADMIN

Cadru comun, identitate și rol vizibile, deconectare și navigare filtrată după
permisiunile existente. Module: Azi, Lucrări, Clienți, Firme, Suport și calitate,
Financiar, Marketing și Rapoarte; Setări este o destinație utilitară.
Rolul financiar intră în Financiar, fără a primi acces operațional suplimentar.

Pagina Azi folosește un endpoint de citire dedicat. Programările se numără în
ziua Europe/Bucharest, inclusiv la schimbarea orei. Semnalele sunt grupate pe
lucrare, cu motivele păstrate și limitele sursei afișate. Excepțiile financiare
sunt separate de simpla stare de așteptare. Listele sunt filtrate înaintea
paginării; datele private păstrează restricțiile existente pe rol.

Fișa lucrării păstrează contextul listei și leagă clientul, firma, plata și
incidentele. Clienții au listă și fișă cu file și paginare separată pe istoric.
Incidentele au listă și dosar cu Rezumat, Verificare, Rezoluție și Istoric;
componentele de rezoluție se încarcă numai când sunt deschise.

Actualizarea periodică se limitează la modulul vizibil. Registrele complete
se actualizează explicit. Răspunsurile de refuz elimină datele private afișate.

## Protecții

Comanda de ștergere globală a istoricului este eliminată din interfața LIVE.
Endpointul refuză producția, development și sandboxurile găzduite. Este permis
numai testul local explicit activat, cu sesiune Super Admin și origini locale
concordante. Nu au fost șterse date pentru această reorganizare.

Sesiunile CLIENT și ADMIN, MFA, regulile de preț și operațiunile financiare nu
sunt înlocuite. Nu există migrare de schemă. Stilurile noi sunt limitate la
spațiile CLIENT/ADMIN, inclusiv paginile secundare CLIENT; FIRMA și paginile
publice își păstrează cadrul.

## Verificare

- Testele de regresie se rulează cu `npx vitest run`.
- `npm run lint`, TypeScript și `npm run build` verifică sursa și candidatul.
- Copia nouă a interfeței CLIENT este inclusă în toate cele nouă limbi publicate.
- `scripts/workspace-redesign-browser.mjs` creează un director și o bază de date
  exclusiv sintetice, autentifică un client și cele patru roluri ADMIN prin
  handler-ele reale, inclusiv MFA, și verifică rutele, izolarea și încadrarea.
- Browserul blochează cererile externe; credențialele serviciilor nu sunt
  moștenite în aplicația de test și transporturile externe sunt dezactivate.
- Pentru verificarea buildului: `NITIDO_QA_BUILD_PATH="$PWD/.next" node scripts/workspace-redesign-browser.mjs`.
  Playwright și Chromium trebuie să fie instalate; căile pot fi indicate prin
  `NITIDO_QA_PLAYWRIGHT` și `NITIDO_QA_CHROMIUM`. Dovezile sunt scrise în directorul
  `NITIDO_QA_OUTPUT`, implicit într-un director temporar separat.

Capturile browserului sunt probe ale interfeței cu date sintetice. Nu dovedesc
testare pe telefoane fizice, recepție push, livrare de email sau tranzacții Stripe.

Rezultate locale pe candidatul final, 31 octombrie 2026:

- 2.857 de teste trecute în 282 de fișiere; un test extern omis fără configurație.
- Build de producție și TypeScript trecute; cataloagele celor nouă limbi validate.
- ESLint fără erori; avertisment preexistent într-un script de audit arhivat.
- 25 de verificări browser și 21 de încadrări la 390/768/1440 px trecute,
  fără erori JavaScript. Include autentificarea reală a unui client și a celor
  patru roluri ADMIN, MFA, rute separate, context și refuzul resetării globale.
- Revizuirea locală de securitate nu a identificat blocaje P0/P1.

## Instalare și revenire

Se verifică întâi candidatul în sandbox, apoi în LIVE, păstrând configurația,
volumele și sarcinile programate ale fiecărui mediu. Nu se copiază baza LIVE
într-un mediu de test. Se consemnează separat SHA-ul instalat, rezultatul
deployului și probele HTTP; pornirea unui deploy nu înseamnă instalare reușită.

Revenirea se face la ramura/SHA-ul anterior al fiecărui mediu, păstrând volumele
actuale. Nu se restaurează o bază veche peste date apărute între timp. Deoarece
schema nu este modificată, revenirea interfeței nu necesită migrare inversă.

## Corecție de navigare și paletă — 31 octombrie 2026

În buildul `610b006`, navigarea prin click între paginile CLIENT remonta
consumatorul autentificării. Până la răspunsul `/api/auth/me`, acesta înlocuia
întregul cadru cu mesajul de încărcare. Cu răspunsul întârziat artificial cu
450 ms, 18 din 39 de tranziții CLIENT/ADMIN au pierdut cadrul CLIENT pentru
433–465 ms; lățimea rămânea constantă cât timp cadrul era prezent.

Starea contului CLIENT aparține acum layoutului care persistă între pagini.
Fiecare schimbare de adresă reverifică sesiunea fără să elimine contul pe
durata cererii. Refuzul autentificării sau eroarea de rețea elimină identitatea;
cererile depășite sunt anulate și răspunsurile lor sunt ignorate. Starea nu
supraviețuiește demontării layoutului la deconectare. În afara layoutului CLIENT,
hookul păstrează verificarea independentă folosită de FIRMA.

Panourile ADMIN mai vechi folosesc aceleași suprafețe neutre și borduri ca
restul cadrului. Filele Marketing selectate au text alb pe verde închis.
Stările de eroare, avertizare și succes rămân distincte. Tokenurile sunt
limitate la ADMIN; componentele folosite separat păstrează valorile anterioare.

`scripts/workspace-navigation-browser.mjs` verifică efectiv clickurile dintre
pagini și file, inclusiv revenirea repetată la Acasă, la 390/1440/2048 px.
`NITIDO_QA_ENFORCE_STABILITY=true` impune păstrarea cadrului, lățimii și poziției
principale la desktop, fără reîncărcarea documentului. Fixture-ul local, MFA,
blocarea cererilor externe și opțiunile de build sunt aceleași ca la verificarea
anterioară. Raportul include cadrele animate și culorile calculate în browser.

Rezultatul corecției: 72 de tranziții prin click fără dispariția cadrului,
reîncărcarea documentului, deplasarea lățimii la desktop sau depășirea
orizontală a ecranului; fără erori JavaScript. Include 21 de navigări CLIENT,
toate cele nouă destinații ADMIN și filele din Setări, Rapoarte, Financiar,
Suport, Marketing și dosarul incidentului. Cele 72 de probe de culoare și
12 verificări suplimentare ale paletei au trecut. Buildul de producție,
TypeScript și validarea traducerilor au trecut; ESLint are numai avertismentul
preexistent menționat mai sus. Suita completă: 2.862 teste trecute și un test
extern omis, în 283 de fișiere trecute. Revizuirea separată a autentificării
nu a identificat un regres material.

## Corecție siglă PARTENER — 31 octombrie 2026

Sigla din meniul FIRMA trimitea la `/`, iar componenta `Logo` înlocuia explicit
destinațiile `/firma` și `/client` cu pagina publică. Componenta respectă acum
destinația primită; siglele din paginile principale și meniurile autentificate
trimit la `/firma`, `/client` sau `/admin`, după caz.

Verificare în buildul de producție: 20 de scenarii prin click, la 390 și
1440 px, cu conturi sintetice FIRMA/CLIENT și autentificare ADMIN cu MFA.
Include pagina principală FIRMA, Calendar, Mesaje și Setări, patru secțiuni
CLIENT și două ADMIN. Destinația rămâne în contul corespunzător, sesiunea
este reverificată după click și nu apar erori JavaScript. Cele 13 teste
existente de navigare și autentificare, buildul și ESLint au trecut.
