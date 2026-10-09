# A2 — Oferte manuale în contul clientului

Acest pachet continuă calculul intern din PR57. Este pregătit pentru sandbox și nu este publicat LIVE.

## Comportament implementat

- Admin publică o revizie salvată, cu descriere publică, termen de valabilitate și motiv intern. Modificările nesalvate blochează butonul de publicare.
- Oferta păstrează componentele, reducerea, totalul, localitatea, suprafața, categoria și versiunea cererii de la publicare. Istoricul prețurilor și evenimentelor nu poate fi rescris sau șters.
- Clientul vede numai ofertele propriilor cereri. Remunerația prestatorului, costurile, sursele, marja și motivul intern nu sunt transmise prin API-ul clientului.
- Acceptarea solicită confirmarea explicită a sumei afișate. Serverul verifică proprietarul, termenul, starea ofertei și versiunea cererii. O ofertă expirată, retrasă sau înlocuită nu poate fi acceptată.
- Retragerea și înlocuirea sunt auditate. Oferta acceptată nu poate fi înlocuită sau retrasă prin aceste operațiuni.
- Reîncercările aceleiași decizii nu creează evenimente duplicate. Publicarea și auditul Admin folosesc aceeași tranzacție.

## Activare și limite

Mutațiile sunt oprite implicit. Sunt permise numai când `NITIDO_MANUAL_OFFERS_SANDBOX=true`, `NEXT_PUBLIC_SITE_URL=https://sandbox.nitido.ro` și cheia Stripe nu începe cu `sk_live_`. Acest pachet nu modifică variabilele serverului și nu face deploy.

Acceptarea înregistrează o decizie de test; **nu creează o rezervare, nu autorizează cardul și nu încasează bani**. Interfața explică acest lucru înainte și după acceptare. Nu sunt trimise emailuri sau notificări externe.

Publicarea cere costuri complete, dar permite valori estimate documentate. Pragul comercial de marjă nu este configurat; nici o marjă negativă nu primește implicit aprobare comercială. Acest flux nu trebuie activat în producție înainte de integrarea regulilor comerciale și a rezervării/plății.

Ofertele pentru categoria renovare sunt blocate până la implementarea verificării fotografiilor. Verificarea vizuală pe mobil și fluxurile complete Standard, Express și Pro rămân necesare. Browserul sandbox a fost blocat de politica de acces; verificarea nu a fost ocolită sau declarată efectuată.

## Verificări

- `TZ=UTC npm run test:upgrade:a2-offers`: 402 teste trecute în 31 fișiere.
- `TZ=Europe/Bucharest npm run test:upgrade:a2-offers`: 402 teste trecute în 31 fișiere.
- Generarea tipurilor Next și verificarea TypeScript.
- ESLint pentru fișierele noi și componentele modificate.

Regresia include testele anterioare de rezervare, plăți, Pro și marjă, plus teste reale SQLite și API pentru proprietar, roluri, origine, expirare, versiuni, confidențialitate, idempotență și rollback la eșecul auditului.
