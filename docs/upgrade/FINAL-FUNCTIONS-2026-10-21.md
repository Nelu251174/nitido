# NÍTIDO — evaluări, locuințe și programare flexibilă

Referință: BRIEF-FINAL-NITIDO-FUNCTII-SI-EVALUARI.md, v1.1, 21 octombrie 2026. Baza LIVE: `207790f0eecb1340d68a2e92729b6feb818503ad`.

## Implementare

1. Homepage: bloc compact „Rating și evaluări”, media individuală a tuturor recenziilor eligibile (nu media neponderată a firmelor), număr, starea neutră fără scor și legături „Vezi recenziile” / „Evaluează lucrarea”. Ancora `#clienti` rămâne; `#recenzii` și meniurile o completează. Distincție explicită între serviciile firmelor și magazinele mobile.
2. `/client/evaluari-lucrari`: intenția se păstrează la autentificare; numai clienți; lucrare unică eligibilă deschisă direct; selecție pentru mai multe; explicație pentru lipsa eligibilității; evaluarea existentă se vede fără formular duplicat. Formular comun și în pagina lucrării: stele 1–5 fără preselecție, tastatură, câmp opțional, blocare simultană, eroare fără pierderea datelor și succes doar după răspunsul serverului.
3. Se păstrează politica verificată existentă: lucrare proprie finalizată, firmă alocată, plată capturată și numărul minim de dovezi valide din regulile înghețate. Publicul exclude recenziile nepublicate și legăturile de proprietate inconsistente. Nicio filtrare după valoarea stelelor. Datele de contact și adresa cunoscută a lucrării sunt redactate din comentariul public.
4. Locuințe: modulul existent `/client/proprietati`, fără abonament Pro, cu denumire, adresă, tip, suprafață, băi și indicații. Selector comun în configurator și în formularul din cont. Numai ID-ul fișei și câmpurile publice intră în URL/ciorna publică. Codurile și instrucțiunile de acces permanente nu se copiază automat. Preferințele relevante se copiază în rezervarea nouă și se pot modifica separat; revenirea după adăugarea cardului păstrează aceste modificări. Editarea/arhivarea fișei nu rescrie istoricul lucrărilor.
5. Programare flexibilă: până la două zile cu intervale pentru **începere**, propunere exactă voluntară de la o firmă cu serviciu și echipă configurate, fără rezervare la propunere. Verificări de zonă, catalog, calendar, durată, deplasare, expirare (cel mult 30 minute), versiune, preț și confirmare atomică prin motorul existent Standard. Clientul păstrează alegerea firmei. Refuz explicit, schimbare de interval și revenire la programare obișnuită. Notificare internă deduplicată pentru aceeași propunere.

## Pilot — limită de activare

Programarea flexibilă este oprită implicit. `NITIDO_FLEX_PILOT_CITY` trebuie să numească **o singură zonă verificată operațional**; lipsa variabilei închide atât interfața, cât și API-ul. Nu se creează echipe, disponibilități sau rezervări reale pentru demonstrație. Acceptarea finală păstrează fereastra de 48 de ore a HOLD-ului. Datele mai îndepărtate pot rămâne cereri/propuneri, fără confirmare anticipată a plății.

Validarea pilotului cu firme reale, disponibilitate cunoscută și conturi autorizate pentru proba operațională nu este certificată prin testele sintetice. Activarea și extinderea rămân condiționate de această verificare. Nu se schimbă comisionul, tarifele, Stripe, capturarea sau comenzile acceptate.

## Măsurare

Instrumentarea existentă primește `reviews_open`, `review_start`, `home_used`, `flex_start`, numai cu consimțământ. Fără adresă, comentariu, instrucțiuni sau ID de proprietate în evenimente. Salvarea evaluării este numărată din baza de date, separat de clickuri. Raportul administrativ `/admin/raport-rezervari` arată cohorta eligibilă/evaluată, fișe folosite în rezervări, repetări, timpul până la rezumat pentru sesiunile măsurate și volumele programării flexibile/fixe. Nu sunt concluzii cauzale și nu se presupune că sesiunile cu consimțământ reprezintă toți clienții.

## Verificare și revenire

Testele folosesc SQLite izolat, DOM și SDK de plăți simulat; nu se efectuează plăți sau notificări de test în producție. Acoperă 1–5 stele, selecție lipsă, eroare, dublu click, stări de eligibilitate, media ponderată corect, acces, păstrarea istoricului, propuneri invalide/expirate, echipă ocupată și două confirmări concurente. Testele DOM nu certifică vizual 320/360/390/430 px sau aplicațiile native.

Backupuri separate: `/app/data/release-checkpoints/20261021-before-final-functions`, cu SQLite online, fișiere, integritate și restaurare izolată. Migrarea este aditivă (număr de băi la fișă și două tabele pentru preferințe/propuneri). Revenire cod: SHA-ul anterior compatibil; nu se suprascrie baza de date cu un backup peste activitatea legitimă ulterioară. Verificatorul `rv8.cjs`, din ramura de checkpoint, compară câmpurile comerciale și adresele lucrărilor vechi și valorile plăților.

Rezultatele publicării, SHA-urile și verificările HTTP se livrează separat în raportul final Markdown, fără a echivala un build reușit cu o probă vizuală sau operațională.
