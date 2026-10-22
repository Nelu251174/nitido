# Suplimente — traduceri complete pentru fluxul publicat

Lot: completarea celor 70 de texte inventariate în `messages/extra-work-source.json`, în cele nouă limbi deja publicate. Sunt incluse formularul firmei, categoriile, dificultatea, stările, perioada de valabilitate, acordul clientului, confirmările, erorile API ale modulului și eroarea de verificare a contului.

Descrierile introduse de utilizatori nu sunt traduse. Identificatorii, valorile trimise serverului, destinația evaluărilor, sumele în RON și fusul Europe/Bucharest se păstrează. Erorile neașteptate de transport folosesc un mesaj propriu tradus; detaliile interne ale excepțiilor nu sunt afișate.

## Verificări

- 63 de teste noi în DOM, cu providerul real de traduceri: nouă limbi × inventar, stări și termeni, formular complet, acord și apăsare dublă, conflict și revenire după eroare de rețea, salvare cu actualizare eșuată, reîncercare autentificare.
- Sunt păstrate cele șapte teste existente pentru funcționalitatea suplimentelor și cele nouă pentru intrările sezonului.
- Suita completă: 2.245 teste / 213 fișiere, trecute.
- TypeScript, ESLint, validarea celor nouă cataloage cu 4.630 de mesaje și cele 15 teste pentru cataloage/restaurare au trecut.

Acestea sunt teste automate cu date sintetice și răspunsuri simulate; nu reprezintă testare vizuală pe telefoane sau operațiuni comerciale reale. Traducerea integrală a tuturor celorlalte module noi și revizia lingvistică independentă rămân distincte. Inventarul de 70 de texte nu este întregul catalog al platformei.

## Publicare și revenire

Se verifică aceeași sursă pe infrastructura de verificare existentă înainte de LIVE. Se face checkpoint nou cu restaurare izolată și integritatea fișierelor, apoi se verifică sănătatea și resursele livrate. Nu există modificări de schemă, prețuri, comision, plăți sau cronuri.

Revenirea constă în republicarea sursei `66d75f172deabd8c032a546957b8b3d36ecb0bd2`. Nu necesită restaurarea datelor. Identificatorii și dovezile publicării se consemnează în raportul de livrare.

## Puncte care rămân deschise

Rezervarea și plata separate ale suplimentului nu sunt activate de acest lot. Porțile pentru ofertele și rezervările administrate rămân limitate la sandbox. Configurațiile push FCM/APNs, destinația de backup extern și probele native rămân necesare; nu sunt înlocuite prin traduceri sau teste DOM.

## Verificarea pregătirii financiare

La revizia codului au fost identificate două porți de sandbox care respingeau `sk_live_`, dar nu și `rk_live_`. Ambele resping acum cele două tipuri de chei LIVE; gazda de producție și activarea explicită sunt verificate în continuare. Cele nouă teste noi acoperă aceste combinații, fără apeluri către Stripe și fără acces la chei reale. API-urile de plată, SDK-ul, prețurile, comisionul și mecanismul existent de HOLD/captură nu se schimbă.
