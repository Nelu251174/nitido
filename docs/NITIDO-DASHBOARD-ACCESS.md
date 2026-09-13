# E2 — acces și revenire în dashboard

## Probleme reproduse pe sandbox înainte de corecție

Pe candidatul `c04d0d4`, o cerere cu cookie de sesiune invalid a fost refuzată cu 401 de API-urile jobs, workspace, account/client, account/firm, recurring, admin/overview, admin/payout-reconciliation și push/status. `/api/auth/me` a returnat 200 cu utilizator null, conform contractului său. Mai multe răspunsuri nu aveau antet Cache-Control explicit.

În browser, `/client` a redirecționat la login cu destinația păstrată. `/firma` a redirecționat la `/login`, unde formularul implicit era pentru client și destinația firmei era pierdută. Spațiile operaționale foloseau aceeași redirecționare generică.

## Corecție

Configurația Next adaugă `Cache-Control: private, no-store` pentru API-urile auth, account, jobs, workspace, recurring, admin, payments, push, reports, uploads, assessments și firm, inclusiv subrute și răspunsuri de eroare. Aceasta limitează păstrarea răspunsurilor în cache-uri HTTP; nu este un mecanism de revocare a sesiunilor sau de ștergere a stării React.

Pagina firmei și spațiile operaționale reutilizează helperul existent `authSwitchHref`: păstrează rolul și calea internă solicitată, inclusiv query și fragment. Helperul respinge destinații externe și normalizează destinațiile incompatibile cu rolul. API-urile păstrează verificările proprii de autentificare și autorizare.

## Validare și limite

Local: lint, 8 teste existente ale redirecturilor sigure, build Next și probă HTTP pe serverul standalone. Toate cele 9 endpointuri enumerate au trimis `private, no-store`, cu același rezultat de autentificare ca înainte.

Probele fără autentificare nu închid gate-ul `authenticated_dashboards`. Rămân necesare loginul real client/firmă/admin, verificarea datelor fiecărui rol și a izolării între utilizatori, logout/relogin, sesiune expirată, MFA/recuperare și proba pe dispozitive. Nu se declară o scurgere de date demonstrată doar din lipsa anterioară a antetului de cache.
