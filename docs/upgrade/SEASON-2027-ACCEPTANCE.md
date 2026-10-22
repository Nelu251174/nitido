# Acceptanță — loturile 1–3, sezon 2027

**Stare globală: BLOCAT pentru LIVE.** Candidatul nu primește VERDE numai din teste automate. Verificarea interactivă în browser și probele în aplicațiile oficiale nu au fost executate în această sesiune.

## Inventarul schimbării

| Intrare | Controale / funcție | Dovadă automată | Acceptanță vizuală |
|---|---|---|---|
| `/curatenie-de-primavara` | Configuratorul existent, spațiu/suprafață/băi/geamuri, înainte/înapoi/modificare, transfer către cerere; evaluare pentru cerințe speciale | `Season2027Flows.test.tsx`, testele existente de configurator, draft și preț | NETESTAT |
| `/client/rutina` | Autentificare client, creare unică, lista seriilor, frecvență, proprietate, preț pe vizită, firmă preferată | `Season2027Flows.test.tsx`, `recurring.test.ts`, `api/recurring/route.test.ts` | NETESTAT |
| Rutina — administrare | Pauză/reluare/oprire; editarea programului, previzualizarea pauzei de vacanță, refuzul pauzei peste vizite active, eliminarea pauzei, generare explicită | Teste DOM cu răspunsuri simulate și teste de integrare în SQLite izolat | NETESTAT |
| `/firma/planificare` | Prima zi, șapte zile înainte/înapoi, actualizare/reîncercare; linkuri către calendar, echipe și formularul de intervale | `Season2027Flows.test.tsx` | NETESTAT |
| `/api/availability/planning` | Citire pe firma autentificată, date limitate, rate limit, fără cache, erori și izolare între conturi | `providerPlanning.test.ts`, `api/availability/planning/route.test.ts` | Nu înlocuiește proba interactivă |
| Planificare — calendar | Lucrări confirmate cu durată/deplasare, intervale în verificare, suprapuneri, indisponibilități, date fără program valid, ora de vară 2027 | `providerPlanning.test.ts` | NETESTAT |
| Sesiune / rețea | Recuperare după eșecul verificării contului, sesiune expirată, răspuns incomplet, răspuns după demontare | `useCurrentUser.test.tsx` | NETESTAT |
| Intrări NEW | Carduri public/client și meniu pe rol; ancora formularului de publicare a intervalului | Testele de intrări și verificări de sursă; urmează proba tactilă | NETESTAT |

Testele DOM acționează controalele cu date sintetice și răspunsuri HTTP simulate. Testele server folosesc SQLite izolat sau dependențe simulate. Ele nu demonstrează o rezervare comercială LIVE sau afișarea pe telefon.

## Blocaje și verificări rămase

1. Browserul conectat și un browser CUA de testare nu sunt disponibile prin uneltele acestei sesiuni. Sunt necesare probe interactive pentru control, focus, scroll, contrast și layout la 1366/1920 și 360/390/430 px.
2. Android și iOS: probe pe aplicațiile oficiale pentru autentificare, noutăți, programare, revenire din fundal și navigare. Nu se distribuie builduri în magazine pe baza testelor web.
3. Limbile publicate: textele noi au mecanismul existent de fallback în română; completarea și revizia traducerilor noi rămân parte din acceptanță. Catalogul existent nu este declarat complet pentru această extensie numai pentru că validatorul anterior trece.
4. Pilotul disponibilităților reale necesită firme și intervale reale validate. Sumarul de planificare nu activează pilotul și nu publică intervale fictive.
5. Regresia generală vizuală a întregii platforme, inclusiv fluxul comercial complet, trebuie consemnată separat; suita automată nu echivalează cu verificarea manuală a fiecărei pagini existente.
6. Backup extern, volum de vârf și recuperare după pierderea serverului: inventariere și probe separate înaintea extinderii de sezon. Backupul anterior pe volum nu este prezentat drept backup extern.

## Publicare și revenire

Se folosește numai mediul de test existent pentru build și verificări înainte de publicare. LIVE rămâne la `432d4f90ba37ee1cf18489117d20cc59e6a2a19a` până la închiderea porții de acceptanță. Nu se modifică prețuri, comision, Stripe, cronuri sau date comerciale pentru testare.

Acest lot nu introduce migrări de schemă. Revenirea codului în mediul de test folosește versiunea anterioară consemnată înaintea buildului. La publicarea LIVE ulterioară se pregătește checkpoint nou și se verifică restaurarea; nu se restaurează o bază veche peste tranzacții noi și nu se relansează plăți sau notificări.

Loturile 4–7 sunt definite în brief și rămân neimplementate în acest candidat. Rezultatele și identificatorul exact al buildului sunt în raportul de execuție livrat împreună cu brief-ul.
