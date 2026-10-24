# Resetarea parolei ADMIN

Loginul `/admin` oferă „Am uitat parola ADMIN”; panoul autentificat oferă „Resetare parolă ADMIN”. Formularul este la `/admin/reset-parola`. Linkurile de email folosesc `/admin/recuperare`, o adresă echivalentă, pentru compatibilitate cu implementarea deja existentă în sandbox.

Recuperarea necesită emailul configurat al administratorului și factorul 2FA existent (TOTP sau un cod de recuperare nefolosit). Linkul expiră după 15 minute, este folosit o singură dată și devine utilizabil numai după acceptarea de către transportul email. Tokenul este stocat exclusiv ca SHA-256 și este transportat în fragmentul URL, eliminat din adresă înaintea completării formularului. Răspunsul public nu confirmă existența contului ori livrarea emailului.

Parola nouă are minimum 12 caractere, litere și cifre, maximum 72 de octeți UTF-8. Se salvează numai bcrypt cost 12. Parola, consumarea factorului și a linkului, închiderea sesiunilor contului și auditul sunt atomice. Resetarea nu autentifică automat și nu modifică MFA, rolurile, utilizatorii clienți/firme ori secretele de infrastructură.

Schema păstrează exact coloanele introduse deja în sandbox: `admin_password_credentials`, `admin_password_reset_tokens`, `admin_password_recovery_limits`. O rotație de parolă în infrastructură are prioritate; rotirea MFA păstrează parola recuperată, dar invalidează sesiunile și linkurile vechi. Configurațiile HTTPS admise sunt LIVE și sandbox; hosturile asemănătoare, credențialele în URL și originile nepermise sunt refuzate. Cererile Bearer nu înlocuiesc verificarea originii sau a factorilor.

## Publicare și validare

Validarea folosește SQLite izolat, identități sintetice și capturarea locală a transportului de email într-un container fără rețea. Nu sunt resetate parole reale și nu se trimit emailuri reale. Recepția în inboxul beneficiarului nu se declară testată. Dovezile finale și identificatorul publicării sunt în `docs/evidence/admin-password-reset-20261024.json`.

Sandboxul partajat conține între timp modificări Marketing din altă lucrare. Această publicare păstrează acel sandbox și se bazează pe versiunea LIVE existentă, cu recuperarea compatibilă integrată separat. Nu publică funcții Marketing. Înaintea publicării LIVE se execută un backup SQLite online, inventarierea și copierea uploadurilor, verificarea integrității și restaurarea izolată de verificare, folosind `scripts/arb.cjs`.

După resetări reale, revenirea la un cod care ignoră `admin_password_credentials` ar reactiva parola veche din infrastructură. Orice revenire ulterioară trebuie să păstreze suportul pentru override-uri sau să includă o rotație de parolă autorizată în infrastructură. Backupul de release este privat, pe volumul persistent; nu înlocuiește backupul offsite.

Publicat LIVE: `2a5c0b60ae26f7f5bbb805c7f6c6006d59762da1`, deployment `hxqpndlappk4qkdt9ivul0jt`, finalizat la 24 octombrie 2026, 16:22:22 UTC. Stare `running:healthy`. Cele 2.350 teste din 224 fișiere, lintul, buildul de producție, 33 verificări în browser și 12 verificări LIVE au trecut. Prezența configurării emailului și a credentialelor ADMIN a fost confirmată fără exportarea valorilor; ambele taskuri temporare de backup/verificare au fost șterse. Nu s-au resetat parole reale și nu s-au trimis emailuri reale de recuperare în teste.
