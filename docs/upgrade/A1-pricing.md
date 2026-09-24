# A1 — Registru de tarife și simulator

## Stare

Pachet pregătit pentru review, dependent de A0 (PR #54). Nu este publicat LIVE și nu activează prețurile administrabile în rezervări. `bookingActivation: false` este explicit în API și interfață.

Validarea manuală Standard, Express și Pro în sandbox nu este finalizată: prima navigare a eșuat cu `ERR_INSUFFICIENT_RESOURCES`; reîncercarea a fost refuzată de politica browserului. Nu au fost efectuate rezervări, plăți sau verificări pe roluri. Testele automate de mai jos nu înlocuiesc acceptanța în sandbox.

## Implementat

- Admin → Catalog: creare din tarifele actuale, copiere, editare, simulare, publicare în registru cu perioadă și retragere motivată.
- Metodă principală unică: pachet pe praguri, m², ore sau ofertă manuală. Geamurile sunt supliment separat. Moneda RON; sumele sunt întregi în bani; rotunjirea curățeniei reproduce calculul actual.
- Resolver cu prioritate contract Pro → zonă → localitate → național; intervale [început, sfârșit). Lipsa sau ambiguitatea tarifului blochează calculul.
- Publicare condiționată de simularea reviziei salvate; conflictele pentru aceeași arie/perioadă sunt respinse.
- Revizii optimiste, tranzacții imediate, audit atomic, istoric și simulări imutabile. Un eșec de audit anulează operațiunea.
- API protejat prin autentificarea Admin existentă și verificarea originii pentru mutații.
- Schema adaugă trei tabele proprii și trigger-ele lor. Nu rescrie tarifele sau snapshoturile comenzilor existente.

Publicarea în registru este o operațiune internă a acestui pachet. Nu înseamnă deploy și nu schimbă estimatorul, checkout-ul sau Stripe.

## Validare reproductibilă

```sh
TZ=UTC npm run test:upgrade:a1
TZ=Europe/Bucharest npm run test:upgrade:a1
npx next typegen
npx tsc --noEmit
```

Suita include regresia A0 și 26 teste noi. Testul de paritate compară 12.000 combinații (4 spații × 1–1000 m² × 3 suprafețe de geamuri) cu tarifele existente. Se verifică și conflictele de publicare, limitele temporale, prioritățile, reviziile expirate, retragerea, auditul atomic și protecția API.

Workflow-ul `upgrade-a1.yml` rulează în UTC și Europe/Bucharest. Interfața nu a fost verificată vizual în browser în această etapă.

## Condiții rămase înainte de activare

1. Finalizarea scenariilor Standard, Express și Pro în sandbox, cu conturile și datele de test autorizate.
2. Verificarea vizuală și funcțională a editorului Admin, inclusiv pe mobil și cu doi administratori care editează aceeași versiune.
3. Integrarea resolverului în estimare și confirmare, validarea contractului Pro pe server, oferte cu expirare și reconfirmare înainte de plată. Snapshoturile istorice rămân nemodificate.
4. Configurarea regulilor suplimentare din brief (de exemplu reduceri și particularități Express/Pro), cu acceptanță separată; acestea nu sunt pretinse implementate de registrul inițial.
5. Acceptanță sandbox pentru integrare înaintea unui deploy LIVE separat.
