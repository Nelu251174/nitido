# NITIDO — actualizarea aplicației existente în TestFlight

## Baza verificată

Captura beneficiarului confirmă versiunea 1.0, build 7. GitHub run 34515913381, commit f314ade4bc691a8d9dc5b615bd15e30a347af8b2, a încheiat cu succes autentificarea Apple, archive, export și upload. Logul final conține UPLOAD SUCCEEDED. Identitatea este ro.nitido.app. Configurația iOS și workflow-ul din această bază sunt deja prezente în ramura v3.

Actualizarea reutilizează aplicația Capacitor și se distribuie prin TestFlight. Nu publică în App Store și nu promovează website-ul public. Expo este un proiect separat pregătit anterior; buildurile ad-hoc Expo nu sunt folosite pentru înlocuirea buildului 7.

## Modificări

- Robotul TestFlight construiește explicit cu https://sandbox.nitido.ro și verifică URL-ul și bundle ID-ul după sincronizarea Capacitor.
- Numărul buildului continuă github.run_number din workflow-ul existent (ultimul reușit: 7); versiunea aplicației rămâne 1.0.
- Pluginul oficial Capacitor Push Notifications 8.1.2 este inclus prin SPM; AppDelegate transmite înregistrarea APNs. Entitlementul este production, necesar distribuției TestFlight, independent de mediul de date sandbox.
- Contul autentificat poate înregistra telefonul prin butonul Activează notificările telefonului. Refuzul permisiunii, timeoutul și respingerea serverului nu sunt prezentate ca succes.
- Atingerea notificării construiește doar destinații interne potrivite rolului. API-urile reverifică accesul la date.
- Logout retrage tokenul serverului, oprește înregistrarea nativă și curăță notificările înainte de închiderea sesiunii. Dacă retragerea eșuează, utilizatorul poate reîncerca fără pierderea tokenului.
- Sunetul push și bannerele sunt gestionate nativ. Pollingul web nu dublează sunetul automat pe aplicația nativă cu pluginul disponibil.

## Probe și limite

Sincronizare Capacitor iOS reușită, TypeScript și 7 teste de înregistrare/revocare/rutare. Lint fără erori după corecție; buildul web și CI trebuie confirmate pe SHA-ul publicat.

Cheia App Store Connect utilizată pentru semnare/upload nu este cheia APNs. Serverul sandbox are încă PUSH_ENABLED=false și APNs incomplet; primirea efectivă cu sunet nu este demonstrată de existența pluginului sau de încărcarea TestFlight. Urmează configurarea cheii APNs, APNS_USE_SANDBOX=false pentru TestFlight, instalarea update-ului și proba pe telefon.

Accesul autentificat complet CLIENT/FIRMĂ/ANGAJAT/ADMIN rămâne deschis. SMS este amânat.
