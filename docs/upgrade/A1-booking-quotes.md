# A1 — Oferta acceptată și rezervarea de test

Continuare a PR #55. Pachet pregătit pentru review și testare în sandbox; nu reprezintă acceptanță sau deploy LIVE.

## Comportament implementat

- Oferta se emite autentificat, pe server, folosind tariful administrabil. Reține clientul, contextul, versiunea, componentele în bani, creditul, totalul și expirarea.
- Valabilitate tehnică inițială: 15 minute. Formularul arată suma și cere o a doua apăsare explicită pentru confirmare. Modificarea datelor sau expirarea cere ofertă nouă.
- O ofertă încă valabilă păstrează tariful emis chiar dacă administratorul retrage sau înlocuiește versiunea. Retragerea afectează ofertele noi.
- Crearea lucrării, consumarea creditului, legarea ofertei și snapshotul sunt într-o singură tranzacție imediată. Soldul se verifică din baza curentă. Nu se aplică tacit credit suplimentar.
- Reîncercarea prin cheia cererii sau oferta deja utilizată întoarce aceeași lucrare, inclusiv după expirare. Formularul păstrează cheia în memorie după un răspuns pierdut; reîncărcarea paginii nu păstrează încă această stare.
- Stripe folosește în continuare suma lucrării din fluxul existent. Nu s-au modificat cheile, webhook-urile, autorizarea, capturarea, transferurile sau payout-urile.
- Interfața Admin raportează dacă integrarea sandbox este activă.

## Limitare explicită de activare

Dezactivat implicit. Codul poate activa integrarea numai dacă sunt simultan adevărate:

- `NITIDO_MANAGED_PRICING_SANDBOX=true`
- `NEXT_PUBLIC_SITE_URL=https://sandbox.nitido.ro` exact
- cheia Stripe configurată nu începe cu `sk_live_`

Nicio variabilă a serverului nu a fost schimbată în această livrare. Nu se activează acest flag în producție. Un tarif național/localitate trebuie publicat în registru înainte de test; lipsa tarifului blochează ofertarea.

Integrarea acoperă Standard, Express și suplimentul Express 60 existent. Nu autorizează o lansare a fluxului Pro. Contractele Pro, identificarea verificată a zonei și durata tarifată pe ore necesită integrare separată. Parametrii contract/zonă/ore furnizați de client sunt respinși; existența unor tarife active pe zone în localitate blochează acest calculator până la validarea adresei. Estimatorul public nu a fost conectat la motor și nu reprezintă oferta acceptată.

## Validare

`npm run test:upgrade:a1-quotes`: 305 teste / 23 fișiere trec în UTC și Europe/Bucharest. Include 17 teste ale ofertelor persistente, 7 teste prin ruta reală de creare a lucrării, 6 teste ale endpointului de estimare și regresia A0/A1. TypeScript și lint pe fișierele modificate trec.

Acoperire: expirare la limită, retragerea tarifului, context modificat, acces între clienți, credit schimbat, replay, rollback, mod legacy cu flag oprit, snapshot compatibil, blocarea ariilor neverificate. Nu au fost efectuate plăți reale.

## Restanțe de acceptanță

Accesul browserului la sandbox este în continuare blocat conform verificării anterioare. Nu declarăm verificarea vizuală, E2E Standard/Express/Pro pe roluri, iOS/Android sau TestFlight/Play finalizate. Nu s-a efectuat deploy.

Înainte de activare: review, deploy separat exclusiv în sandbox, verificarea formularului și a traseului firmă–execuție–plată de test, probă de backup/restaurare. Pro și motorul complet din brief rămân deschise, inclusiv suplimente/reduceri aprobate, ofertare manuală și marjă. Nu se inventează valorile comerciale.
