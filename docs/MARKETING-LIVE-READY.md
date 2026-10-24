# Integrare Marketing pentru ADMIN LIVE — pregătită, nepublicată

Baza este commitul `2a5c0b60ae26f7f5bbb805c7f6c6006d59762da1`, versiunea LIVE confirmată în Coolify. `main` și ramura sandbox cu recuperarea ADMIN diferită nu au fost folosite ca bază. Au fost transferate numai modificările Marketing. Codul de autentificare, resetare parolă, MFA, staff și inițializare a bazei rămâne identic cu această versiune LIVE.

Marketing apare în meniul lateral ADMIN, în bara superioară și prin butonul „Deschide Marketing” imediat sub titlul Centrului de operațiuni. Accesul este exclusiv `super_admin`; pagina și API-urile verifică permisiunea pe server. Sunt incluse contactele în trei categorii, colectarea publică/CSV/ANAF, campaniile, programarea, coada de test, dezabonarea și rapoartele descrise în MARKETING-FINALIZATION.md.

Configurația Compose pentru producție activează exclusiv modulul ADMIN prin `NITIDO_MARKETING_ADMIN_ENABLED=true`. Aceeași configurație forțează `NITIDO_MARKETING_DELIVERY_ENABLED=false`, cu prioritate față de `.env`. Butonul și rapoartele sunt funcționale, iar expedierea externă a campaniilor este blocată. Volumele și toate celelalte setări Compose rămân identice cu baza LIVE. Nu se creează campanii/contacte prin deploy; tabelele Marketing sunt aditive și inițializate la utilizare/scheduler.

Validare: 105 teste automate trecute (Marketing, navigare și recuperarea ADMIN existentă); build production cu `NEXT_PUBLIC_SITE_URL=https://nitido.ro` și modulul activat; verificări i18n pentru 9 limbi; ESLint; Chromium pe o bază locală sintetică pentru navigare desktop/mobil și blocarea trimiterii reale. Datele și conturile LIVE nu au fost folosite pentru testare. Nu au fost trimise emailuri.

Publicarea acestui candidat pe LIVE așteaptă confirmarea utilizatorului: cerința inițială a exclus explicit publicarea LIVE. După confirmare se verifică din nou sursa instalată, se păstrează volumele existente și se verifică sănătatea aplicației și protecția accesului. Acest document și existența ramurii/PR-ului nu înseamnă că a fost efectuat deploy LIVE.
