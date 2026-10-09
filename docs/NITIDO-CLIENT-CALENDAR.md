# Calendar client în ora României

## Problema și corecția

Calendarul clientului folosea data și fusul local al dispozitivului pentru eligibilitatea intervalelor, în timp ce serverul interpretează programările în Europe/Bucharest. Intervalul ASAP era calculat o singură dată la deschiderea paginii.

Data selectată este acum o dată civilă YYYY-MM-DD. Calendarul celor 14 zile pornește din ziua curentă a României. Sloturile și estimarea ASAP folosesc aceleași funcții de fus orar ca serverul. Calendarul se actualizează la 30 de secunde și la revenirea în fereastră; selecția expirată este marcată, iar intervalul este reverificat cu ora curentă înainte de cererea de publicare. Validarea serverului rămâne autoritativă.

Datele din configurator și din restaurarea după adăugarea cardului rămân civile, fără conversie în fusul dispozitivului. Datele invalide din link sunt respinse. Zilele au etichete accesibile cu lună și an. Estimarea ASAP nu promite disponibilitatea unei firme.

## Dovezi și limite

- 62 teste scheduling, bookingDraft și pricing: trecute. Include 10 cazuri noi pentru patru fusuri orare, schimbarea orei, limita exactă de o oră, selecții expirate și date/ore invalide.
- ESLint și build Next.js/TypeScript: trecute.
- Proba vizuală autentificată și QA pe dispozitive fizice rămân deschise. Testele nu reprezintă închiderea E2 sau a gate-urilor Stripe.
- Nu se schimbă tarifele, contractul serverului sau aplicația mobilă prin această livrare.

## Instalare — 13 septembrie 2026

- Sandbox: `356fadeaa8eecf0797f73ba8c9b494a5dac69269`.
- CI complet verde: https://github.com/Nelu251174/nitido/actions/runs/34755113480.
- Deployment `pqp55b1q0urhcujzeqe8iezj`, finalizat 11:45:15 UTC; healthcheck trecut la prima încercare. Configuratorul public este vizibil după reload.
- Nu s-a executat QA autentificat al calendarului. Nu s-a promovat candidatul în producție.
