# Configurator public de rezervare — 13 septembrie 2026

Candidat: `4c344670f33cdf5a247a946eee3e0c42119b9beb`, PR #49.

## Schimbare vizibilă

Ruta `/rezervare` are trei pași funcționali: Spațiu, Programare, Verificare. Navigarea înapoi și acțiunile Modifică păstrează alegerile. Rezumatul afișează tariful existent, durata estimată și detaliile curente. Plata și publicarea nu sunt executate de acest configurator.

Ora validă primită în URL este păstrată. Programarea explicită cere dată și interval valid, cu minimum o oră înainte după fusul României. Localitatea este obligatorie și suprafața trebuie să fie un întreg între 10 și 1.000 m². Opțiunile de spațiu vin din catalogul activ. Continuarea transmite alegerile către fluxul existent `/client?...#sec-form`.

## Verificare înainte de instalare

- ESLint pentru componentă: trecut.
- Build Next.js și TypeScript: trecut.
- 42 teste existente pricing/scheduling/authRedirect: trecute.
- CI: https://github.com/Nelu251174/nitido/actions/runs/34754167911 — succes, toate cele trei joburi.

## Limite

Această livrare acoperă configurarea publică din CLI02. Nu închide QA autentificat, publicarea/plata completă, Stripe 3DS/device QA, reconcilierea sau acceptarea integrală E1/E2. Nu introduce tarife ori extrasuri comerciale noi. Producția nu este promovată prin această livrare.

## Instalare și probă în browser

Sandbox instalat la 11:23:05 UTC, deployment `wttci7tkeqpftzdfaf7u8irn`, commit `4c344670f33cdf5a247a946eee3e0c42119b9beb`. Healthcheck trecut la prima încercare. Interfața publică nouă a fost observată după reload.

- Navigarea Spațiu → Programare → Verificare și revenirea prin Modifică spațiul: trecute.
- Localitate goală și suprafață 9 m²: mesaje explicite, avansarea blocată.
- Programare explicită fără dată: avansarea blocată.
- Link cu apartament, 60 m², Brașov, 20 septembrie 2026 la 14:00, Express: toate valorile păstrate; estimare existentă 400 lei și 2 h.
- Continuă în cont: login cu destinația `/client?...#sec-form`, păstrând toate cele șase alegeri; linkul de creare cont păstrează aceeași destinație.
- Rezumat desktop inspectat vizual în browser. Nu s-a executat autentificarea, publicarea sau plata. QA pe dispozitive fizice și matricea tuturor lățimilor rămân deschise.
