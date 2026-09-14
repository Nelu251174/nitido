# Maximum trei carduri per client — 14 septembrie 2026

Bază: f20a9efe56c66c60e0a0c2a4f1ff3841ac9790be, PR #49, codex/nitido-full-option-v3.

## Comportament

- Adaugă card nou înlocuiește Schimbă cardul. Maximum trei carduri active în cont, cu marcă, ultimele patru cifre, expirare și indicator Implicit.
- Adăugarea păstrează cardul implicit existent. Primul card al unui cont gol devine implicit. Clientul poate seta alt card implicit, alege cardul la publicarea unei lucrări și elimina un card.
- Cardul unei lucrări este salvat atomic cu publicarea. Modificarea cardului implicit nu schimbă lucrările deja publicate sau autorizările existente. Reîncercările păstrează parametrii și cheia idempotentă originală Stripe.
- Eliminarea unui card ales pentru o lucrare în așteptare este refuzată; după preluare/anulare poate fi eliminat din lista activă. Referințele Stripe rămân disponibile pentru istoricul financiar și operațiunile deja autorizate; nu se detașează automat de la Stripe.
- Trei poziții cu CHECK și unicitate în SQLite limitează inventarul activ, inclusiv în cazul confirmărilor concurente. Limita se verifică înainte de Checkout și din nou la confirmare. Un Checkout concurent care depășește limita nu devine card activ în NITIDO.
- Confirmările verifică proprietarul, Customer, sesiunea exactă, SetupIntent și PaymentMethod. Replay-ul nu adaugă carduri și nu reactivează un card eliminat. Același fingerprint verificat de Stripe nu ocupă o nouă poziție.
- Numerele complete și CVC nu intră în NITIDO; colectarea rămâne în Checkout găzduit de Stripe.

## Migrare și compatibilitate

Trei tabele aditive: client_saved_cards, client_card_setup_results, client_job_cards. Cardul existent este preluat fără schimbarea metodei implicite. Lucrările în așteptare primesc asocierea existentă; încercările financiare persistate își păstrează cererea originală. GET păstrează hasCard/stripeConfigured pentru compatibilitate, adăugând lista mascată și identificatori locali.

## Mobil

Website responsive și cod Expo: listă, implicit, eliminare și alegere la rezervare. Checkout se deschide în browserul telefonului; revenirea în aplicație și Verifică adăugarea confirmă sesiunea exactă. Identificatorul de sesiune se păstrează separat per utilizator pe dispozitiv pentru retry. Publicarea din mobil trimite cardId.

Instalarea backendului nu distribuie noul build mobil. Semnarea, instalarea și proba pe dispozitiv rămân distincte. Proba reală Stripe cu trei carduri și 3DS rămâne un criteriu E2, separat de testele automate.

Referință oficială: https://docs.stripe.com/api/checkout/sessions/create
