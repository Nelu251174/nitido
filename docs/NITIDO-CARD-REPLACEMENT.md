# Schimbarea cardului — E2, 14 septembrie 2026

Bază: `095958b23d4a7740aee00c2c0c1e205cd1486204`, PR #49, ramura `codex/nitido-full-option-v3`.

## Comportament

- CLIENT → Plăți → Schimbă cardul. Aceeași acțiune este disponibilă în formularul rezervării, lângă starea cardului salvat.
- Stripe Checkout în mod setup colectează cardul; NITIDO nu colectează numărul sau CVC-ul. Formularul rezervării se păstrează prin mecanismul existent.
- Cardul implicit se schimbă numai după verificarea sesiunii exacte, a proprietarului, a clientului Stripe, a SetupIntent-ului reușit și a metodei de plată card asociate acelui client.
- Anularea, eșecul și confirmările incomplete păstrează cardul anterior. Un eșec de rețea la citirea clientului Stripe nu mai recreează clientul și nu șterge cardul.
- Confirmările repetate sunt idempotente; un răspuns întârziat nu suprascrie o altă schimbare de card confirmată între timp. Erorile providerului nu sunt expuse în interfață.
- Plățile și autorizările existente nu sunt rescrise; cardurile vechi nu sunt detașate. Cardul nou este folosit pentru autorizări noi. Încercările financiare deja persistate nu sunt relansate automat cu alt card.

## Validare

Teste dedicate pentru schimbare, primul card, anulare/stări incomplete, cont străin, concurență, retry, erori Stripe și limitele HTTP. Verificare de regresie pentru 3DS, plăți și restaurarea formularului. TypeScript și ESLint verificate separat; rezultatele CI și ale instalării se raportează pe commitul final.

## Instalare și limite

Nu sunt necesare migrații sau chei noi. Se instalează web și API împreună. Sesiunile Checkout deschise înainte de această versiune nu au noul identificator în URL/metadate; utilizatorul trebuie să pornească din nou salvarea cardului. Cardul anterior rămâne disponibil.

Implementarea privește clientul web, inclusiv afișarea pe telefon. Nu distribuie un build Expo nou. Validarea autentificată cu Stripe sandbox și proba 3DS sunt distincte de testele locale cu provider simulat. E2 rămâne deschisă.

Referință Stripe: https://docs.stripe.com/payments/checkout/save-and-reuse?payment-ui=checkout-form
