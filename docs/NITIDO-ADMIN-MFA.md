# E2 — MFA pentru administrator

Sursa cerinței: brief master §06, autentificare și roluri. Baza continuării: `bc79e4442f52ba6b08523bc632fd7b5ae80acd37`.

## Ce este implementat

Administratorul configurat pe server introduce emailul, parola și un cod din aplicația de autentificare. Codul TOTP folosește HMAC-SHA1, 6 cifre și intervale de 30 secunde; sunt acceptate intervalul curent și câte unul adiacent pentru diferența de ceas. O valoare consumată nu poate deschide altă sesiune, inclusiv după restart sau printr-o conexiune SQLite separată. Algoritmul este verificat cu vectorii publicați în [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238).

Alternativ, parola plus un cod de recuperare pot deschide sesiunea. Codurile generate au 128 biți aleatori și sunt utilizabile o singură dată. Serverul primește numai hashurile configurate; în SQLite se păstrează hashul codului consumat. O schimbare a configurației TOTP nu reactivează codurile de recuperare deja folosite.

Consumul codului, sesiunea, dovada MFA și auditul sunt salvate în aceeași tranzacție. Dacă salvarea eșuează, nu rămâne o sesiune fără MFA. Dacă trimiterea cookie-ului eșuează după salvare, sesiunea este eliminată, iar factorul rămâne consumat; se folosește un cod nou.

Cookie-ul rămâne `nitido_admin_session`, HttpOnly, SameSite Strict, Secure în production, cu expirare de 8 ore. La fiecare verificare admin se cer dovada MFA și configurația curentă. Schimbarea emailului, parolei/hashului, secretului TOTP sau listei de recuperare invalidează sesiunile existente. Logout elimină sesiunea și dovada sa; nu resetează codurile consumate.

Login/logout cer origine explicită validă. Un antet Bearer arbitrar nu o înlocuiește. Loginul păstrează limita de 5 încercări/IP/15 minute și adaugă o limită persistentă de 20 încercări totale/15 minute pentru administratorul configurat. Aceasta rezistă restartului și schimbării IP-ului declarat. Un volum de încercări ostile poate bloca temporar și loginul legitim; fereastra expiră automat. Nu ștergeți starea MFA pentru a ocoli limita.

## Înrolare înainte de instalare

Nu instalați această versiune pe mediul țintă înainte de înrolare: **sesiunile vechi, fără MFA, sunt refuzate**, iar lipsa secretului dezactivează autentificarea admin. Nu există flag de revenire la login numai cu parolă.

Pe o stație de operare de încredere, cu Node disponibil și un director privat existent **în afara repository-ului**, executați:

```bash
node scripts/admin-mfa-provision.mjs /secure/nitido-admin-enrollment.json admin@example.com
```

Înlocuiți emailul și calea cu valorile mediului. Utilitarul este offline, nu trimite mesaje și nu contactează furnizori. Creează un fișier nou cu permisiuni `0600`, fără suprascriere și fără afișarea secretelor în terminal. Refuză destinațiile din checkout, inclusiv printr-un director simbolic. Fișierul conține cheia TOTP, URI-ul `otpauth`, codurile de recuperare și valorile pentru configurația serverului.

1. Importați cheia/URI-ul în aplicația de autentificare a administratorului, din fișierul privat. Nu există un endpoint public pentru afișarea secretului.
2. Injectați `NITIDO_ADMIN_TOTP_SECRET` și `NITIDO_ADMIN_RECOVERY_HASHES` prin mecanismul securizat al infrastructurii, împreună cu emailul și credentialul admin existente. Folosiți preferabil hash bcrypt cu cost cel puțin 12. Dacă sunt configurate și parola simplă, și hashul, ambele căi existente rămân acceptate; la rotație eliminați/actualizați toate credentialele vechi.
3. Păstrați codurile de recuperare separat de parolă și de dispozitivul MFA, într-un spațiu privat controlat de beneficiar. Nu păstrați fișierul de înrolare în repository, rapoarte, loguri sau sisteme de partajare nesecurizate. Politica de păstrare a exemplarului inițial se stabilește în operare după verificarea înrolării.
4. Verificați ceasul serverului și al dispozitivului. Demonstrați loginul cu TOTP, apoi un cod de recuperare, pe staging.

Secretul TOTP este configurat extern și nu este salvat în SQLite sau trimis către pagina de login. Codurile de recuperare sunt opționale pentru configurare, dar trebuie pregătit și demonstrat un mecanism de recuperare înainte de acceptare. Nu s-au generat sau instalat factorii reali ai beneficiarului în această sesiune; utilitarul a fost executat numai în teste izolate.

Preflight-ul verifică prezența credentialelor și forma secretului, fără a afișa valori. Nu verifică asocierea cu dispozitivul, calitatea aleatoare a unei chei introduse manual sau funcționarea codurilor: acestea rămân probe runtime. Preferința pentru factori de posesie și recuperare separată urmează [ghidul OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html).

## Pierderea dispozitivului și rotație

- Cu un cod de recuperare disponibil: loginul cere și parola. Codul este consumat. Înlocuirea factorului se face prin infrastructura securizată de către operatorul autorizat, cu confirmarea identității beneficiarului și înregistrarea intervenției.
- Fără cod de recuperare: intervenție autorizată în infrastructură; nu există reset MFA doar prin email sau parolă. Folosiți o cheie nouă și un set nou de coduri, apoi demonstrați accesul.
- Schimbările configurației invalidează sesiunile la următoarea verificare; nu se distribuie același factor mai multor operatori.
- După restaurarea unei copii SQLite, tratați starea codurilor ca istoric restaurat. Rotiți factorul și pachetul de recuperare înainte de redeschiderea accesului admin, pentru a preveni reutilizarea unor coduri consumate după data backupului. Nu ștergeți individual marcajele de consum.

## Migrare și limite

Schema adaugă `admin_session_mfa`, `admin_totp_state`, `admin_used_recovery_codes` și `admin_login_limit`. Nu convertește sesiunile vechi în sesiuni cu MFA și nu introduce secrete în baza de date. Păstrați aceste tabele la rollback; versiunea veche a aplicației nu impune MFA și nu este un rollback de securitate echivalent. Nu rulați simultan instanțe vechi și noi care deservesc aceleași sesiuni admin.

Această implementare protejează **contul admin unic configurat în aplicația existentă**, inclusiv accesul său la endpointurile financiare. Conturile administrative nominale multiple, rolurile separate suport/finanțe, passkeys și reautentificarea dedicată pentru schimbarea datelor financiare sensibile ale firmei rămân cerințe distincte, neînchise de această livrare. Endpointurile de scheduler folosesc în continuare secrete de serviciu și nu devin sesiuni admin.

Testele automate acoperă vectori RFC, expirare, replay, concurență, recuperare, rotație, logout, rollback, cookie neconfirmat, limite persistente și refuzul sesiunilor fără MFA la un endpoint financiar. Acestea nu substituie înrolarea reală și QA în browser.

## Criteriul rămas pentru staging

Pe SHA-ul candidatului demonstrați: aplicație de autentificare reală, cod greșit/expirat/reutilizat refuzat, login TOTP reușit, recuperare o singură dată, sesiune veche refuzată, rotație care revocă accesul, logout și acces admin financiar după MFA. Păstrați capturi fără coduri/secrete, timestampuri, rezultat API și audit. Aceste probe completează `authenticated_dashboards` și `staging_configuration`; **E2 rămâne deschisă** până la acceptarea întregului nucleu.
